// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken'); // Import jsonwebtoken

// Middleware function to protect routes
module.exports = function(req, res, next) {
  // Get token from header
  // The token is usually sent in the 'Authorization' header as 'Bearer TOKEN'
  const authHeader = req.header('Authorization');

  // Check if no token
  if (!authHeader) {
    // 401 Unauthorized: The client must authenticate itself to get the requested response.
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Extract the token string (remove "Bearer ")
  const token = authHeader.split(' ')[1]; // Split 'Bearer TOKEN' by space and get the second part

  // Check if token is in the correct format (e.g., starts with 'Bearer ')
   if (!token) {
       return res.status(401).json({ message: 'Token format is incorrect' });
   }


  try {
    // Verify token
    // jwt.verify(token, secretOrPublicKey, [options, callback])
    // This checks if the token is valid and was signed with your secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user information (from the token payload) to the request object
    // We put the user ID (and potentially role) from the token payload into req.user
    req.user = decoded.user; // 'decoded.user' because that's how we structured the payload in authController.js login function

    // Call next() to pass the request to the next middleware or route handler
    next();

  } catch (err) {
    // If token is not valid (e.g., expired, wrong signature)
    console.error('Token verification failed:', err.message);
    // 401 Unauthorized: Token is invalid
    res.status(401).json({ message: 'Token is not valid' });
  }
};