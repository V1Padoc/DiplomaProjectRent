// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');
// Define the POST route for user registration
router.post('/register', authController.register);

// --- Define the POST route for user login ---
// When a POST request comes to '/login' (relative to where this router is mounted),
// call the login function from the authController.
router.post('/login', authController.login); // <-- Add this line

router.get('/user', authMiddleware, authController.getUser);
router.get('/socket-eligibility', authMiddleware, authController.getSocketEligibility);

module.exports = router;