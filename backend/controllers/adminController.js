// backend/controllers/adminController.js
const Listing = require('../models/Listing');
const User = require('../models/User'); // For including owner info if needed
const { Op } = require('sequelize');

// GET /api/admin/listings - Admin fetches listings
exports.getAdminListings = async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query; // Allow filtering by status

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClause = {};
    if (status) {
        if (['pending', 'active', 'rejected', 'archived'].includes(status)) {
            whereClause.status = status;
        } else {
            return res.status(400).json({ message: "Invalid status filter value." });
        }
    }

    try {
        const { count, rows: listings } = await Listing.findAndCountAll({
            where: whereClause,
            include: [{
                model: User,
                as: 'Owner',
                attributes: ['id', 'name', 'email']
            }],
            order: [['status', 'ASC'],['created_at', 'DESC']], // Pending first, then newest
            limit: parsedLimit,
            offset: offset,
        });

        res.status(200).json({
            totalItems: count,
            totalPages: Math.ceil(count / parsedLimit),
            currentPage: parseInt(page, 10),
            listings,
        });
    } catch (error) {
        console.error("Error fetching listings for admin:", error);
        res.status(500).json({ message: "Server error while fetching listings for admin." });
    }
};

// PUT /api/admin/listings/:listingId/status - Admin updates listing status
exports.updateListingStatusByAdmin = async (req, res) => {
    const { listingId } = req.params;
    const { status } = req.body; // New status: 'active', 'rejected'

    if (!['active', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'active' or 'rejected'." });
    }

    try {
        const listing = await Listing.findByPk(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        // Only allow updating from 'pending' to 'active' or 'rejected' by admin via this route
        // Or from 'active' to 'rejected' (e.g. if reported)
        // Or from 'rejected' to 'active' (e.g. if issue resolved)
        // More complex state transitions can be added if needed.
        if (listing.status === status) {
             return res.status(400).json({ message: `Listing is already ${status}.`});
        }


        listing.status = status;
        await listing.save();

        res.status(200).json({
            message: `Listing status updated to ${status}.`,
            listing: listing
        });

    } catch (error) {
        console.error("Error updating listing status by admin:", error);
        res.status(500).json({ message: "Server error while updating listing status." });
    }
};

// User management functions (getUsers, blockUser) will be added here later