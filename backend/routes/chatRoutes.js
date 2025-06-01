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
router.get('/my-unread-count', authMiddleware, messageController.getTotalUnreadCount);

// New route to mark messages as read
router.put('/mark-as-read', authMiddleware, messageController.markMessagesAsRead);



router.get('/listing/:listingId', authMiddleware, messageController.getMessagesByListingId); // For fetching messages for a specific chat
router.post('/send', authMiddleware, messageController.createMessage);
module.exports = router;