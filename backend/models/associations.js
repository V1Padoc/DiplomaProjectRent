// backend/models/associations.js

const User = require('./User');
const Listing = require('./Listing');
const Booking = require('./Booking');
const Review = require('./Review');
const Message = require('./Message');
const Analytics = require('./Analytics'); // Corrected require

// User and Listing
User.hasMany(Listing, { foreignKey: 'owner_id', as: 'Listings' });
Listing.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });

// User and Booking
User.hasMany(Booking, { foreignKey: 'tenant_id', as: 'Bookings' });
Booking.belongsTo(User, { foreignKey: 'tenant_id', as: 'Tenant' }); // Corrected: Booking belongs to a Tenant (User)

// Listing and Booking
Listing.hasMany(Booking, { foreignKey: 'listing_id', as: 'Bookings' });
Booking.belongsTo(Listing, { foreignKey: 'listing_id', as: 'Listing' });

// User and Review
User.hasMany(Review, { foreignKey: 'user_id', as: 'Reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

// Listing and Review
Listing.hasMany(Review, { foreignKey: 'listing_id', as: 'Reviews' });
Review.belongsTo(Listing, { foreignKey: 'listing_id', as: 'Listing' });

// User and Message
User.hasMany(Message, { foreignKey: 'sender_id', as: 'SentMessages' });
User.hasMany(Message, { foreignKey: 'receiver_id', as: 'ReceivedMessages' });
Message.belongsTo(User, { as: 'Sender', foreignKey: 'sender_id' });
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'receiver_id' });

// Listing and Message
Listing.hasMany(Message, { foreignKey: 'listing_id', as: 'Messages' });
Message.belongsTo(Listing, { foreignKey: 'listing_id', as: 'Listing' });

// Listing and Analytics
Listing.hasOne(Analytics, { foreignKey: 'listing_id', as: 'Analytics' });
Analytics.belongsTo(Listing, { foreignKey: 'listing_id', as: 'Listing' });

// Correction for Booking and User (Owner perspective)
Booking.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
User.hasMany(Booking, { foreignKey: 'owner_id', as: 'BookingRequests' });

console.log("Database associations have been set up.");