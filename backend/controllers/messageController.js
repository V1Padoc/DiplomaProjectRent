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
       ]
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
    res.status(201).json({
      message: 'Message sent successfully!',
      message: messageWithUsers
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
            order: [['listing_id', 'ASC'], ['createdAt', 'DESC']] 
        });

        if (!allUserMessages || allUserMessages.length === 0) {
            return res.status(200).json([]); 
        }

        const conversationsMap = new Map();

        allUserMessages.forEach(message => {
            const otherUser = message.sender_id === userId ? message.Receiver : message.Sender;
            const listing = message.Listing;

            if (!otherUser || !listing) {
                console.warn(`Message ID ${message.id} is missing related User or Listing data. Skipping.`);
                return; 
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
                        profile_photo_url: otherUser.profile_photo_url // ADDED
                    },
                    lastMessage: {
                        content: message.content,
                        timestamp: message.createdAt,
                        senderId: message.sender_id 
                    },
                });
            }
        });

        const conversations = Array.from(conversationsMap.values());
        conversations.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));

        res.status(200).json(conversations);

    } catch (error) {
        console.error('Error fetching user chats:', error);
        res.status(500).json({ message: 'Server error while fetching chats.' });
    }
};