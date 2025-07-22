const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const db = require('../config/db');

// Make sure the uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const mediaController = {
    // Upload media (image or video)
    uploadMedia: async (req, res, next) => {
        try {
            const { donation_id, type } = req.body;
            const mediaData = req.body.media; // Base64 encoded file

            // Validate required fields
            if (!donation_id || !type || !mediaData) {
                return res.status(400).json({ message: 'Please provide all required fields' });
            }

            // Validate media type
            if (!['image', 'video'].includes(type)) {
                return res.status(400).json({ message: 'Type must be either "image" or "video"' });
            }

            // Extract file metadata
            const match = mediaData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

            if (!match) {
                return res.status(400).json({ message: 'Invalid media format' });
            }

            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Set appropriate file extension based on mime type
            let fileExtension;
            if (mimeType.startsWith('image/')) {
                fileExtension = mimeType.split('/')[1];
            } else if (mimeType.startsWith('video/')) {
                fileExtension = mimeType.split('/')[1];
            } else {
                return res.status(400).json({ message: 'Unsupported media type' });
            }

            // Generate unique filename
            const fileName = `${donation_id}_${type}_${uuidv4()}.${fileExtension}`;
            const filePath = path.join(uploadsDir, fileName);

            // Option 1: Save locally first
            fs.writeFileSync(filePath, buffer);

            // Option 2: Upload to Supabase Storage
            const supabasePath = `donations/${donation_id}/${fileName}`;
            let fileUrl = '';

            try {
                const { data, error } = await supabase.storage
                    .from('media')
                    .upload(supabasePath, buffer, {
                        contentType: mimeType,
                        upsert: false
                    });

                if (error) throw error;

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('media')
                    .getPublicUrl(supabasePath);

                fileUrl = urlData.publicUrl;
            } catch (uploadError) {
                console.error('Supabase upload failed:', uploadError);
                // If Supabase upload fails, we'll continue with local file storage
                fileUrl = `/uploads/${fileName}`;
            }

            // Save media record in the database
            const query = `
        INSERT INTO media (donation_id, type, file_path)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
            const values = [donation_id, type, fileUrl];
            const result = await db.query(query, values);

            res.status(201).json({
                ...result.rows[0],
                url: fileUrl
            });
        } catch (err) {
            next(err);
        }
    },

    // Get media by donation ID
    getMediaByDonationId: async (req, res, next) => {
        try {
            const { id } = req.params;

            const query = `
        SELECT *
        FROM media
        WHERE donation_id = $1
        ORDER BY created_at ASC
      `;
            const result = await db.query(query, [id]);

            res.status(200).json(result.rows);
        } catch (err) {
            next(err);
        }
    },

    // Delete media
    deleteMedia: async (req, res, next) => {
        try {
            const { id } = req.params;

            // Get media info first
            const getQuery = 'SELECT * FROM media WHERE id = $1';
            const getResult = await db.query(getQuery, [id]);

            if (getResult.rows.length === 0) {
                return res.status(404).json({ message: 'Media not found' });
            }

            const media = getResult.rows[0];

            // If file is in Supabase, delete it there
            if (media.file_path.includes('supabase')) {
                const pathParts = media.file_path.split('/');
                const fileName = pathParts[pathParts.length - 1];
                const supabasePath = `donations/${media.donation_id}/${fileName}`;

                await supabase.storage
                    .from('media')
                    .remove([supabasePath]);
            }
            // If file is local, delete it from filesystem
            else if (media.file_path.startsWith('/uploads/')) {
                const fileName = media.file_path.split('/').pop();
                const filePath = path.join(uploadsDir, fileName);

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Delete from database
            const deleteQuery = 'DELETE FROM media WHERE id = $1';
            await db.query(deleteQuery, [id]);

            res.status(200).json({ message: 'Media deleted successfully' });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = mediaController;
