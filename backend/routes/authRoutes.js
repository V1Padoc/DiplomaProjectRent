// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { registerValidationRules, validate } = require('../validators/authValidators'); // <--- ADD THIS

// Define the POST route for user registration
// MODIFIED: Added validation middleware
router.post('/register', registerValidationRules(), validate, authController.register);

// Define the POST route for user login
router.post('/login', authController.login); // Consider adding login validation rules too

router.get('/user', authMiddleware, authController.getUser);
router.get('/socket-eligibility', authMiddleware, authController.getSocketEligibility);

module.exports = router;