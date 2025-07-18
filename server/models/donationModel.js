const db = require('../config/db');

const donationModel = {
  // Get all donations
  getAllDonations: async () => {
    const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number,
             CASE 
               WHEN d.type = 'cow' THEN cg.id 
               ELSE NULL 
             END AS cow_group_id,
             (SELECT COUNT(*) FROM media m WHERE m.donation_id = d.id) AS media_count
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN cow_shares cs ON d.id = cs.donation_id
      LEFT JOIN cow_groups cg ON cs.cow_group_id = cg.id
      ORDER BY d.created_at DESC
    `;
    const result = await db.query(query);
    return result.rows;
  },

  // Get donation by ID
  getDonationById: async (id) => {
    const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number,
             CASE 
               WHEN d.type = 'cow' THEN cg.id 
               ELSE NULL 
             END AS cow_group_id,
             (SELECT COUNT(*) FROM media m WHERE m.donation_id = d.id) AS media_count
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN cow_shares cs ON d.id = cs.donation_id
      LEFT JOIN cow_groups cg ON cs.cow_group_id = cg.id
      WHERE d.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Create new donation
  createDonation: async (donation) => {
    const { donor_id, price, type } = donation;

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert the donation
      const donationQuery = `
        INSERT INTO donations (donor_id, price, type)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const donationResult = await client.query(donationQuery, [donor_id, price, type]);
      const newDonation = donationResult.rows[0];

      // If this is a cow donation, handle cow sharing logic
      if (type === 'cow') {
        // Find an existing cow group with less than 7 shares
        const cowGroupQuery = `
          SELECT cg.id, COUNT(cs.donation_id) AS share_count
          FROM cow_groups cg
          LEFT JOIN cow_shares cs ON cg.id = cs.cow_group_id
          GROUP BY cg.id
          HAVING COUNT(cs.donation_id) < 7
          ORDER BY COUNT(cs.donation_id) DESC
          LIMIT 1
        `;
        const cowGroupResult = await client.query(cowGroupQuery);

        let cowGroupId;

        // If no group exists or all groups are full, create a new one
        if (cowGroupResult.rows.length === 0) {
          const newGroupQuery = `
            INSERT INTO cow_groups DEFAULT VALUES RETURNING id
          `;
          const newGroupResult = await client.query(newGroupQuery);
          cowGroupId = newGroupResult.rows[0].id;
        } else {
          cowGroupId = cowGroupResult.rows[0].id;
        }

        // Add this donation to the cow group
        const cowShareQuery = `
          INSERT INTO cow_shares (donation_id, cow_group_id)
          VALUES ($1, $2)
          RETURNING *
        `;
        await client.query(cowShareQuery, [newDonation.id, cowGroupId]);
      }

      await client.query('COMMIT');

      return newDonation;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Update donation status
  updateDonationStatus: async (id, status, completedAt = null) => {
    let query;
    let params;

    if (completedAt) {
      query = `
        UPDATE donations
        SET status = $1, completed_at = $2
        WHERE id = $3
        RETURNING *
      `;
      params = [status, completedAt, id];
    } else {
      query = `
        UPDATE donations
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      params = [status, id];
    }

    const result = await db.query(query, params);
    return result.rows[0];
  },

  // Delete donation
  deleteDonation: async (id) => {
    const query = 'DELETE FROM donations WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Get donations by status
  getDonationsByStatus: async (status) => {
    const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.id
      WHERE d.status = $1
      ORDER BY d.created_at ASC
    `;
    const result = await db.query(query, [status]);
    return result.rows;
  },

  // Get pending cow shares count
  getPendingCowSharesCount: async () => {
    const query = `
      SELECT COUNT(*) AS count
      FROM donations
      WHERE type = 'cow' AND status = 'pending'
    `;
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  },

  // Get pending sheep count
  getPendingSheepCount: async () => {
    const query = `
      SELECT COUNT(*) AS count
      FROM donations
      WHERE type = 'sheep' AND status = 'pending'
    `;
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  },

  // Get donations by agent
  getDonationsByAgentId: async (agentId) => {
    const query = `
      SELECT d.*, 
             dn.first_name, dn.last_name, dn.whatsapp_number,
             CASE 
               WHEN d.type = 'cow' THEN cg.id 
               ELSE NULL 
             END AS cow_group_id
      FROM agent_donations ad
      JOIN donations d ON ad.donation_id = d.id
      JOIN donors dn ON d.donor_id = dn.id
      LEFT JOIN cow_shares cs ON d.id = cs.donation_id
      LEFT JOIN cow_groups cg ON cs.cow_group_id = cg.id
      WHERE ad.agent_id = $1
      ORDER BY d.created_at ASC
    `;
    const result = await db.query(query, [agentId]);
    return result.rows;
  }
};

module.exports = donationModel;
