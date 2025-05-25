// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const profileUpload = require('../config/multerProfileConfig'); // We'll create this

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


module.exports = router;