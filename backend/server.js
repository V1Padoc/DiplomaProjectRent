// backend/server.js
const http = require('http'); // Node's built-in HTTP module
const { Server } = require("socket.io"); // Correct import for Socket.IO Server class
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken'); // <--- ADDED THIS
const User = require('./models/User'); // <--- ADDED THIS, ensure path is correct

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

// Make io instance accessible throughout the app via req.app.get('socketio')
app.set('socketio', io);

// Define Associations (Keep this block if you added it)
/*
const User = require('./models/User');
const Listing = require('./models/Listing');
// ... import other models
User.hasMany(Listing, { foreignKey: 'owner_id', as: 'Listings' });
Listing.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
// ... etc.
*/
const allowedOrigins = [
  'http://localhost:3000', // Для локальної розробки
  'https://diplomaprojectrent.onrender.com'   // Для продакшену на Render
];

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Дозволяємо запити, якщо їх джерело є у списку `allowedOrigins`,
    // або якщо запит не має джерела (наприклад, з Postman)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// --- Serve static files from the 'uploads' directory ---
// This middleware will serve files directly when requested
// The URL path will be /uploads, and it will map to the backend/uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // <-- Add this line

app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads/profiles')));

// --- Rate Limiting for Auth Routes ---  // <--- ADDED THIS SECTION
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 
  max: 30, // Limit each IP to 10 login/register requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the authLimiter to auth routes BEFORE they are used
// Note: If '/api/auth' routes include more than just login/register that you don't want limited this way,
// you might apply the limiter directly in authRoutes.js or to specific routes there.
// For now, applying to all /api/auth is a good start for common auth endpoints.
app.use('/api/auth', authLimiter);
// --- End of Rate Limiting Section ---


// Use the general routes
app.use('/api', generalRoutes);

// Use the authentication routes
app.use('/api/auth', authRoutes); // This now comes *after* the limiter is applied to /api/auth

// Use the listing routes
app.use('/api/listings', listingRoutes);

app.use('/api/chats', chatRoutes);

app.use('/api/bookings', bookingRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/users', userRoutes);


// --- Socket.IO Middleware for Authentication --- // <--- NEW SECTION
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('Socket connection attempt without token.');
    return next(new Error('Authentication error: No token provided.'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.user || !decoded.user.id) {
      console.log('Socket connection attempt with invalid token payload.');
      return next(new Error('Authentication error: Invalid token payload.'));
    }
    // Optionally, fetch user from DB to ensure they still exist/are active
    const user = await User.findByPk(decoded.user.id, { attributes: ['id', 'role', 'name'] });
    if (!user) {
        console.log(`Socket connection attempt: User ${decoded.user.id} not found in DB.`);
        return next(new Error('Authentication error: User not found.'));
    }
    socket.user = user.get({ plain: true }); // Attach user object to the socket instance
    next();
  } catch (err) {
    console.error('Socket token verification failed:', err.message);
    return next(new Error('Authentication error: Token is not valid.'));
  }
});
// --- End of Socket.IO Middleware ---


io.on('connection', (socket) => {
    // The socket.user object is now available here, thanks to the middleware
    if (!socket.user) {
        // This should ideally not happen if middleware is correctly set up and error handling in middleware disconnects.
        console.error(`Socket ${socket.id} connected but has no user object. This is unexpected.`);
        socket.emit('socket_auth_error', { message: 'User data not available on socket after connection.' });
        socket.disconnect(true);
        return;
    }

    console.log(`User ${socket.user.name} (ID: ${socket.user.id}, Role: ${socket.user.role}) connected via WebSocket: ${socket.id}`);

    // Join user-specific room
    socket.join(socket.user.id.toString());
    console.log(`Socket ${socket.id} for User ${socket.user.id} joined room ${socket.user.id.toString()}`);

    // Join admin room if user is admin
    if (socket.user.role === 'admin') {
        socket.join('admin_room');
        console.log(`Admin user ${socket.user.id} (Socket ${socket.id}) joined room 'admin_room'.`);
    }

    // Emit confirmation to client
    socket.emit('socket_authenticated', { userId: socket.user.id, role: socket.user.role });


    // REMOVE: The old 'authenticate_socket' event listener, as auth is now handled by middleware
    // socket.on('authenticate_socket', (authData) => { ... });

    socket.on('join_chat_room', (roomName) => { // This might still be useful for very specific, non-user-ID based rooms if you have them
        socket.join(roomName);
        console.log(`Socket ${socket.id} (User ${socket.user.id}) joined chat room ${roomName}`);
    });

    socket.on('send_message', async (messageData) => {
        console.log(`User ${socket.user.id} (Socket ${socket.id}) attempting to send message via WebSocket (consider HTTP):`, messageData);
        // Actual message sending should still primarily go through HTTP POST for persistence and validation.
        // If you allow direct message sending via socket, ensure robust validation and persistence here.
    });

    socket.on('disconnect', () => {
        if (socket.user) {
            console.log(`User ${socket.user.name} (ID: ${socket.user.id}) disconnected via WebSocket: ${socket.id}`);
        } else {
            console.log(`Socket ${socket.id} (unauthenticated or user data lost) disconnected.`);
        }
    });
});

// Function to connect to the database and start the server
async function startServer() {
  try {
    console.log("🚀 server.js is executing");
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        console.log(`Server with Socket.IO running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Unable to connect to the database, sync, or start server:', error);
    process.exit(1);
  }
}

// Запускаємо сервер, тільки якщо файл виконується напряму
if (require.main === module) {
  startServer();
}

// Експортуємо `server` та `sequelize` для використання в тестах
module.exports = { server, sequelize };