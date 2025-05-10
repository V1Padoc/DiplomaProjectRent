// --- START OF FILE server.js ---

const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables

// Import the sequelize instance from our config file
const sequelize = require('./config/database');

// --- IMPORTANT: Require all your model files here ---
// This ensures that the models are defined on the sequelize instance
require('./models/User');     // Adjust path if your models are elsewhere
require('./models/Listing');
require('./models/Booking');
require('./models/Review');
require('./models/Message');
require('./models/Analytics');
// Add a require line for EACH of your model files

const app = express();

// Middleware
app.use(cors()); // Allow cross-origin requests from the frontend
app.use(express.json()); // Parse JSON request bodies

// Function to connect to the database and start the server
async function startServer() {
  try {
    // Attempt to connect to the database
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Now that models are required, sequelize knows about them
    // *** Change this line to use force: true *** (Already there, keep it for first run)

    console.log('Database synchronized. Tables created/updated.');

    // Define port
    const PORT = process.env.PORT || 5000;

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Unable to connect to the database, sync, or start server:', error);
    process.exit(1);
  }
}

// Call the function to start the server
startServer();
// --- END OF FILE server.js ---