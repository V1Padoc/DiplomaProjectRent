// backend/server.js
const http = require('http'); 
const { Server } = require("socket.io"); 
const express = require('express');
const cors = require('cors');
require('dotenv').config();
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



const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://diplomaprojectrent.onrender.com"],
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
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
  if (!token) return next(new Error('Authentication error: No token provided.'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.user || !decoded.user.id) return next(new Error('Authentication error: Invalid token payload.'));
    
    const user = await User.findByPk(decoded.user.id, { attributes: ['id', 'role', 'name'] });
    if (!user) return next(new Error('Authentication error: User not found.'));
    
    socket.user = user.get({ plain: true }); 
    next();
  } catch (err) {
    return next(new Error('Authentication error: Token is not valid.'));
  }
});

io.on('connection', (socket) => {
    if (!socket.user) {
        socket.disconnect(true);
        return;
    }
    console.log(`User ${socket.user.name} (ID: ${socket.user.id}) connected: ${socket.id}`);
    socket.join(socket.user.id.toString());
    if (socket.user.role === 'admin') {
        socket.join('admin_room');
    }
    socket.on('disconnect', () => {
        console.log(`User ${socket.user.name} (ID: ${socket.user.id}) disconnected: ${socket.id}`);
    });
});


const PORT = process.env.PORT || 5000;


(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
       // await sequelize.sync({ force: true });
        server.listen(PORT, () => {
            console.log(`✅ Server with Socket.IO is live and running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Unable to start server:', error);
        process.exit(1);
    }
})();

module.exports = { server, sequelize }; 