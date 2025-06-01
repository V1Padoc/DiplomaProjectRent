// backend/controllers/messageController.js

const { Op } = require('sequelize');
const Message = require('../models/Message');
const User = require('../models/User');
const Listing = require('../models/Listing');

// *** MODIFIED FUNCTION: getMessagesByListingId ***
exports.getMessagesByListingId = async (req, res) => {
  const listingId = req.params.listingId;    // From URL path
  const currentUserId = req.user.id;         // Authenticated user
  const { otherUserId } = req.query;       // Optional: From URL query (?otherUserId=...)

  try {
    const listing = await Listing.findByPk(listingId, {
        attributes: ['id', 'owner_id']
    });

    if (!listing) {
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
        console.log(`Owner (ID: ${currentUserId}) accessing chat for listing ${listingId} without specifying other participant.`);
        return res.status(200).json([]); // No specific chat thread targeted by owner
    }

    const messages = await Message.findAll({
      where: queryConditions,
      order: [['created_at', 'ASC']],
      include: [
         { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url'] }, // ADDED profile_photo_url
         { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url'] } // ADDED profile_photo_url
       ],
       attributes: { include: ['is_read'] } // Ensure is_read is included
    });
    res.status(200).json(messages);

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error while fetching messages.' });
  }
};

// Keep createMessage as is. It already correctly uses receiver_id from the body if provided.
exports.createMessage = async (req, res) => {
  const senderId = req.user.id;
  const { listing_id, content, receiver_id: bodyReceiverId } = req.body; // Renamed to avoid conflict

  try {
    if (!listing_id || !content) {
      return res.status(400).json({ message: 'Please provide listing ID and message content.' });
    }

    const listing = await Listing.findByPk(listing_id, {
        attributes: ['id', 'owner_id']
    });

    if (!listing) {
        return res.status(404).json({ message: 'Listing not found.' });
    }

    let actualReceiverId;

    if (senderId === listing.owner_id) {
         // Owner is sending. Frontend MUST provide the specific receiver_id (tenant ID).
         if (!bodyReceiverId) {
             return res.status(400).json({ message: 'Receiver ID is required when the owner sends a message.' });
         }
         actualReceiverId = bodyReceiverId;
    } else {
        // Non-owner (tenant) is sending. Receiver is always the listing owner.
        actualReceiverId = listing.owner_id;
    }

     if (senderId === actualReceiverId) { // Ensure it's parsed as number if necessary
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
            { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url'] }, // ADDED
            { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url'] } // ADDED
        ]
    });

    const io = req.app.get('socketio'); // Get io instance
    if (io) {
        console.log(`Emitting 'new_message_notification' to room: ${actualReceiverId.toString()}`)
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
         console.log(`Emitting 'message_sent_confirmation' to room: ${senderId.toString()}`)
    } else {
      console.warn("Socket.IO instance not available. Real-time events not emitted for new message.");
    }

    res.status(201).json({
      message: 'Message sent successfully!',
      newMessage: messageWithUsers // Use 'newMessage' key for clarity
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Server error during message creation.' });
  }
};


// Keep getMyChats as is.
exports.getMyChats = async (req, res) => {
    const userId = req.user.id; 

    try {
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
                    attributes: ['id', 'title', 'owner_id'],
                },
               { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url'] }, // ADDED
                { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url'] } // ADDED
            ],
            order: [['created_at', 'DESC']] // Changed to 'created_at' and descending order
        });

        if (!allUserMessages || allUserMessages.length === 0) {
            return res.status(200).json([]); 
        }

        const conversationsMap = new Map();

        // Use for...of loop to correctly await inside the loop
        for (const message of allUserMessages) {
            const otherUser = message.sender_id === userId ? message.Receiver : message.Sender;
            const listing = message.Listing;

            if (!otherUser || !listing) {
                console.warn(`Message ID ${message.id} is missing related User or Listing data. Skipping.`);
                continue; // Use continue for for...of loop
            }
            const conversationKey = `${listing.id}-${otherUser.id}`;

            if (!conversationsMap.has(conversationKey)) {
                // Calculate unread count for current user for this specific conversation
                const unreadCountForCurrentUser = await Message.count({
                    where: {
                        listing_id: listing.id,
                        sender_id: otherUser.id, // Messages sent by the other participant
                        receiver_id: userId,     // And received by the current user
                        is_read: false           // And are unread
                    }
                });

                conversationsMap.set(conversationKey, {
                    listingId: listing.id,
                    listingTitle: listing.title,
                    isCurrentUserListingOwner: listing.owner_id === userId, 
                    otherParticipant: {
                        id: otherUser.id,
                        name: otherUser.name,
                        email: otherUser.email,
                        profile_photo_url: otherUser.profile_photo_url // ADDED
                    },
                    lastMessage: {
                        id: message.id, // Good to have message ID
                        content: message.content,
                        timestamp: message.created_at, // Use created_at from model
                        senderId: message.sender_id, 
                        isReadByReceiver: message.receiver_id === userId ? message.is_read : (message.sender_id === userId ? true : null) // is_read relevant if current user is receiver
                    },
                    unreadCountForCurrentUser // <-- ADDED
                });
            }
        }

        const conversations = Array.from(conversationsMap.values());
        // Sort by last message timestamp (already handled by initial query order, but re-sort for safety)
        conversations.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));

        res.status(200).json(conversations);

    } catch (error) {
        console.error('Error fetching user chats:', error);
        res.status(500).json({ message: 'Server error while fetching chats.' });
    }
};

exports.getTotalUnreadCount = async (req, res) => {
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
        console.error('Error fetching total unread message count:', error);
        res.status(500).json({ message: 'Server error while fetching unread count.' });
    }
};

exports.markMessagesAsRead = async (req, res) => {
    const currentUserId = req.user.id;
    // chatPartnerId is the ID of the user who sent the messages to the current user
    const { listingId, chatPartnerId } = req.body;

    if (!listingId || !chatPartnerId) {
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
         }

        res.status(200).json({ message: `${updatedCount} messages marked as read.`, count: updatedCount });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ message: 'Server error while marking messages as read.' });
    }
};