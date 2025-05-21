// backend/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');
const { isTenant, isOwner } = require('../middleware/roleMiddleware');

// POST /api/bookings - Tenant creates a new booking request (KEEP THIS)
router.post(
    '/',
    authMiddleware,
    isTenant,
    bookingController.createBooking
);

// *** NEW: GET /api/bookings/owner - Owner views bookings for their listings ***
router.get(
    '/owner', // Fetches bookings related to listings owned by the authenticated user
    authMiddleware,
    isOwner,    // Only owners can access this
    bookingController.getOwnerBookings
);

// *** NEW: PUT /api/bookings/:bookingId/status - Owner updates booking status ***
router.put(
    '/:bookingId/status', // :bookingId is a route parameter
    authMiddleware,
    isOwner,    // Only owners can access this (further checks in controller ensure they own the listing)
    bookingController.updateBookingStatus
);
router.get(
    '/my-bookings',
    authMiddleware,
    isTenant,       // Only tenants can access this
    bookingController.getMyBookings // We'll create this controller function
);
// We will add GET /api/bookings/my-bookings (for tenants) later

module.exports = router;