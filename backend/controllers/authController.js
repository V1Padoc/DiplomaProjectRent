// backend/controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Controller function for user registration
exports.register = async (req, res) => {
  // ... (keep your existing register function here)
  const { email, password, name, role } = req.body;

  try {
    if (!email || !password || !name || !role) {
      return res.status(400).json({ message: 'Please provide all required fields: email, password, name, role' });
    }

    const existingUser = await User.findOne({ where: { email: email } });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      email: email,
      password: hashedPassword,
      name: name,
      role: role
    });

    res.status(201).json({
      message: 'User registered successfully!',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Error during registration:', error);
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
        attributes: ['id', 'email', 'name', 'role', 'created_at'] // Select specific attributes to return (exclude password!)
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
// We'll add the get user controller function here later
// exports.getUser = async (req, res) => { ... };