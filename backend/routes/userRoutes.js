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

module.exports = router;