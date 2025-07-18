const agentModel = require('../models/agentModel');
const donationModel = require('../models/donationModel');

const agentController = {
    // Get all agents
    getAllAgents: async (req, res, next) => {
        try {
            const agents = await agentModel.getAllAgents();
            res.status(200).json(agents);
        } catch (err) {
            next(err);
        }
    },

    // Get agent by ID
    getAgentById: async (req, res, next) => {
        try {
            const agent = await agentModel.getAgentById(req.params.id);
            if (!agent) {
                return res.status(404).json({ message: 'Agent not found' });
            }
            res.status(200).json(agent);
        } catch (err) {
            next(err);
        }
    },

    // Create new agent
    createAgent: async (req, res, next) => {
        try {
            const { agent_name } = req.body;

            // Validate required fields
            if (!agent_name) {
                return res.status(400).json({ message: 'Please provide agent name' });
            }

            const agent = await agentModel.createAgent(agent_name);
            res.status(201).json(agent);
        } catch (err) {
            next(err);
        }
    },

    // Update agent
    updateAgent: async (req, res, next) => {
        try {
            const { agent_name } = req.body;

            // Validate required fields
            if (!agent_name) {
                return res.status(400).json({ message: 'Please provide agent name' });
            }

            const agent = await agentModel.updateAgent(req.params.id, agent_name);

            if (!agent) {
                return res.status(404).json({ message: 'Agent not found' });
            }

            res.status(200).json(agent);
        } catch (err) {
            next(err);
        }
    },

    // Delete agent
    deleteAgent: async (req, res, next) => {
        try {
            const agent = await agentModel.deleteAgent(req.params.id);

            if (!agent) {
                return res.status(404).json({ message: 'Agent not found' });
            }

            res.status(200).json({ message: 'Agent deleted successfully' });
        } catch (err) {
            next(err);
        }
    },

    // Assign donations to agent
    assignDonationsToAgent: async (req, res, next) => {
        try {
            const { donation_ids } = req.body;

            // Validate required fields
            if (!donation_ids || !Array.isArray(donation_ids) || donation_ids.length === 0) {
                return res.status(400).json({ message: 'Please provide donation IDs array' });
            }

            const assignments = await agentModel.assignDonationsToAgent(req.params.id, donation_ids);
            res.status(200).json(assignments);
        } catch (err) {
            next(err);
        }
    },

    // Get donations assigned to agent
    getDonationsByAgentId: async (req, res, next) => {
        try {
            const result = await agentModel.getDonationsByAgentId(req.params.id);
            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    },

    // Split donations between agents
    splitDonationsBetweenAgents: async (req, res, next) => {
        try {
            const { agent_names } = req.body;

            // Validate required fields
            if (!agent_names || !Array.isArray(agent_names) || agent_names.length === 0) {
                return res.status(400).json({ message: 'Please provide agent names array' });
            }

            // Create agents if they don't exist
            const agents = [];
            for (const name of agent_names) {
                const agent = await agentModel.createAgent(name);
                agents.push(agent);
            }

            // Get pending sheep donations
            const pendingSheep = await donationModel.getDonationsByStatus('pending');
            const sheepDonationIds = pendingSheep
                .filter(d => d.type === 'sheep')
                .map(d => d.id);

            // Get pending cow groups
            const query = `
        SELECT DISTINCT cs.cow_group_id
        FROM cow_shares cs
        JOIN donations d ON cs.donation_id = d.id
        WHERE d.status = 'pending'
        GROUP BY cs.cow_group_id
        HAVING COUNT(cs.donation_id) = 7
      `;
            const result = await db.query(query);
            const cowGroupIds = result.rows.map(row => row.cow_group_id);

            // Split donations between agents
            await agentModel.splitDonationsBetweenAgents(agents, sheepDonationIds, cowGroupIds);

            res.status(200).json({
                message: 'Donations split successfully',
                agents,
                sheepCount: sheepDonationIds.length,
                cowGroupsCount: cowGroupIds.length
            });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = agentController;
