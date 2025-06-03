// backend/routes/listingRoutes.js

const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware
const upload = require('../config/multerConfig'); // Import the configured multer instance
const cacheMiddleware = require('../middleware/cacheMiddleware'); // <--- ADDED: Import cache middleware

// --- IMPORT VALIDATORS ---
const { 
  createListingValidationRules, 
  updateListingValidationRules,
  validateListingId, // For routes with :id or :listingId param
  validate 
} = require('../validators/listingValidators');

// Ensure other controllers needed are imported
const messageController = require('../controllers/messageController');
const favoriteController = require('../controllers/favoriteController'); 


// --- General GET routes ---
// Most specific paths first, then paths with parameters.

// GET all listings (public) - Apply cache middleware
router.get('/', cacheMiddleware(60), listingController.getListings); // Cache for 60 seconds

// GET listings for the map (public) - Can also be cached
router.get('/map-data', cacheMiddleware(120), listingController.getMapData); // Cache for 120 seconds

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
  validateListingId(), // Validate the :id param
  validate,            // Apply validation
  listingController.getListingForEdit
);

// GET a specific listing by ID (public or authenticated, status dependent)
// This could be cached, but changes if user is admin vs public.
// Caching dynamic content based on auth needs more complex cache keys or vary headers.
// For simplicity, let's not cache this one with the simple middleware for now.
router.get(
  '/:id',
  optionalAuthMiddleware, 
  validateListingId(), 
  validate,            
  listingController.getListingById
);

// --- Routes related to reviews for a specific listing ---

// GET reviews for a specific listing (public) - Reviews could be cached
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
// These routes exist on both listingRoutes and chatRoutes.
// If chatRoutes are canonical, these might be redundant. Keeping for now.
router.get(
  '/:listingId/messages',
  authMiddleware,
  validateListingId(), 
  validate,
  messageController.getMessagesByListingId
);

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
    listingController.getListingBookedDates // Could be cached if no sensitive info.
);


// --- POST, PUT, DELETE for listings (generally require auth) ---
// These routes modify data, so they are generally not cached.

// POST (create) a new listing (requires auth)
router.post(
  '/',
  authMiddleware,
  upload.array('photos', 10), // Expecting multiple files named 'photos'
  createListingValidationRules(), 
  validate,                       
  listingController.createListing
);

// PUT (update) an existing listing (requires auth, owner or admin)
router.put(
  '/:id',
  authMiddleware,
  upload.array('photos', 10), // Expecting *new* files named 'photos' for update
  updateListingValidationRules(), 
  validate,                       
  listingController.updateListing
);

// DELETE a listing (requires auth, owner)
router.delete(
  '/:id',
  authMiddleware,
  validateListingId(), 
  validate,            
  listingController.deleteListing
);

// --- Routes for favorite listings ---
// These routes are user-specific and modify data, so generally not cached.
router.post(
  '/:listingId/favorite', 
  authMiddleware, 
  validateListingId(), 
  validate, 
  favoriteController.addFavorite
);
router.delete(
  '/:listingId/favorite', 
  authMiddleware, 
  validateListingId(), 
  validate, 
  favoriteController.removeFavorite
);

module.exports = router;