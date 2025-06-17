// backend/server.js
const http = require('http'); 
const { Server } = require("socket.io"); 
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('./models/User'); 

const sequelize = require('./config/database');

const generalRoutes = require('./routes/generalRoutes');
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');


require('./models/User');
require('./models/Listing');
require('./models/Booking');
require('./models/Review');
require('./models/Message');
require('./models/Analytics');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);


const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", 
        methods: ["GET", "POST"]
    }
});


app.set('socketio', io);

const allowedOrigins = [
  'http://localhost:3000',
  'https://diplomaprojectrent.onrender.com'   
];


app.use(cors({
  origin: function (origin, callback) {
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads/profiles')));


const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 
  max: 30, 
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, 
  legacyHeaders: false, 
});


app.use('/api/auth', authLimiter);

app.use('/api', generalRoutes);

app.use('/api/auth', authRoutes); 

app.use('/api/listings', listingRoutes);

app.use('/api/chats', chatRoutes);

app.use('/api/bookings', bookingRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/users', userRoutes);


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

    const user = await User.findByPk(decoded.user.id, { attributes: ['id', 'role', 'name'] });
    if (!user) {
        console.log(`Socket connection attempt: User ${decoded.user.id} not found in DB.`);
        return next(new Error('Authentication error: User not found.'));
    }
    socket.user = user.get({ plain: true }); 
    next();
  } catch (err) {
    console.error('Socket token verification failed:', err.message);
    return next(new Error('Authentication error: Token is not valid.'));
  }
});



io.on('connection', (socket) => {
    if (!socket.user) {
        console.error(`Socket ${socket.id} connected but has no user object. This is unexpected.`);
        socket.emit('socket_auth_error', { message: 'User data not available on socket after connection.' });
        socket.disconnect(true);
        return;
    }

    console.log(`User ${socket.user.name} (ID: ${socket.user.id}, Role: ${socket.user.role}) connected via WebSocket: ${socket.id}`);

    socket.join(socket.user.id.toString());
    console.log(`Socket ${socket.id} for User ${socket.user.id} joined room ${socket.user.id.toString()}`);

    if (socket.user.role === 'admin') {
        socket.join('admin_room');
        console.log(`Admin user ${socket.user.id} (Socket ${socket.id}) joined room 'admin_room'.`);
    }

    socket.emit('socket_authenticated', { userId: socket.user.id, role: socket.user.role });

    socket.on('join_chat_room', (roomName) => { 
        socket.join(roomName);
        console.log(`Socket ${socket.id} (User ${socket.user.id}) joined chat room ${roomName}`);
    });

    socket.on('send_message', async (messageData) => {
        console.log(`User ${socket.user.id} (Socket ${socket.id}) attempting to send message via WebSocket (consider HTTP):`, messageData);
    });

    socket.on('disconnect', () => {
        if (socket.user) {
            console.log(`User ${socket.user.name} (ID: ${socket.user.id}) disconnected via WebSocket: ${socket.id}`);
        } else {
            console.log(`Socket ${socket.id} (unauthenticated or user data lost) disconnected.`);
        }
    });
});

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

if (require.main === module) {
  startServer();
}

module.exports = { server, sequelize };