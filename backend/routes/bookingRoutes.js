// backend/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');
const { isTenant, isOwner } = require('../middleware/roleMiddleware');

// --- IMPORT VALIDATORS ---
const { 
  createBookingValidationRules, 
  updateBookingStatusValidationRules, 
  validate 
} = require('../validators/bookingValidators');


// POST /api/bookings - Tenant creates a new booking request (KEEP THIS)
router.post(
    '/',
    authMiddleware,
   // isTenant, // Role check can be complex; user might be owner booking another's place. Leave this to controller if specific checks are needed.
    createBookingValidationRules(), // Add validation rules
    validate,                       // Apply validation
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
    updateBookingStatusValidationRules(), // Add validation rules
    validate,                             // Apply validation
    bookingController.updateBookingStatus
);

router.get(
    '/my-bookings',
    authMiddleware,    
    bookingController.getMyBookings // We'll create this controller function
);

router.get(
    '/owner/pending-count',
    authMiddleware,
    isOwner,
    bookingController.getOwnerPendingBookingsCount // Add this controller function
);

module.exports = router;