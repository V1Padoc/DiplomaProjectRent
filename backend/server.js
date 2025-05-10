// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/database');

const generalRoutes = require('./routes/generalRoutes');
// Import the authentication routes we just created
const authRoutes = require('./routes/authRoutes'); // <-- Add this line

// --- IMPORTANT: Require all your model files here ---
require('./models/User');
require('./models/Listing');
require('./models/Booking');
require('./models/Review');
require('./models/Message');
require('./models/Analytics');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Use the general routes
app.use('/api', generalRoutes);

// --- Use the authentication routes ---
// This tells Express to use the authRoutes router for any request paths starting with /api/auth
app.use('/api/auth', authRoutes); // <-- Add this line

// Function to connect to the database and start the server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // IMPORTANT: After the *very first* time you run the server and the tables are created,
    // change `{ force: true }` to `{ force: false }` or comment out/remove sequelize.sync()
    // to prevent dropping your data every time the server starts.
    // If this is the first time creating tables, keep { force: true } for this run.
    // await sequelize.sync({ force: true }); // Adjust or remove based on whether tables exist
    // console.log('Database synchronized. Tables created/updated.');


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