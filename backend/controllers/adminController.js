// backend/controllers/adminController.js
const Listing = require('../models/Listing');
const User = require('../models/User'); // For including owner info if needed
const { Op } = require('sequelize');

// GET /api/admin/listings - Admin fetches listings
exports.getAdminListings = async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    let whereClause = {};
    // If status is an empty string (from "All" filter option), this 'if' block is skipped,
    // and whereClause remains {}, so all listings are fetched (correct for "All").
    if (status && ['pending', 'active', 'rejected', 'archived'].includes(status)) {
        whereClause.status = status;
    } else if (status && status !== '') { // Catch invalid non-empty statuses
        return res.status(400).json({ message: "Invalid status filter value." });
    }

    try {
        // MODIFICATION: Add .unscoped() here to bypass default scopes and fetch all listings
        const { count, rows: listings } = await Listing.unscoped().findAndCountAll({
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
    const { status } = req.body; // New status: 'active', 'rejected', etc.
    const adminUserId = req.user.id; // Admin performing the action

    if (!['active', 'rejected', 'pending', 'archived'].includes(status)) { // Admin can set to more statuses
        return res.status(400).json({ message: "Invalid status provided." });
    }

    try {
        // MODIFICATION: Add .unscoped() here to ensure the listing can be found regardless of its current status
        const listing = await Listing.unscoped().findByPk(listingId);
        if (!listing) {
            return res.status(404).json({ message: "Listing not found." });
        }

        if (listing.status === status) {
             return res.status(400).json({ message: `Listing is already ${status}.`});
        }

        const previousStatus = listing.status; // Store current status before update

        listing.status = status;
        await listing.save();
        
        // Notify owner of the listing about status change (optional, good for UX)
 const io = req.app.get('socketio');
        if (io) {
            // Notify owner (your existing logic here is good)
            if (listing.owner_id && (status === 'active' || status === 'rejected' || previousStatus === 'pending')) {
                 io.to(listing.owner_id.toString()).emit('listing_status_updated_by_admin', {
                    // ... your payload ...
                });
            }
            
            // If the status change affects the pending count, notify all admins
            if (status === 'pending' || previousStatus === 'pending') { // If new status is pending OR old status was pending
                io.to('admin_room').emit('admin_pending_count_changed', { // Use this new event name
                    message: `Listing '${listing.title}' status changed by admin ${req.user.name}. Pending count may be affected.`,
                    listingId: listing.id,
                });
                console.log(`Emitted 'admin_pending_count_changed' to admin_room.`);
            }
        }


        res.status(200).json({
            message: `Listing status updated to ${status}.`,
            listing: listing // Send back the unscoped, updated listing
        });

    } catch (error) {
        console.error("Error updating listing status by admin:", error);
        res.status(500).json({ message: "Server error while updating listing status." });
    }
};

// GET /api/admin/tasks-count - Admin gets count of their pending tasks (e.g., listings)
exports.getAdminPendingListingsCount = async (req, res) => {
    try {
        const count = await Listing.count({
            where: { status: 'pending' }
        });
        res.status(200).json({ pendingListingsCount: count });
    } catch (error) {
        console.error("Error fetching admin's pending listings count:", error);
        res.status(500).json({ message: "Server error while fetching pending listings count." });
    }
};