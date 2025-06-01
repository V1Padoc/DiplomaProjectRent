// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController'); // We'll create this
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware'); // Use the isAdmin middleware

// GET /api/admin/listings - Admin fetches listings for moderation (e.g., all or by status)
router.get(
    '/listings',
    authMiddleware,
    isAdmin,
    adminController.getAdminListings
);

// PUT /api/admin/listings/:listingId/status - Admin approves or rejects a listing
router.put(
    '/listings/:listingId/status',
    authMiddleware,
    isAdmin,
    adminController.updateListingStatusByAdmin
);
router.get(
    '/tasks-count', // This path, when router is mounted at /api/admin, becomes /api/admin/tasks-count
    authMiddleware,
    isAdmin,
    adminController.getAdminPendingListingsCount // Ensure this controller function exists and is correctly named
);
// We can add user management routes here later (e.g., GET /users, PUT /users/:id/block)

module.exports = router;