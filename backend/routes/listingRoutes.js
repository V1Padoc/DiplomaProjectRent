// backend/routes/listingRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');

const { listingsStorage } = require('../config/cloudinaryConfig');

// --- ВИПРАВЛЕНО: Створюємо екземпляр multer з правильним сховищем ---
const upload = multer({ 
    storage: listingsStorage,
    limits: { fileSize: 1024 * 1024 * 10 }, // 10MB limit per photo
});
// Імпортуємо контролери та middleware
const listingController = require('../controllers/listingController');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const messageController = require('../controllers/messageController');
const favoriteController = require('../controllers/favoriteController');

// Імпортуємо валідатори
const {
  createListingValidationRules,
  updateListingValidationRules,
  validateListingId,
  validate
} = require('../validators/listingValidators');

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
  validateListingId(),
  validate,
  listingController.getListingForEdit
);

// GET a specific listing by ID (public) - Generic route for a single listing
router.get(
  '/:id',
  optionalAuthMiddleware,
  validateListingId(),
  validate,
  listingController.getListingById
);

// --- Routes related to reviews for a specific listing ---

// GET reviews for a specific listing (public)
router.get(
  '/:listingId/reviews',
  validateListingId(),
  validate,
  listingController.getReviewsByListingId
);

// POST a new review for a specific listing (requires auth)
router.post(
  '/:listingId/reviews',
  authMiddleware,
  validateListingId(),
  validate,
  listingController.createReview
);

// --- Routes related to messages for a specific listing ---
// Note: These paths are tied to a specific listing. MessageController also has /chats routes.

// GET messages for a specific listing (requires auth)
router.get(
  '/:listingId/messages',
  authMiddleware,
  validateListingId(),
  validate,
  messageController.getMessagesByListingId
);

// POST a new message for a specific listing (requires auth)
router.post(
  '/:listingId/messages',
  authMiddleware,
  validateListingId(),
  validate,
  messageController.createMessage
);

// --- Route to get booked dates for a listing ---
router.get(
    '/:listingId/booked-dates',
    validateListingId(),
    validate,
    listingController.getListingBookedDates
);


// --- POST, PUT, DELETE for listings (generally require auth) ---

// POST (create) a new listing (requires auth)
router.post(
  '/',
  authMiddleware,
  upload.array('photos', 10), // Тепер `upload` - це наш правильно налаштований multer
  createListingValidationRules(),
  validate,
  listingController.createListing
);

// PUT (update) an existing listing (requires auth, owner or admin)
router.put(
  '/:id',
  authMiddleware,
  upload.array('photos', 10), // І тут також
  updateListingValidationRules(),
  validate,
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
  validateListingId(),
  validate,
  listingController.deleteListing
);

// Add/Remove favorite for a listing (requires auth)
router.post(
  '/:listingId/favorite',
  authMiddleware,
  validateListingId(),
  validate,
  favoriteController.addFavorite
);

// Remove a listing from favorites
router.delete(
  '/:listingId/favorite',
  authMiddleware,
  validateListingId(),
  validate,
  favoriteController.removeFavorite
);

module.exports = router;