// backend/controllers/messageController.js

const { Op, Sequelize } = require('sequelize'); // Added Sequelize for fn
const Message = require('../models/Message');
const User = require('../models/User');
const Listing = require('../models/Listing');
const logger = require('../config/logger'); // Import Winston logger

// *** MODIFIED FUNCTION: getMessagesByListingId ***
exports.getMessagesByListingId = async (req, res, next) => { // Added 'next'
  const listingId = req.params.listingId;    // From URL path
  const currentUserId = req.user.id;         // Authenticated user
  const { otherUserId } = req.query;       // Optional: From URL query (?otherUserId=...)

  try {
    const listing = await Listing.findByPk(listingId, {
        attributes: ['id', 'owner_id']
    });

    if (!listing) {
        logger.warn(`Attempt to fetch messages for non-existent listing: ${listingId}`);
        return res.status(404).json({ message: 'Listing not found.' });
    }

    let queryConditions = {
        listing_id: listingId,
    };

    if (currentUserId === listing.owner_id && otherUserId) {
        // Case 1: Current user IS the owner AND a specific 'otherUserId' (tenant) is provided.
        // Fetch messages between owner (currentUserId) and this specific tenant (otherUserId).
        queryConditions[Op.or] = [
            { sender_id: currentUserId, receiver_id: otherUserId },
            { sender_id: otherUserId, receiver_id: currentUserId }
        ];
    } else if (currentUserId !== listing.owner_id) {
        // Case 2: Current user is NOT the owner (i.e., a tenant/buyer).
        // Fetch messages between this tenant (currentUserId) and the owner (listing.owner_id).
        queryConditions[Op.or] = [
            { sender_id: currentUserId, receiver_id: listing.owner_id },
            { sender_id: listing.owner_id, receiver_id: currentUserId }
        ];
    } else {
        // Case 3: Current user IS the owner, but NO specific 'otherUserId' is provided.
        // This scenario is ambiguous for a direct chat page.
        // "My Chats" list handles discovery. If owner lands here without 'otherUserId',
        // it implies they aren't in a specific conversation context from "My Chats".
        // Option 1: Return empty (as no specific conversation is targeted by owner).
        // Option 2: Return all messages for this listing where owner is involved (could be many conversations). This is too broad for a single chat page.
        // Let's go with Option 1 for clarity on a 1-on-1 chat page.
        // MyChatsPage will pass otherUserId. ListingDetail page will implicitly mean chat with owner.
        logger.info(`Owner (ID: ${currentUserId}) accessing chat for listing ${listingId} without specifying other participant. Returning empty.`);
        return res.status(200).json([]); // No specific chat thread targeted by owner
    }

    const messages = await Message.findAll({
      where: queryConditions,
      order: [['created_at', 'ASC']],
      include: [
         { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url'] },
         { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url'] }
       ],
       attributes: { include: ['is_read'] } // Ensure is_read is included
    });
    res.status(200).json(messages);

  } catch (error) {
    logger.error('Error fetching messages:', { userId: req.user.id, listingId, otherUserId, error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
};

// Keep createMessage as is. It already correctly uses receiver_id from the body if provided.
exports.createMessage = async (req, res, next) => { // Added 'next'
  const senderId = req.user.id;
  const { listing_id, content, receiver_id: bodyReceiverId } = req.body; // Renamed to avoid conflict

  try {
    if (!listing_id || !content) {
      logger.warn('Missing listing ID or message content for new message creation.', { senderId, body: req.body });
      return res.status(400).json({ message: 'Please provide listing ID and message content.' });
    }

    const listing = await Listing.findByPk(listing_id, {
        attributes: ['id', 'owner_id']
    });

    if (!listing) {
        logger.warn(`Listing not found for message creation: ${listing_id}`);
        return res.status(404).json({ message: 'Listing not found.' });
    }

    let actualReceiverId;

    if (senderId === listing.owner_id) {
         // Owner is sending. Frontend MUST provide the specific receiver_id (tenant ID).
         if (!bodyReceiverId) {
             logger.warn('Receiver ID is required when owner sends a message.', { senderId, listing_id });
             return res.status(400).json({ message: 'Receiver ID is required when the owner sends a message.' });
         }
         actualReceiverId = bodyReceiverId;
    } else {
        // Non-owner (tenant) is sending. Receiver is always the listing owner.
        actualReceiverId = listing.owner_id;
    }

     if (senderId === actualReceiverId) { // Ensure it's parsed as number if necessary
         logger.warn('Attempt to send message to self detected.', { senderId, receiverId: actualReceiverId });
         return res.status(400).json({ message: 'Cannot send message to yourself.' });
     }

    const newMessage = await Message.create({
      listing_id: listing_id,
      sender_id: senderId,
      receiver_id: actualReceiverId, // Use the determined receiver ID
      content: content
    });

    const messageWithUsers = await Message.findByPk(newMessage.id, {
        include: [
            { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url'] },
            { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url'] }
        ]
    });

    const io = req.app.get('socketio'); // Get io instance
    if (io) {
        logger.debug(`Emitting 'new_message_notification' to room: ${actualReceiverId.toString()}`);
        io.to(actualReceiverId.toString()).emit('new_message_notification', {
            message: messageWithUsers, // Send the full message object
            listingId: listing_id,
            senderId: senderId,
        });
        // Notify sender (for other tabs/devices or UI update)
        io.to(senderId.toString()).emit('message_sent_confirmation', {
            message: messageWithUsers,
            listingId: listing_id,
            receiverId: actualReceiverId,
        });
        logger.debug(`Emitting 'message_sent_confirmation' to room: ${senderId.toString()}`);
    } else {
      logger.warn("Socket.IO instance not available. Real-time events not emitted for new message.");
    }

    res.status(201).json({
      message: 'Message sent successfully!',
      newMessage: messageWithUsers // Use 'newMessage' key for clarity
    });
  } catch (error) {
    logger.error('Error creating message:', { senderId: req.user.id, body: req.body, error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
};


exports.getMyChats = async (req, res, next) => { // Added 'next'
    const userId = req.user.id;

    try {
        // 1. Fetch all messages where the current user is either sender or receiver
        // Include associated data needed for conversation display.
        // Order by created_at DESC to easily pick the last message for each conversation later.
        const allUserMessages = await Message.findAll({
            where: {
                [Op.or]: [
                    { sender_id: userId },
                    { receiver_id: userId }
                ]
            },
            include: [
                {
                    model: Listing,
                    attributes: ['id', 'title', 'owner_id'], // Ensure owner_id is fetched
                    // Minimal include for Listing, can be expanded if more listing info needed on MyChats page
                },
                {
                    model: User,
                    as: 'Sender',
                    attributes: ['id', 'name', 'email', 'profile_photo_url']
                },
                {
                    model: User,
                    as: 'Receiver',
                    attributes: ['id', 'name', 'email', 'profile_photo_url']
                }
            ],
            order: [['created_at', 'DESC']] // Important for easily finding the last message
        });

        if (!allUserMessages || allUserMessages.length === 0) {
            logger.info(`No chats found for user ${userId}.`);
            return res.status(200).json([]);
        }

        // 2. Group messages into conversations and identify the last message for each.
        // Key: 'listingId-otherParticipantId'
        const conversationsMap = new Map();
        const conversationKeysForUnreadCount = []; // To store keys for fetching unread counts

        for (const message of allUserMessages) {
            const otherUser = message.sender_id === userId ? message.Receiver : message.Sender;
            const listing = message.Listing;

            // Basic check for data integrity
            if (!otherUser || !listing || !otherUser.id || !listing.id) {
                logger.warn(`Message ID ${message.id} is missing related User or Listing ID data. Skipping.`, { messageId: message.id, senderId: message.sender_id, receiverId: message.receiver_id });
                continue;
            }

            const conversationKey = `${listing.id}-${otherUser.id}`;

            if (!conversationsMap.has(conversationKey)) {
                conversationsMap.set(conversationKey, {
                    listingId: listing.id,
                    listingTitle: listing.title,
                    isCurrentUserListingOwner: listing.owner_id === userId,
                    otherParticipant: {
                        id: otherUser.id,
                        name: otherUser.name,
                        email: otherUser.email,
                        profile_photo_url: otherUser.profile_photo_url
                    },
                    // The first message encountered (due to DESC order) is the last message
                    lastMessage: {
                        id: message.id,
                        content: message.content,
                        // Standardize to use message.created_at
                        timestamp: message.created_at, // Sequelize provides this
                        senderId: message.sender_id,
                        is_read: message.is_read, // Pass the raw is_read status
                        receiverId: message.receiver_id // Useful for frontend logic
                    },
                    unreadCountForCurrentUser: 0 // Initialize, will be fetched next
                });
                conversationKeysForUnreadCount.push({
                    listing_id: listing.id,
                    other_user_id: otherUser.id // The one who sent messages TO the current user
                });
            }
        }

        // 3. Fetch unread counts for all relevant conversations in a single query
        if (conversationKeysForUnreadCount.length > 0) {
            const unreadCountsRaw = await Message.findAll({
                attributes: [
                    'listing_id',
                    'sender_id', // This is the 'other_user_id' from above
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'unreadMessages']
                ],
                where: {
                    receiver_id: userId,
                    is_read: false,
                    [Op.or]: conversationKeysForUnreadCount.map(ck => ({
                        listing_id: ck.listing_id,
                        sender_id: ck.other_user_id // Count messages sent BY other_user_id TO me
                    }))
                },
                group: ['listing_id', 'sender_id'],
                raw: true // Get plain objects
            });

            // Map these counts back to the conversationsMap
            unreadCountsRaw.forEach(uc => {
                const key = `${uc.listing_id}-${uc.sender_id}`; // sender_id here is the other participant
                if (conversationsMap.has(key)) {
                    conversationsMap.get(key).unreadCountForCurrentUser = parseInt(uc.unreadMessages, 10) || 0;
                }
            });
        }

        const conversations = Array.from(conversationsMap.values());
        // The conversations are already effectively sorted by last message timestamp
        // because we processed `allUserMessages` in 'created_at DESC' order and
        // took the first encountered message as the last one.

        res.status(200).json(conversations);

    } catch (error) {
        logger.error('Error fetching user chats:', { userId, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};

exports.getTotalUnreadCount = async (req, res, next) => { // Added 'next'
    const userId = req.user.id;
    try {
        const count = await Message.count({
            where: {
                receiver_id: userId,
                is_read: false
            }
        });
        res.status(200).json({ unreadCount: count });
    } catch (error) {
        logger.error('Error fetching total unread message count:', { userId, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};

exports.markMessagesAsRead = async (req, res, next) => { // Added 'next'
    const currentUserId = req.user.id;
    // chatPartnerId is the ID of the user who sent the messages to the current user
    const { listingId, chatPartnerId } = req.body;

    if (!listingId || !chatPartnerId) {
        logger.warn('Missing listing ID or chat partner ID for marking messages as read.', { currentUserId, body: req.body });
        return res.status(400).json({ message: 'Listing ID and Chat Partner ID are required.' });
    }

    try {
        const [updatedCount] = await Message.update(
            { is_read: true },
            {
                where: {
                    listing_id: listingId,
                    receiver_id: currentUserId,
                    sender_id: chatPartnerId,
                    is_read: false // Only mark unread messages as read
                }
            }
        );
        logger.info(`${updatedCount} messages marked as read for user ${currentUserId} in listing ${listingId} from chat partner ${chatPartnerId}.`);

        // Optionally, emit an event if other clients of the same user need to know
         const io = req.app.get('socketio');
         if (io) {
             io.to(currentUserId.toString()).emit('messages_read_update', {
                 listingId,
                 chatPartnerId,
                 updatedCount // Number of messages actually marked as read
             });
             // Also notify the chat partner that their messages have been read
             io.to(chatPartnerId.toString()).emit('partner_messages_read', {
                 listingId,
                 readerId: currentUserId
             });
             logger.debug(`Emitted messages_read_update to ${currentUserId} and partner_messages_read to ${chatPartnerId}.`);
         }

        res.status(200).json({ message: `${updatedCount} messages marked as read.`, count: updatedCount });
    } catch (error) {
        logger.error('Error marking messages as read:', { currentUserId, listingId, chatPartnerId, error: error.message, stack: error.stack });
        next(error); // Pass to centralized error handler
    }
};