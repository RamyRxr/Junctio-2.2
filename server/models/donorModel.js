const db = require('../config/db');

const donorModel = {
    // Get all donors
    getAllDonors: async () => {
        const query = `
      SELECT d.*, 
             COUNT(dn.id) AS donation_count,
             SUM(CASE WHEN dn.status = 'done' THEN 1 ELSE 0 END) AS completed_donations
      FROM donors d
      LEFT JOIN donations dn ON d.id = dn.donor_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
        const result = await db.query(query);
        return result.rows;
    },

    // Get donor by ID
    getDonorById: async (id) => {
        const query = `
      SELECT d.*, 
             COUNT(dn.id) AS donation_count,
             SUM(CASE WHEN dn.status = 'done' THEN 1 ELSE 0 END) AS completed_donations
      FROM donors d
      LEFT JOIN donations dn ON d.id = dn.donor_id
      WHERE d.id = $1
      GROUP BY d.id
    `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    },

    // Create new donor
    createDonor: async (donor) => {
        const { first_name, last_name, whatsapp_number } = donor;
        const query = `
      INSERT INTO donors (first_name, last_name, whatsapp_number)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        const result = await db.query(query, [first_name, last_name, whatsapp_number]);
        return result.rows[0];
    },

    // Update donor
    updateDonor: async (id, donor) => {
        const { first_name, last_name, whatsapp_number } = donor;
        const query = `
      UPDATE donors
      SET first_name = $1, last_name = $2, whatsapp_number = $3
      WHERE id = $4
      RETURNING *
    `;
        const result = await db.query(query, [first_name, last_name, whatsapp_number, id]);
        return result.rows[0];
    },

    // Delete donor
    deleteDonor: async (id) => {
        const query = 'DELETE FROM donors WHERE id = $1 RETURNING *';
        const result = await db.query(query, [id]);
        return result.rows[0];
    },

    // Get donations by donor ID
    getDonationsByDonorId: async (donorId) => {
        const query = `
      SELECT d.*, 
             m.id AS has_media
      FROM donations d
      LEFT JOIN media m ON d.id = m.donation_id
      WHERE d.donor_id = $1
      ORDER BY d.created_at DESC
    `;
        const result = await db.query(query, [donorId]);
        return result.rows;
    }
};

module.exports = donorModel;
