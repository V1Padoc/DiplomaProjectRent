// backend/controllers/bookingController.js
const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const Listing = require('../models/Listing');
const User = require('../models/User');

// POST /api/bookings - Tenant creates a new booking request (KEEP THIS)
exports.createBooking = async (req, res) => {
    // ... (your existing createBooking function remains unchanged)
    const tenantId = req.user.id;
    const { listing_id, start_date, end_date } = req.body;

    try {
        if (!listing_id || !start_date || !end_date) {
            return res.status(400).json({ message: 'Listing ID, start date, and end date are required.' });
        }
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(end_date);
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            return res.status(400).json({ message: 'Invalid date format.' });
        }
        if (startDateObj >= endDateObj) {
            return res.status(400).json({ message: 'End date must be after start date.' });
        }
        if (startDateObj < new Date().setHours(0,0,0,0)) {
            return res.status(400).json({ message: 'Start date cannot be in the past.' });
        }
        const listing = await Listing.findOne({
            where: { id: listing_id, status: 'active' }
        });
        if (!listing) {
            return res.status(404).json({ message: 'Active listing not found.' });
        }
        if (listing.owner_id === tenantId) {
            return res.status(403).json({ message: "You cannot book your own listing." });
        }
        const existingBooking = await Booking.findOne({
            where: {
                listing_id: listing_id,
                status: { [Op.in]: ['pending', 'confirmed'] },
                [Op.or]: [
                    { start_date: { [Op.lt]: endDateObj }, end_date: { [Op.gt]: startDateObj } },
                ]
            }
        });
        if (existingBooking) {
            return res.status(409).json({ message: 'The selected dates are not available or overlap with an existing booking.' });
        }
        const newBooking = await Booking.create({
            listing_id: listing_id,
            tenant_id: tenantId,
            start_date: startDateObj,
            end_date: endDateObj,
            status: 'pending'
        });
        res.status(201).json({
            message: 'Booking request submitted successfully. Awaiting owner confirmation.',
            booking: newBooking
        });
    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({ message: "Server error while creating booking." });
    }
};

// *** NEW FUNCTION: getOwnerBookings ***
exports.getOwnerBookings = async (req, res) => {
    const ownerId = req.user.id; // Authenticated owner's ID

    try {
        // Find all listings owned by the current user
        const ownerListings = await Listing.findAll({
            where: { owner_id: ownerId },
            attributes: ['id'] // We only need the IDs of their listings
        });

        if (!ownerListings.length) {
            return res.status(200).json([]); // Owner has no listings, so no bookings
        }

        const listingIds = ownerListings.map(l => l.id);

        // Find all bookings associated with these listing IDs
        const bookings = await Booking.findAll({
            where: {
                listing_id: { [Op.in]: listingIds }
            },
            include: [
                {
                    model: Listing,
                    attributes: ['id', 'title', 'location'] // Include some listing details
                },
                {
                    model: User, // This is the Tenant User model (Booking.belongsTo(User, { foreignKey: 'tenant_id' }))
                    attributes: ['id', 'name', 'email'] // Include tenant details
                }
            ],
            order: [['status', 'ASC'], ['created_at', 'DESC']] // Show pending first, then by date
        });

        res.status(200).json(bookings);

    } catch (error) {
        console.error("Error fetching owner bookings:", error);
        res.status(500).json({ message: "Server error while fetching owner bookings." });
    }
};

// *** NEW FUNCTION: updateBookingStatus ***
exports.updateBookingStatus = async (req, res) => {
    const ownerId = req.user.id;
    const { bookingId } = req.params; // Get bookingId from URL parameter
    const { status } = req.body; // Expected new status: 'confirmed' or 'rejected'

    try {
        // 1. Validate new status
        if (!['confirmed', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status. Must be 'confirmed' or 'rejected'." });
        }

        // 2. Find the booking and ensure it belongs to a listing owned by the current user
        const booking = await Booking.findByPk(bookingId, {
            include: {
                model: Listing,
                attributes: ['owner_id'] // Need owner_id of the listing
            }
        });

        if (!booking) {
            return res.status(404).json({ message: "Booking not found." });
        }

        // Check if the authenticated user owns the listing associated with this booking
        if (!booking.Listing || booking.Listing.owner_id !== ownerId) {
            return res.status(403).json({ message: "Access denied. You do not own the listing for this booking." });
        }

        // 3. Check if the booking is already 'confirmed' or 'rejected' (optional, depends on rules)
        if (booking.status === 'confirmed' || booking.status === 'rejected') {
            return res.status(400).json({ message: `Booking is already ${booking.status}.` });
        }
        
        // 4. If confirming, check for conflicts with other *confirmed* bookings
        if (status === 'confirmed') {
            const conflictingBooking = await Booking.findOne({
                where: {
                    id: { [Op.ne]: bookingId }, // Exclude the current booking
                    listing_id: booking.listing_id,
                    status: 'confirmed', // Only check against other *confirmed* bookings
                    [Op.or]: [
                        { start_date: { [Op.lt]: booking.end_date }, end_date: { [Op.gt]: booking.start_date } },
                    ]
                }
            });

            if (conflictingBooking) {
                return res.status(409).json({
                    message: "Cannot confirm booking. Dates conflict with another confirmed booking for this listing."
                });
            }
        }


        // 5. Update the booking status
        booking.status = status;
        await booking.save();

        // Optional: If confirming, you might want to auto-reject other pending bookings
        // for the same listing that now conflict with this newly confirmed booking.
        // This can be complex and depends on business logic. For now, we'll skip this.

        res.status(200).json({
            message: `Booking successfully ${status}.`,
            booking: booking
        });

    } catch (error) {
        console.error("Error updating booking status:", error);
        res.status(500).json({ message: "Server error while updating booking status." });
    }
};

exports.getMyBookings = async (req, res) => {
    const tenantId = req.user.id; // Authenticated tenant's ID

    try {
        const bookings = await Booking.findAll({
            where: { tenant_id: tenantId },
            include: [
                {
                    model: Listing,
                    attributes: ['id', 'title', 'location'], // Include some listing details
                    include: [{ // Include the owner of the listing
                        model: User,
                        as: 'Owner', // Make sure this alias matches your Listing model definition
                        attributes: ['id', 'name', 'email']
                    }]
                }
                // No need to include User (tenant) model again as it's the current user
            ],
            order: [['start_date', 'DESC']] // Show most recent start dates first
        });

        res.status(200).json(bookings);

    } catch (error) {
        console.error("Error fetching tenant bookings:", error);
        res.status(500).json({ message: "Server error while fetching tenant bookings." });
    }
};