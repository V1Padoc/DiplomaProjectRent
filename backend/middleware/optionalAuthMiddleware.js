// backend/middleware/optionalAuthMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path if necessary

const optionalAuthMiddleware = async (req, res, next) => {
    // console.log("\n--- Optional Auth Middleware START ---");
    // console.log(`Timestamp: ${new Date().toISOString()}`);
    // console.log(`Request Path: ${req.path}, Method: ${req.method}`);

    if (!process.env.JWT_SECRET) {
        console.error("CRITICAL: JWT_SECRET is UNDEFINED in environment variables!");
    }
    // ... (other initial logs)

    const authHeader = req.headers.authorization;
    // console.log("Authorization Header: ", authHeader ? `Present - Starts with 'Bearer ': ${authHeader.startsWith('Bearer ')}` : "MISSING or undefined");

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // console.log("Token Extracted: ", token ? `Yes (length: ${token.length})` : "No (empty after split)");

        if (token && process.env.JWT_SECRET) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                // console.log("Token Decoded Successfully. Payload:", decoded);

                // ***** MODIFICATION START *****
                if (decoded && decoded.user && decoded.user.id) { // Check for decoded.user.id
                    // console.log(`Decoded User ID from decoded.user.id: ${decoded.user.id}. Attempting to fetch user from DB...`);
                    const user = await User.scope(null).findByPk(decoded.user.id, { // Use decoded.user.id
                        attributes: ['id', 'name', 'email', 'role', 'profile_photo_url']
                    });

                    if (user) {
                        req.user = user.get({ plain: true });
                        // console.log(`User FOUND in DB and set to req.user: ID: ${req.user.id}, Role: ${req.user.role}, Name: ${req.user.name}`);
                    } else {
                        // console.warn(`User with ID ${decoded.user.id} (from token) NOT FOUND in DB.`);
                        req.user = null;
                    }
                } else {
                    // console.warn("Decoded token is invalid, does not contain a 'user' object, or 'user' object does not contain an 'id' field.", decoded);
                    req.user = null;
                }
                // ***** MODIFICATION END *****

            } catch (error) {
                // console.warn("Token Verification FAILED:");
                // console.warn(`  Error Name: ${error.name}`);
                // console.warn(`  Error Message: ${error.message}`);
                // ... (rest of error logging)
                req.user = null;
            }
        } else {
            // ... (logging for no token or no JWT_SECRET)
            req.user = null;
        }
    } else {
        // console.log("No 'Authorization: Bearer <token>' header found. Proceeding without authentication.");
        req.user = null;
    }

    // console.log("Optional Auth Middleware FINISHING. req.user is:", req.user ? `Set (ID: ${req.user.id}, Role: ${req.user.role})` : "null or undefined");
    // console.log("--- Optional Auth Middleware END ---\n");
    next();
};

module.exports = optionalAuthMiddleware;