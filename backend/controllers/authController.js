// backend/controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message'); // Assuming you need to check messages
const Booking = require('../models/Booking'); // For booking requests
const Listing = require('../models/Listing'); 
const { Op } = require('sequelize');

// Controller function for user registration
exports.register = async (req, res) => {
  // Destructure validated and sanitized data from req.body
  // express-validator middleware (if used) would have already processed this.
  const { email, password, name, last_name, role, phone_number } = req.body;

  // The role validation `allowedSelfRegisterRoles` is now handled by `isIn(['tenant', 'owner'])`
  // in authValidators.js. So, we can remove the explicit check here.
  // The initial `if (!email || ...)` check for required fields is now
  // handled by `notEmpty()` in authValidators.js.

  try {
    const existingUser = await User.findOne({ where: { email: email } });
    if (existingUser) {
      // This check remains important and should be kept.
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      email: email,
      password: hashedPassword,
      name: name,
      last_name: last_name,
      role: role,
      phone_number: phone_number
    });

    res.status(201).json({
      message: 'User registered successfully!',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        last_name: newUser.last_name,
        role: newUser.role,
        phone_number: newUser.phone_number
      }
    });

  } catch (error) {
    console.error('Error during registration:', error);
    // Check if it's a Sequelize validation error (e.g., unique constraint)
    // Though email uniqueness is checked above, other model validations might trigger.
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'An account with this email or phone number already exists.' });
    }
    if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message);
        return res.status(400).json({ message: 'Validation error from model.', errors: messages });
    }
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// Controller function for user login
exports.login = async (req, res) => {
  const { email, password } = req.body; // Get email and password from request body

  try {
    // Basic validation: Check if required fields are present
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    // Find the user by email
    const user = await User.findOne({ where: { email: email } });
    if (!user) {
      // If user not found, send a 401 Unauthorized response
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Compare the provided password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // If passwords don't match, send a 401 Unauthorized response
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // If email and password are correct, create and send a JWT
    // The payload of the token should contain non-sensitive user info like ID and role
    const payload = {
      user: {
        id: user.id,
        role: user.role
        // You might add name or other non-sensitive info if needed on the frontend
      }
    };

    // Sign the token
    // jwt.sign(payload, secretOrPrivateKey, [options, callback])
    // process.env.JWT_SECRET is your secret key from the .env file
    // expiresIn sets the token's expiration time (e.g., '1h', '7d')
    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Your secret key for signing tokens
      { expiresIn: '1h' }, // Token expires in 1 hour (adjust as needed)
      (err, token) => {
        if (err) {
          console.error('Error signing token:', err);
          return res.status(500).json({ message: 'Token generation failed.' });
        }
        // If token is generated successfully, send it in the response
        res.json({ token }); // Send the token back to the frontend
      }
    );

  } catch (error) {
    // If any error occurs during the process
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};


exports.getUser = async (req, res) => {
  try {
    // req.user was set by the authMiddleware based on the token payload
    // We use req.user.id to find the user in the database
    const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'email', 'name', 'last_name', 'role', 'created_at', // Added last_name
            'profile_photo_url', 'bio', 'phone_number'] // Select specific attributes to return (exclude password!)
    });

    // If user is not found (shouldn't happen if token was valid and user exists)
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Send back the user details (excluding the password)
    res.json(user); // Sequelize findByPk returns a model instance, which can be sent as JSON

  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.status(500).json({ message: 'Server error while fetching user data.' });
  }
};

exports.getSocketEligibility = async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        let shouldConnect = false;

        // 1. Is an admin?
        if (userRole === 'admin') {
            shouldConnect = true;
        }

        // 2. Is a listing owner?
        if (!shouldConnect && userRole === 'owner') {
            const ownedListing = await Listing.findOne({ where: { owner_id: userId }, attributes: ['id'] });
            if (ownedListing) {
                shouldConnect = true;
            }
        }

        // 3. Sent a booking request? (Check for bookings where user is tenant_id)
        if (!shouldConnect) {
            const sentBooking = await Booking.findOne({ where: { tenant_id: userId }, attributes: ['id'] });
            if (sentBooking) {
                shouldConnect = true;
            }
        }

        // 4. Contacted a listing owner (sent or received a message)?
        if (!shouldConnect) {
            const hasMessaged = await Message.findOne({
                where: {
                    [Op.or]: [
                        { sender_id: userId },
                        { receiver_id: userId }
                    ]
                },
                attributes: ['id']
            });
            if (hasMessaged) {
                shouldConnect = true;
            }
        }

        res.status(200).json({ eligible: shouldConnect });

    } catch (error) {
        console.error('Error checking socket eligibility:', error);
        res.status(500).json({ message: 'Server error checking socket eligibility.' });
    }
};