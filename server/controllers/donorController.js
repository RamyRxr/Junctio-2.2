const donorModel = require('../models/donorModel');

const donorController = {
    // Get all donors
    getAllDonors: async (req, res, next) => {
        try {
            const donors = await donorModel.getAllDonors();
            res.status(200).json(donors);
        } catch (err) {
            next(err);
        }
    },

    // Get donor by ID
    getDonorById: async (req, res, next) => {
        try {
            const donor = await donorModel.getDonorById(req.params.id);
            if (!donor) {
                return res.status(404).json({ message: 'Donor not found' });
            }
            res.status(200).json(donor);
        } catch (err) {
            next(err);
        }
    },

    // Create new donor
    createDonor: async (req, res, next) => {
        try {
            const { first_name, last_name, whatsapp_number } = req.body;

            // Validate required fields
            if (!first_name || !last_name || !whatsapp_number) {
                return res.status(400).json({ message: 'Please provide all required fields' });
            }

            const donor = await donorModel.createDonor({ first_name, last_name, whatsapp_number });
            res.status(201).json(donor);
        } catch (err) {
            next(err);
        }
    },

    // Update donor
    updateDonor: async (req, res, next) => {
        try {
            const { first_name, last_name, whatsapp_number } = req.body;

            // Validate required fields
            if (!first_name || !last_name || !whatsapp_number) {
                return res.status(400).json({ message: 'Please provide all required fields' });
            }

            const donor = await donorModel.updateDonor(req.params.id, {
                first_name,
                last_name,
                whatsapp_number
            });

            if (!donor) {
                return res.status(404).json({ message: 'Donor not found' });
            }

            res.status(200).json(donor);
        } catch (err) {
            next(err);
        }
    },

    // Delete donor
    deleteDonor: async (req, res, next) => {
        try {
            const donor = await donorModel.deleteDonor(req.params.id);

            if (!donor) {
                return res.status(404).json({ message: 'Donor not found' });
            }

            res.status(200).json({ message: 'Donor deleted successfully' });
        } catch (err) {
            next(err);
        }
    },

    // Get donations by donor
    getDonationsByDonorId: async (req, res, next) => {
        try {
            const donations = await donorModel.getDonationsByDonorId(req.params.id);
            res.status(200).json(donations);
        } catch (err) {
            next(err);
        }
    }
};

module.exports = donorController;
