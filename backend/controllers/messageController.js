// backend/controllers/messageController.js

const { Op } = require('sequelize'); 
const Message = require('../models/Message'); // Import the Message model
const User = require('../models/User');     // Import the User model (for includes)
const Listing = require('../models/Listing'); // Import the Listing model (to get owner_id for chat logic)


// Controller function to get messages for a specific listing for the authenticated user
// This requires authentication. Users can only see messages they sent or received for that listing.
exports.getMessagesByListingId = async (req, res) => {
  const listingId = req.params.listingId; // Get the listing ID from the route parameters
  const userId = req.user.id;           // Get the authenticated user's ID from req.user

  try {
    // Find the listing to get the owner's ID
    const listing = await Listing.findByPk(listingId, {
        attributes: ['id', 'owner_id'] // Only need the owner_id
    });

    if (!listing) {
        return res.status(404).json({ message: 'Listing not found.' });
    }

    // Determine the other participant in the chat.
    // If the authenticated user is the owner, the other participant is the one they are chatting with
    // about this listing. If the authenticated user is NOT the owner, the other participant is the owner.
    // We need a way to identify the specific conversation thread.
    // A simple approach for 1-on-1 chat per listing:
    // A conversation is between the listing owner and one other user (tenant/buyer).
    // The messages are either from owner to tenant/buyer or tenant/buyer to owner.
    // To get messages FOR a user on a listing, we need messages where:
    // (sender_id = userId AND receiver_id = listing.owner_id) OR (sender_id = listing.owner_id AND receiver_id = userId)

    // Find all messages related to this listing where the authenticated user is either sender or receiver
    const messages = await Message.findAll({
      where: {
        listing_id: listingId,
        [Op.or]: [ // Use Sequelize's OR operator
          { sender_id: userId, receiver_id: listing.owner_id },
          { sender_id: listing.owner_id, receiver_id: userId }
        ]
      },
      // Order messages by creation date (oldest first for chat flow)
      order: [['created_at', 'ASC']],
      // Include sender and receiver user details (optional but helpful)
       include: [
         { model: User, as: 'Sender', attributes: ['id', 'name', 'email'] },
         { model: User, as: 'Receiver', attributes: ['id', 'name', 'email'] }
       ]
    });

    // Send the fetched messages back as a JSON response
    res.status(200).json(messages);

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error while fetching messages.' });
  }
};


// Controller function to create a new message
// This requires authentication.
exports.createMessage = async (req, res) => {
  const senderId = req.user.id; // The authenticated user is the sender

  // Get the listing ID and content from the request body
  const { listing_id, content } = req.body;

  try {
    // Basic validation
    if (!listing_id || !content) {
      return res.status(400).json({ message: 'Please provide listing ID and message content.' });
    }

    // Find the listing to determine the receiver (the owner of the listing)
    const listing = await Listing.findByPk(listing_id, {
        attributes: ['id', 'owner_id'] // Only need the owner_id
    });

    if (!listing) {
        return res.status(404).json({ message: 'Listing not found.' });
    }

    // Determine the receiver ID.
    // If the sender is the owner of the listing, the receiver must be the other user
    // in the conversation about this listing. If the sender is NOT the owner, the receiver is the owner.
    // This logic needs to be robust to handle replies.
    // A simpler initial approach: assume the receiver is always the listing owner if the sender is not the owner.
    // If the sender IS the owner, you'd need context about WHICH user the owner is messaging.
    // For a simple 1-on-1 chat per listing between *an* interested user and the owner:
    // When a user (tenant/buyer) initiates a chat via the 'Contact Owner' button:
    // The FIRST message from the tenant/buyer to the owner defines the conversation.
    // Subsequent messages from owner to THAT tenant/buyer, or tenant/buyer to owner, are part of this.
    //
    // Let's simplify the initial implementation:
    // If the sender is the owner, they must specify the receiver_id in the request body.
    // If the sender is NOT the owner, the receiver is automatically the owner of the listing.

    let receiverId;
    if (senderId === listing.owner_id) {
        // Owner is sending the message. The frontend MUST provide the specific receiver ID.
        // This implies the owner is replying to a specific conversation thread with a tenant/buyer.
        // For now, let's assume the frontend sends receiver_id in the body if the sender is the owner.
         const { receiver_id } = req.body; // Expect receiver_id in body if sender is owner
         if (!receiver_id) {
             return res.status(400).json({ message: 'Receiver ID is required when the owner sends a message.' });
         }
         receiverId = receiver_id;
         // Optional: Add logic to ensure receiver_id is associated with this listing's chat historically
         // or is the user who initiated contact. This makes the chat robust.
         // For MVP, trust the frontend sends the correct receiver_id.

    } else {
        // A non-owner is sending the message. The receiver is the listing owner.
        receiverId = listing.owner_id;
    }

     // Prevent a user from messaging themselves on their own listing via this endpoint (optional)
     if (senderId === receiverId) {
         return res.status(400).json({ message: 'Cannot send message to yourself.' });
     }


    // Create the new message in the database
    const newMessage = await Message.create({
      listing_id: listing_id,
      sender_id: senderId,
      receiver_id: receiverId,
      content: content
    });

    // Fetch the created message with sender/receiver user details to send back
    const messageWithUsers = await Message.findByPk(newMessage.id, {
        include: [
            { model: User, as: 'Sender', attributes: ['id', 'name', 'email'] },
            { model: User, as: 'Receiver', attributes: ['id', 'name', 'email'] }
        ]
    });


    // If message creation is successful, send a success response
    res.status(201).json({
      message: 'Message sent successfully!',
      message: messageWithUsers // Send back the created message data with user info
    });

  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Server error during message creation.' });
  }
};