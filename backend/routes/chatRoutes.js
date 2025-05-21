// backend/routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController'); // We'll add getMyChats here
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/chats/my-chats - Fetches all distinct conversations for the authenticated user
router.get(
    '/my-chats',
    authMiddleware, // Requires authentication
    messageController.getMyChats // We will create this controller function next
);

module.exports = router;