// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path'); // Import the 'path' module


const sequelize = require('./config/database');

const generalRoutes = require('./routes/generalRoutes');
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');


// --- IMPORTANT: Require all your model files here ---
require('./models/User');
require('./models/Listing');
require('./models/Booking');
require('./models/Review');
require('./models/Message');
require('./models/Analytics');

// Define Associations (Keep this block if you added it)
/*
const User = require('./models/User');
const Listing = require('./models/Listing');
// ... import other models
User.hasMany(Listing, { foreignKey: 'owner_id', as: 'Listings' });
Listing.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
// ... etc.
*/


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- Serve static files from the 'uploads' directory ---
// This middleware will serve files directly when requested
// The URL path will be /uploads, and it will map to the backend/uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // <-- Add this line


// Use the general routes
app.use('/api', generalRoutes);

// Use the authentication routes
app.use('/api/auth', authRoutes);

// Use the listing routes
app.use('/api/listings', listingRoutes);


// Function to connect to the database and start the server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // sequelize.sync({ force: false }); // Adjust or remove based on your sync needs

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Unable to connect to the database, sync, or start server:', error);
    process.exit(1);
  }
}

startServer();