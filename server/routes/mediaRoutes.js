const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

// Create upload directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage });

// Handle media upload
router.post('/upload', upload.single('media'), async (req, res) => {
    try {
        const { donation_id, type } = req.body;

        if (!donation_id || !type) {
            return res.status(400).json({ error: 'Donation ID and type are required' });
        }

        if (!['image', 'video'].includes(type)) {
            return res.status(400).json({ error: 'Type must be either "image" or "video"' });
        }

        let filePath = '';

        // Handle file upload
        if (req.file) {
            // Local file path
            const localFilePath = req.file.path;
            console.log(`File received: ${req.file.originalname}, size: ${req.file.size} bytes`);

            // Upload to Supabase if available
            try {
                const fileName = `donations/${donation_id}/${type}-${uuidv4()}${path.extname(req.file.originalname)}`;
                const fileBuffer = fs.readFileSync(localFilePath);

                console.log(`Uploading to Supabase: ${fileName}`);
                const { data, error } = await supabase.storage
                    .from('media')
                    .upload(fileName, fileBuffer, {
                        contentType: req.file.mimetype,
                        cacheControl: '3600'
                    });

                if (error) {
                    console.error('Supabase upload error:', error);
                    throw error;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('media')
                    .getPublicUrl(fileName);

                filePath = urlData.publicUrl;
                console.log(`File uploaded to Supabase: ${filePath}`);

                // Delete local file after successful upload
                fs.unlinkSync(localFilePath);
            } catch (uploadError) {
                console.warn('Supabase upload failed, keeping local file:', uploadError);
                // Use local path if Supabase upload fails
                filePath = `/uploads/${path.basename(localFilePath)}`;
            }
        } else if (req.body.media) {
            // Handle base64 encoded media
            const match = req.body.media.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

            if (!match) {
                return res.status(400).json({ error: 'Invalid media format' });
            }

            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Get file extension
            let fileExtension = 'bin';
            if (mimeType.startsWith('image/')) {
                fileExtension = mimeType.split('/')[1];
            } else if (mimeType.startsWith('video/')) {
                fileExtension = mimeType.split('/')[1];
            }

            // Generate filename
            const fileName = `donations/${donation_id}/${type}-${uuidv4()}.${fileExtension}`;

            try {
                // Upload to Supabase
                const { data, error } = await supabase.storage
                    .from('media')
                    .upload(fileName, buffer, {
                        contentType: mimeType,
                        cacheControl: '3600'
                    });

                if (error) throw error;

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('media')
                    .getPublicUrl(fileName);

                filePath = urlData.publicUrl;
            } catch (uploadError) {
                console.warn('Supabase upload failed:', uploadError);

                // Save locally as fallback
                const localFileName = `${type}-${uuidv4()}.${fileExtension}`;
                const localFilePath = path.join(uploadsDir, localFileName);

                fs.writeFileSync(localFilePath, buffer);
                filePath = `/uploads/${localFileName}`;
            }
        } else {
            return res.status(400).json({ error: 'No media file provided' });
        }

        // Save media record to database
        const query = `
      INSERT INTO media (donation_id, type, file_path)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        const { rows } = await req.app.locals.db.query(query, [donation_id, type, filePath]);

        console.log(`Media record saved to database for donation ${donation_id}`);

        res.status(201).json({
            ...rows[0],
            url: filePath
        });
    } catch (error) {
        console.error('Error uploading media:', error);
        res.status(500).json({ error: 'Failed to upload media' });
    }
});

// Get media for a donation
router.get('/donation/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
      SELECT *
      FROM media
      WHERE donation_id = $1
      ORDER BY created_at ASC
    `;
        const { rows } = await req.app.locals.db.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching media:', error);
        res.status(500).json({ error: 'Failed to fetch media' });
    }
});

// Delete media
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Get media info first
        const getQuery = 'SELECT * FROM media WHERE id = $1';
        const getResult = await req.app.locals.db.query(getQuery, [id]);

        if (getResult.rows.length === 0) {
            return res.status(404).json({ error: 'Media not found' });
        }

        const media = getResult.rows[0];

        // If the file path is a Supabase URL, try to delete from Supabase
        if (media.file_path.includes('supabase.co')) {
            try {
                const filePath = media.file_path.split('/').slice(-2).join('/');
                await supabase.storage.from('media').remove([filePath]);
            } catch (supabaseError) {
                console.warn('Failed to delete from Supabase:', supabaseError);
            }
        }
        // If it's a local file, try to delete it
        else if (media.file_path.startsWith('/uploads/')) {
            const localPath = path.join(uploadsDir, path.basename(media.file_path));
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
        }

        // Delete from database
        const deleteQuery = 'DELETE FROM media WHERE id = $1';
        await req.app.locals.db.query(deleteQuery, [id]);

        res.json({ message: 'Media deleted successfully' });
    } catch (error) {
        console.error('Error deleting media:', error);
        res.status(500).json({ error: 'Failed to delete media' });
    }
});

module.exports = router;
