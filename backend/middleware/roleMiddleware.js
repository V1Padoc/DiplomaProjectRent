// backend/middleware/roleMiddleware.js

// Middleware to check if user is a tenant
exports.isTenant = (req, res, next) => {
    if (req.user && req.user.role === 'tenant') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Tenant role required.' });
    }
};

// Middleware to check if user is an owner
exports.isOwner = (req, res, next) => {
    if (req.user && req.user.role === 'owner') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Owner role required.' });
    }
};

// Middleware to check if user is an admin
exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
};