const donationModel = require('../models/donationModel');

const donationController = {
    // Get all donations
    getAllDonations: async (req, res, next) => {
        try {
            const donations = await donationModel.getAllDonations();
            res.status(200).json(donations);
        } catch (err) {
            next(err);
        }
    },

    // Get donation by ID
    getDonationById: async (req, res, next) => {
        try {
            const donation = await donationModel.getDonationById(req.params.id);
            if (!donation) {
                return res.status(404).json({ message: 'Donation not found' });
            }
            res.status(200).json(donation);
        } catch (err) {
            next(err);
        }
    },

    // Create new donation
    createDonation: async (req, res, next) => {
        try {
            const { donor_id, price, type } = req.body;

            // Validate required fields
            if (!donor_id || !price || !type) {
                return res.status(400).json({ message: 'Please provide all required fields' });
            }

            // Validate donation type
            if (type !== 'sheep' && type !== 'cow') {
                return res.status(400).json({ message: 'Type must be either "sheep" or "cow"' });
            }

            const donation = await donationModel.createDonation({ donor_id, price, type });
            res.status(201).json(donation);
        } catch (err) {
            next(err);
        }
    },

    // Update donation status
    updateDonationStatus: async (req, res, next) => {
        try {
            const { status } = req.body;

            // Validate status
            if (!status) {
                return res.status(400).json({ message: 'Please provide status' });
            }

            if (!['pending', 'sending', 'done'].includes(status)) {
                return res.status(400).json({ message: 'Status must be either "pending", "sending", or "done"' });
            }

            let completedAt = null;
            if (status === 'done') {
                completedAt = new Date().toISOString();
            }

            const donation = await donationModel.updateDonationStatus(req.params.id, status, completedAt);

            if (!donation) {
                return res.status(404).json({ message: 'Donation not found' });
            }

            res.status(200).json(donation);
        } catch (err) {
            next(err);
        }
    },

    // Delete donation
    deleteDonation: async (req, res, next) => {
        try {
            const donation = await donationModel.deleteDonation(req.params.id);

            if (!donation) {
                return res.status(404).json({ message: 'Donation not found' });
            }

            res.status(200).json({ message: 'Donation deleted successfully' });
        } catch (err) {
            next(err);
        }
    },

    // Get donations by status
    getDonationsByStatus: async (req, res, next) => {
        try {
            const { status } = req.params;

            // Validate status
            if (!['pending', 'sending', 'done'].includes(status)) {
                return res.status(400).json({ message: 'Status must be either "pending", "sending", or "done"' });
            }

            const donations = await donationModel.getDonationsByStatus(status);
            res.status(200).json(donations);
        } catch (err) {
            next(err);
        }
    },

    // Get counts for dashboard
    getDashboardCounts: async (req, res, next) => {
        try {
            // Get counts for sheep and cow donations
            const pendingSheepCount = await donationModel.getPendingSheepCount();
            const pendingCowSharesCount = await donationModel.getPendingCowSharesCount();

            const pendingCowGroups = Math.floor(pendingCowSharesCount / 7);
            const remainingCowShares = pendingCowSharesCount % 7;

            res.status(200).json({
                pendingSheepCount,
                pendingCowSharesCount,
                pendingCowGroups,
                remainingCowShares,
            });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = donationController;
