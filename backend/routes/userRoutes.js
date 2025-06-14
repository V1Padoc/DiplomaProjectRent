// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const profileUpload = require('../config/multerProfileConfig'); // We'll create this
const favoriteController = require('../controllers/favoriteController');
// PUT /api/users/profile - Update current user's profile information
router.put(
    '/profile',
    authMiddleware,
    profileUpload.single('profilePhoto'), // Expect a single file from 'profilePhoto' field
    userController.updateUserProfile
);
router.post(
    '/change-password',
    authMiddleware, // Must be logged in
    userController.changePassword
);

router.get(
    '/public-profile/:userId', // :userId is a route parameter
    // No authMiddleware needed if profiles are truly public.
    // If you want to restrict viewing public profiles to logged-in users, add authMiddleware.
    userController.getPublicUserProfile 
);
router.get('/me/favorites', authMiddleware, favoriteController.getMyFavorites);
// Get only IDs of favorited listings (lighter for context state)
router.get('/me/favorites/ids', authMiddleware, favoriteController.getMyFavoriteIds);
router.post(
    '/me/favorites/:listingId', // To add a favorite
    authMiddleware,
    favoriteController.addFavorite
);
router.delete(
    '/me/favorites/:listingId', // To remove a favorite
    authMiddleware,
    favoriteController.removeFavorite
);

router.get(
    '/me/unread-booking-updates-count',
    authMiddleware, // Make sure this is present
    userController.getUnreadBookingUpdatesCountForTenant
);
router.put(
    '/me/acknowledge-booking-updates',
    authMiddleware, // Make sure this is present
    userController.acknowledgeBookingUpdatesForTenant
);
module.exports = router;