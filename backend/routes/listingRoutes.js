// backend/routes/listingRoutes.js

const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware
const upload = require('../config/multerConfig'); // Import the configured multer instance
const messageController = require('../controllers/messageController');
const favoriteController = require('../controllers/favoriteController');

// --- IMPORT VALIDATORS ---
const {
  createListingValidationRules,
  updateListingValidationRules,
  validateListingId, // For routes with :id or :listingId param
  validate
} = require('../validators/listingValidators'); // <--- ADDED: Import validators

// --- General GET routes ---
// Most specific paths first, then paths with parameters.

// GET all listings (public)
router.get('/', listingController.getListings);

// GET listings for the map (public) - Specific route, placed before /:id
router.get('/map-data', listingController.getMapData);

// GET listings owned by the authenticated user (requires auth)
router.get(
  '/owner',
  authMiddleware,
  listingController.getOwnerListings
);

// GET a specific listing for editing (requires auth, owner or admin)
// This is more specific than /:id because of the /edit suffix
router.get(
  '/:id/edit',
  authMiddleware,
  validateListingId(), // <--- ADDED: Validate the :id param
  validate,            // <--- ADDED: Apply validation
  listingController.getListingForEdit
);

// GET a specific listing by ID (public) - Generic route for a single listing
router.get(
  '/:id',
  optionalAuthMiddleware, // <-- USE THE MIDDLEWARE HERE
  validateListingId(), // <--- ADDED: Validate the :id param
  validate,            // <--- ADDED: Apply validation
  listingController.getListingById
);

// --- Routes related to reviews for a specific listing ---

// GET reviews for a specific listing (public)
router.get(
  '/:listingId/reviews',
  validateListingId(), // <--- ADDED: Validate :listingId param
  validate,            // <--- ADDED: Apply validation
  listingController.getReviewsByListingId
);

// POST a new review for a specific listing (requires auth)
router.post(
  '/:listingId/reviews',
  authMiddleware,
  validateListingId(), // <--- ADDED: Validate :listingId param
  validate,            // <--- ADDED: Apply validation (add specific review validation if needed)
  listingController.createReview
);

// --- Routes related to messages for a specific listing ---
// Note: These paths are tied to a specific listing. MessageController also has /chats routes.

// GET messages for a specific listing (requires auth)
router.get(
  '/:listingId/messages',
  authMiddleware,
  validateListingId(), // <--- ADDED: Validate :listingId param
  validate,            // <--- ADDED: Apply validation
  messageController.getMessagesByListingId
);

// POST a new message for a specific listing (requires auth)
router.post(
  '/:listingId/messages',
  authMiddleware,
  validateListingId(), // <--- ADDED: Validate :listingId param
  validate,            // <--- ADDED: Apply validation (add message content validation if needed)
  messageController.createMessage
);

// --- Route to get booked dates for a listing ---
router.get(
    '/:listingId/booked-dates',
    validateListingId(), // <--- ADDED: Validate :listingId param
    validate,            // <--- ADDED: Apply validation
    listingController.getListingBookedDates
);


// --- POST, PUT, DELETE for listings (generally require auth) ---

// POST (create) a new listing (requires auth)
router.post(
  '/',
  authMiddleware,
  upload.array('photos', 10), // Expecting multiple files named 'photos'
  createListingValidationRules(), // <--- ADDED: Apply validation rules for creation
  validate,                       // <--- ADDED: Apply validation
  listingController.createListing
);

// PUT (update) an existing listing (requires auth, owner or admin)
router.put(
  '/:id',
  authMiddleware,
  upload.array('photos', 10), // Expecting *new* files named 'photos' for update
  updateListingValidationRules(), // <--- ADDED: Apply validation rules for update
  validate,                       // <--- ADDED: Apply validation
  listingController.updateListing
);

router.put(
  '/:id/archive', // New specific route for archive/unarchive
  authMiddleware,
  validateListingId(),
  validate,
  listingController.toggleListingArchiveStatus // New controller function
);
// DELETE a listing (requires auth, owner)
router.delete(
  '/:id',
  authMiddleware,
  validateListingId(), // <--- ADDED: Validate the :id param
  validate,            // <--- ADDED: Apply validation
  listingController.deleteListing
);

// Add/Remove favorite for a listing (requires auth)
// Note: These paths are tied to a specific listing. FavoriteController also has /users/me/favorites routes.
router.post(
  '/:listingId/favorite',
  authMiddleware,
  validateListingId(), // <--- ADDED: Validate :listingId param
  validate,            // <--- ADDED: Apply validation
  favoriteController.addFavorite
);
// Remove a listing from favorites
router.delete(
  '/:listingId/favorite',
  authMiddleware,
  validateListingId(), // <--- ADDED: Validate :listingId param
  validate,            // <--- ADDED: Apply validation
  favoriteController.removeFavorite
);

module.exports = router;