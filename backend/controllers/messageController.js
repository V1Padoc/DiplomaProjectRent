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
        // Case 2: Current user is NOT the owner (i.e., a tenant/buyer/admin).
        // Fetch messages between this user (currentUserId) and the owner (listing.owner_id),
        // OR, if otherUserId is provided (e.g. admin chatting with owner), use that.
        // The crucial part for admin-owner chat is that `otherUserId` in the query params
        // should be the admin if the owner is viewing, or the owner if the admin is viewing.
        // The current logic handles this correctly by ensuring the chat is between currentUserId and listing.owner_id
        // OR currentUserId and a specific otherUserId if currentUserId is the owner.
        // For admin (currentUserId) chatting with owner (otherUserId = listing.owner_id), this will be:
        const partnerIdForChat = otherUserId || listing.owner_id; // Ensure we have a partner
        queryConditions[Op.or] = [
            { sender_id: currentUserId, receiver_id: partnerIdForChat },
            { sender_id: partnerIdForChat, receiver_id: currentUserId }
        ];
    } else {
        // Case 3: Current user IS the owner, but NO specific 'otherUserId' is provided.
        console.log(`Owner (ID: ${currentUserId}) accessing chat for listing ${listingId} without specifying other participant.`);
        return res.status(200).json([]); // No specific chat thread targeted by owner
    }

    const messages = await Message.findAll({
      where: queryConditions,
      order: [['created_at', 'ASC']],
      include: [
         { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url'] },
         { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url'] }
       ],
       attributes: { include: ['is_read'] }
    });
    res.status(200).json(messages);

  } catch (error) {
    console.log('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error while fetching messages.' });
  }
};

// *** MODIFIED FUNCTION: createMessage ***
exports.createMessage = async (req, res) => {
  const senderId = req.user.id; // Authenticated user (could be admin, owner, or tenant)
  // const senderRole = req.user.role; // Available if your authMiddleware adds role to req.user
  const { listing_id, content, receiver_id: bodyReceiverId } = req.body;

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
         // Case 1: Owner is sending. Frontend MUST provide the specific receiver_id (tenant ID).
         if (!bodyReceiverId) {
             return res.status(400).json({ message: 'Receiver ID is required when the owner sends a message.' });
         }
         actualReceiverId = bodyReceiverId;
    } else {
        // Case 2: Sender is NOT the owner (could be a tenant sending to owner, or an admin sending to owner).
        if (bodyReceiverId) {
            // If a specific receiver_id is provided in the request body (e.g., an admin explicitly sending to the listing owner), use it.
            actualReceiverId = bodyReceiverId;
        } else {
            // If no specific receiver_id is provided by a non-owner,
            // assume it's a tenant messaging the listing owner by default.
            actualReceiverId = listing.owner_id;
        }
    }

     // Final check: Ensure the receiver is a valid user (exists)
     const receiverUser = await User.findByPk(actualReceiverId);
     if (!receiverUser) {
         return res.status(404).json({ message: 'Receiver not found.' });
     }

     if (senderId === parseInt(actualReceiverId, 10)) { // Ensure actualReceiverId is number for comparison
         return res.status(400).json({ message: 'Cannot send message to yourself.' });
     }

    const newMessage = await Message.create({
      listing_id: listing_id,
      sender_id: senderId,
      receiver_id: actualReceiverId, // Use the determined receiver ID
      content: content,
      // is_read will default to false, which is correct
    });

    const messageWithUsers = await Message.findByPk(newMessage.id, {
        include: [
            { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url', 'role'] }, // Added role
            { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url', 'role'] } // Added role
        ]
    });

    const io = req.app.get('socketio'); // Get io instance
    if (io) {
        // Notify the actual receiver
        io.to(actualReceiverId.toString()).emit('new_message_notification', {
            message: messageWithUsers,
            listingId: listing_id,
            senderId: senderId,
        });
        // Notify sender (for other tabs/devices or UI update)
        io.to(senderId.toString()).emit('message_sent_confirmation', {
            message: messageWithUsers,
            listingId: listing_id,
            receiverId: actualReceiverId,
        });
    } else {
      console.warn("Socket.IO instance not available. Real-time events not emitted for new message.");
    }

    res.status(201).json({
      message: 'Message sent successfully!',
      newMessage: messageWithUsers
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
               { model: User, as: 'Sender', attributes: ['id', 'name', 'email', 'profile_photo_url', 'role'] }, // Added role
                { model: User, as: 'Receiver', attributes: ['id', 'name', 'email', 'profile_photo_url', 'role'] } // Added role
            ],
            order: [['created_at', 'DESC']]
        });

        if (!allUserMessages || allUserMessages.length === 0) {
            return res.status(200).json([]); 
        }

        const conversationsMap = new Map();

        for (const message of allUserMessages) {
            const otherUser = message.sender_id === userId ? message.Receiver : message.Sender;
            const listing = message.Listing;

            if (!otherUser || !listing) {
                console.warn(`Message ID ${message.id} is missing related User or Listing data. Skipping.`);
                continue; 
            }
            const conversationKey = `${listing.id}-${otherUser.id}`;

            if (!conversationsMap.has(conversationKey)) {
                const unreadCountForCurrentUser = await Message.count({
                    where: {
                        listing_id: listing.id,
                        sender_id: otherUser.id, 
                        receiver_id: userId,     
                        is_read: false          
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
                        profile_photo_url: otherUser.profile_photo_url,
                        role: otherUser.role // Added role
                    },
                    lastMessage: {
                        id: message.id,
                        content: message.content,
                        timestamp: message.created_at,
                        senderId: message.sender_id, 
                        isReadByReceiver: message.receiver_id === userId ? message.is_read : (message.sender_id === userId ? true : null)
                    },
                    unreadCountForCurrentUser
                });
            }
        }

        const conversations = Array.from(conversationsMap.values());
        conversations.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));

        res.status(200).json(conversations);

    } catch (error) {
        console.log('Error fetching user chats:', error);
        res.status(500).json({ message: 'Server error while fetching chats.' });
    }
};

// Keep getTotalUnreadCount as is.
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
        console.log('Error fetching total unread message count:', error);
        res.status(500).json({ message: 'Server error while fetching unread count.' });
    }
};

// Keep markMessagesAsRead as is.
exports.markMessagesAsRead = async (req, res) => {
    const currentUserId = req.user.id;
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
                    is_read: false 
                }
            }
        );
         const io = req.app.get('socketio');
         if (io) {
             io.to(currentUserId.toString()).emit('messages_read_update', {
                 listingId,
                 chatPartnerId,
                 updatedCount
             });
             io.to(chatPartnerId.toString()).emit('partner_messages_read', {
                 listingId,
                 readerId: currentUserId
             });
         }

        res.status(200).json({ message: `${updatedCount} messages marked as read.`, count: updatedCount });
    } catch (error) {
        console.log('Error marking messages as read:', error);
        res.status(500).json({ message: 'Server error while marking messages as read.' });
    }
};