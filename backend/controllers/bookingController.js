// backend/controllers/bookingController.js
const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const Listing = require('../models/Listing');
const User = require('../models/User');
const logger = require('../config/logger'); // Import Winston logger

// POST /api/bookings - Tenant creates a new booking request
exports.createBooking = async (req, res, next) => { // Added 'next'
    const tenantId = req.user.id;
    // Fields are now validated by createBookingValidationRules middleware
    const { listing_id, start_date, end_date } = req.body;

    try {
        // Removed: if (!listing_id || !start_date || !end_date)
        // Removed: if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime()))
        // Removed: if (startDateObj >= endDateObj)
        // Removed: if (startDateObj < new Date().setHours(0,0,0,0))
        const startDateObj = new Date(start_date); // Still need to convert from string to Date object
        const endDateObj = new Date(end_date);     // Still need to convert

        const listing = await Listing.findOne({
            where: { id: listing_id, status: 'active' }
        });
        if (!listing) {
            logger.warn(`Active listing ${listing_id} not found for booking creation.`);
            return res.status(404).json({ message: 'Active listing not found.' });
        }
        if (listing.owner_id === tenantId) { // Business logic check, keep this
            logger.warn(`User ${tenantId} attempted to book their own listing ${listing_id}.`);
            return res.status(403).json({ message: "You cannot book your own listing." });
        }
        const existingBooking = await Booking.findOne({ // Business logic check, keep this
            where: {
                listing_id: listing_id,
                status: { [Op.in]: ['pending', 'confirmed'] },
                [Op.or]: [
                    { start_date: { [Op.lt]: endDateObj }, end_date: { [Op.gt]: startDateObj } },
                ]
            }
        });
        if (existingBooking) {
            logger.warn(`Booking conflict for listing ${listing_id} on dates ${start_date}-${end_date}. Existing booking ${existingBooking.id}.`);
            return res.status(409).json({ message: 'The selected dates are not available or overlap with an existing booking.' });
        }
        const newBooking = await Booking.create({
            listing_id: listing_id,
            tenant_id: tenantId,
            start_date: startDateObj,
            end_date: endDateObj,
            status: 'pending'
        });
        const io = req.app.get('socketio');
        if (io && listing && listing.owner_id) {
            io.to(listing.owner_id.toString()).emit('new_booking_request_owner', {
                message: `New booking request for your listing '${listing.title}'.`,
                bookingId: newBooking.id,
                listingId: listing.id,
                listingTitle: listing.title,
                tenantId: tenantId
            });
            logger.info(`Emitted 'new_booking_request_owner' to owner ${listing.owner_id} for booking ${newBooking.id}`);
        }
        res.status(201).json({
            message: 'Booking request submitted successfully. Awaiting owner confirmation.',
            booking: newBooking
        });
    } catch (error) {
        logger.error("Error creating booking:", { tenantId, body: req.body, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};

// *** NEW FUNCTION: getOwnerBookings ***
exports.getOwnerBookings = async (req, res, next) => { // Added 'next'
    const ownerId = req.user.id;

    try {
        const ownerListings = await Listing.findAll({
            where: { owner_id: ownerId },
            attributes: ['id']
        });

        if (!ownerListings.length) {
            logger.info(`Owner ${ownerId} has no listings, returning empty bookings array.`);
            return res.status(200).json([]);
        }

        const listingIds = ownerListings.map(l => l.id);

        const bookings = await Booking.findAll({
            where: {
                listing_id: { [Op.in]: listingIds }
            },
            include: [
                {
                    model: Listing,
                    attributes: ['id', 'title', 'location']
                },
                {
                    model: User,
                    attributes: ['id', 'name', 'email']
                }
            ],
            order: [['status', 'ASC'], ['created_at', 'DESC']]
        });

        res.status(200).json(bookings);

    } catch (error) {
        logger.error("Error fetching owner bookings:", { ownerId, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};

// *** NEW FUNCTION: updateBookingStatus ***
exports.updateBookingStatus = async (req, res, next) => { // Added 'next'
    const ownerId = req.user.id;
    const { bookingId } = req.params;
    // `status` is validated by updateBookingStatusValidationRules middleware
    const { status } = req.body;

    try {
        // Removed: if (!['confirmed', 'rejected'].includes(status)) is now handled by validators

        const booking = await Booking.findByPk(bookingId, {
            include: {
                model: Listing,
                attributes: ['owner_id', 'title'] // Added title for notification
            }
        });

        if (!booking) {
            logger.warn(`Booking ${bookingId} not found for status update.`);
            return res.status(404).json({ message: "Booking not found." });
        }

        if (!booking.Listing || booking.Listing.owner_id !== ownerId) { // Business logic check, keep this
            logger.warn(`Owner ${ownerId} attempted to update booking ${bookingId} for a listing they don't own (listing owner: ${booking.Listing?.owner_id}).`);
            return res.status(403).json({ message: "Access denied. You do not own the listing for this booking." });
        }

        if (booking.status === 'confirmed' || booking.status === 'rejected') { // Business logic check, keep this
            logger.warn(`Attempted to change status for booking ${bookingId} which is already ${booking.status}.`);
            return res.status(400).json({ message: `Booking is already ${booking.status}.` });
        }

        if (status === 'confirmed') { // Business logic check, keep this
            const conflictingBooking = await Booking.findOne({
                where: {
                    id: { [Op.ne]: bookingId },
                    listing_id: booking.listing_id,
                    status: 'confirmed',
                    [Op.or]: [
                        { start_date: { [Op.lt]: booking.end_date }, end_date: { [Op.gt]: booking.start_date } },
                    ]
                }
            });

            if (conflictingBooking) {
                logger.warn(`Cannot confirm booking ${bookingId} due to date conflict with confirmed booking ${conflictingBooking.id} for listing ${booking.listing_id}.`);
                return res.status(409).json({
                    message: "Cannot confirm booking. Dates conflict with another confirmed booking for this listing."
                });
            }
        }

        // Set is_update_seen_by_tenant to false for new status changes
        if (status === 'confirmed' || status === 'rejected') {
            booking.is_update_seen_by_tenant = false;
        }

        booking.status = status;
        await booking.save();

        const io = req.app.get('socketio');
        if (io && booking.tenant_id) {
            io.to(booking.tenant_id.toString()).emit('booking_status_update_tenant', {
                message: `Booking for '${booking.Listing?.title}' is now ${status}.`,
                bookingId: booking.id,
                newStatus: status,
                listingId: booking.listing_id,
                tenantId: booking.tenant_id
            });
            logger.info(`Emitted 'booking_status_update_tenant' to tenant ${booking.tenant_id} for booking ${booking.id} (status: ${status}).`);
        }
        res.status(200).json({
            message: `Booking successfully ${status}.`,
            booking: booking
        });

    } catch (error) {
        logger.error("Error updating booking status:", { ownerId, bookingId, status, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};

exports.getMyBookings = async (req, res, next) => { // Added 'next'
    const tenantId = req.user.id;

    try {
        const bookings = await Booking.findAll({
            where: { tenant_id: tenantId },
            include: [
                {
                    model: Listing,
                    attributes: ['id', 'title', 'location'],
                    include: [{
                        model: User,
                        as: 'Owner',
                        attributes: ['id', 'name', 'email']
                    }]
                }
            ],
            order: [['start_date', 'DESC']]
        });

        res.status(200).json(bookings);

    } catch (error) {
        logger.error("Error fetching tenant bookings:", { tenantId, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};

exports.getOwnerPendingBookingsCount = async (req, res, next) => { // Added 'next'
    const ownerId = req.user.id;
    try {
        const ownerListings = await Listing.findAll({
            where: { owner_id: ownerId },
            attributes: ['id']
        });
        if (!ownerListings.length) {
            logger.info(`Owner ${ownerId} has no listings, pending booking count is 0.`);
            return res.status(200).json({ pendingCount: 0 });
        }
        const listingIds = ownerListings.map(l => l.id);

        const count = await Booking.count({
            where: {
                listing_id: { [Op.in]: listingIds },
                status: 'pending'
            }
        });
        res.status(200).json({ pendingCount: count });
    } catch (error) {
        logger.error('Error fetching owner pending bookings count:', { ownerId, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};