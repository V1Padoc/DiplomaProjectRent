// backend/server.js
const http = require('http'); // Node's built-in HTTP module
const { Server } = require("socket.io"); // Correct import for Socket.IO Server class
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const helmet = require('helmet'); // <--- ADDED: Import Helmet for security

const sequelize = require('./config/database');
const logger = require('./config/logger');
const generalRoutes = require('./routes/generalRoutes');
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const errorHandler = require('./middleware/errorHandler'); // Ensure this is imported for use

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


// Middleware

// --- Security Middleware (Helmet) --- // <--- ADDED: Helmet for security headers
app.use(helmet());
// You can configure Helmet further if needed, e.g., for Content Security Policy (CSP)
// app.use(helmet.contentSecurityPolicy({ directives: { ... } })); // CSP is powerful but complex to set up initially

app.use(cors());
app.use(express.json());

// --- Serve static files from the 'uploads' directory ---
// This middleware will serve files directly when requested
// The URL path will be /uploads, and it will map to the backend/uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads/profiles')));

// --- Rate Limiting for Auth Routes ---
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each IP to 20 login/register requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the authLimiter to auth routes BEFORE they are used
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

// Centralized Error Handling Middleware - Placed at the end of routes to catch all errors
app.use(errorHandler); // <--- MOVED: Ensure error handler is after all routes


// --- Socket.IO Middleware for Authentication ---
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logger.warn('Socket connection attempt without token.');
    return next(new Error('Authentication error: No token provided.'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.user || !decoded.user.id) {
      logger.warn('Socket connection attempt with invalid token payload.');
      return next(new Error('Authentication error: Invalid token payload.'));
    }
    // Fetch user from DB to ensure they still exist and retrieve their role
    const user = await User.findByPk(decoded.user.id, { attributes: ['id', 'role', 'name'] });
    if (!user) {
        logger.warn(`Socket connection attempt: User ${decoded.user.id} not found in DB.`);
        return next(new Error('Authentication error: User not found.'));
    }
    socket.user = user.get({ plain: true }); // Attach user object to the socket instance
    next();
  } catch (err) {
    logger.error('Socket token verification failed:', { message: err.message });
    return next(new Error('Authentication error: Token is not valid or expired.'));
  }
});
// --- End of Socket.IO Middleware ---


io.on('connection', (socket) => {
    // The socket.user object is now available here, thanks to the middleware
    if (!socket.user) {
        // This should ideally not happen if middleware is correctly set up and errors are handled.
        logger.error(`Socket ${socket.id} connected but has no user object. This is unexpected.`);
        socket.emit('socket_auth_error', { message: 'User data not available on socket after connection.' });
        socket.disconnect(true); // Force disconnect
        return;
    }

    logger.info(`User ${socket.user.name} (ID: ${socket.user.id}, Role: ${socket.user.role}) connected via WebSocket: ${socket.id}`);

    // Join user-specific room
    socket.join(socket.user.id.toString());
    logger.info(`Socket ${socket.id} for User ${socket.user.id} joined room ${socket.user.id.toString()}`);

    // Join admin room if user is admin
    if (socket.user.role === 'admin') {
        socket.join('admin_room');
        logger.info(`Admin user ${socket.user.id} (Socket ${socket.id}) joined room 'admin_room'.`);
    }

    // Emit confirmation to client that socket is authenticated and rooms joined
    socket.emit('socket_authenticated', { userId: socket.user.id, role: socket.user.role });


    socket.on('join_chat_room', (roomName) => {
        // This can still be useful for joining specific chat rooms if your chat logic requires it
        socket.join(roomName);
        logger.info(`Socket ${socket.id} (User ${socket.user.id}) joined chat room ${roomName}`);
    });

    socket.on('send_message', async (messageData) => {
        logger.debug(`User ${socket.user.id} (Socket ${socket.id}) attempting to send message via WebSocket (consider HTTP POST for persistence):`, messageData);
        // Actual message sending logic (persistence, validation, and emission to recipients)
        // should ideally be handled via a dedicated HTTP POST endpoint.
        // If you process messages here, ensure full validation and database persistence.
    });

    socket.on('disconnect', () => {
        if (socket.user) {
            logger.info(`User ${socket.user.name} (ID: ${socket.user.id}) disconnected via WebSocket: ${socket.id}`);
        } else {
            logger.info(`Socket ${socket.id} (unauthenticated or user data lost) disconnected.`);
        }
    });
});

// Function to connect to the database and start the server
async function startServer() {
  try {
    await sequelize.authenticate();
    // console.log('Database connection has been established successfully.'); // This is now logged by database.js itself

    const PORT = process.env.PORT || 5000;
    // *** FIX: Use 'server.listen' because Socket.IO is attached to 'server' (the http.createServer instance) ***
    server.listen(PORT, () => {
        logger.info(`Server with Socket.IO running on port ${PORT}`);
    });

  } catch (error) {
    logger.error('Unable to connect to the database, sync, or start server:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();