// backend/server.js
const http = require('http'); // Node's built-in HTTP module
const { Server } = require("socket.io"); // Correct import for Socket.IO Server class
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');


const sequelize = require('./config/database');

const generalRoutes = require('./routes/generalRoutes');
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');


// --- IMPORTANT: Require all your model files here ---
require('./models/User');
require('./models/Listing');
require('./models/Booking');
require('./models/Review');
require('./models/Message');
require('./models/Analytics');

const app = express();

const server = http.createServer(app);

// *** FIX: Now 'server' is defined and can be used to initialize Socket.IO ***
const io = new Server(server, { 
    cors: {
        origin: "http://localhost:3000", // Your frontend URL
        methods: ["GET", "POST"]
    }
});

// Define Associations (Keep this block if you added it)
/*
const User = require('./models/User');
const Listing = require('./models/Listing');
// ... import other models
User.hasMany(Listing, { foreignKey: 'owner_id', as: 'Listings' });
Listing.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
// ... etc.
*/



// Middleware
app.use(cors());
app.use(express.json());

// --- Serve static files from the 'uploads' directory ---
// This middleware will serve files directly when requested
// The URL path will be /uploads, and it will map to the backend/uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // <-- Add this line

app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads/profiles')));

// Use the general routes
app.use('/api', generalRoutes);

// Use the authentication routes
app.use('/api/auth', authRoutes);

// Use the listing routes
app.use('/api/listings', listingRoutes);

app.use('/api/chats', chatRoutes);

app.use('/api/bookings', bookingRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/users', userRoutes);


io.on('connection', (socket) => {
    console.log('A user connected via WebSocket:', socket.id);

    // TODO: Implement proper authentication for WebSocket connections
    // ... (rest of your conceptual socket.io logic) ...

    socket.on('join_chat_room', (roomNameOrData) => {
        socket.join(roomNameOrData);
        console.log(`User ${socket.id} joined room ${roomNameOrData}`);
    });

    socket.on('send_message', async (messageData) => {
        console.log('Message received on server via WebSocket:', messageData);
        // TODO: Full implementation
    });

    socket.on('disconnect', () => {
        console.log('User disconnected via WebSocket:', socket.id);
    });
});
// Function to connect to the database and start the server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    // await sequelize.sync({ alter: true }); // Sync database schema if needed

    const PORT = process.env.PORT || 5000;
    // *** FIX: Use 'server.listen' because Socket.IO is attached to 'server' (the http.createServer instance) ***
    server.listen(PORT, () => {
        console.log(`Server with Socket.IO running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Unable to connect to the database, sync, or start server:', error);
    process.exit(1);
  }
}


startServer();