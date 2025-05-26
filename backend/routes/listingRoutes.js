// backend/routes/listingRoutes.js

const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware
const upload = require('../config/multerConfig'); // Import the configured multer instance
const messageController = require('../controllers/messageController');

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
  listingController.getListingForEdit
);

// GET a specific listing by ID (public) - Generic route for a single listing
router.get('/:id', listingController.getListingById);

// --- Routes related to reviews for a specific listing ---

// GET reviews for a specific listing (public)
router.get('/:listingId/reviews', listingController.getReviewsByListingId);

// POST a new review for a specific listing (requires auth)
router.post(
  '/:listingId/reviews',
  authMiddleware,
  listingController.createReview
);

// --- Routes related to messages for a specific listing ---

// GET messages for a specific listing (requires auth)
router.get(
  '/:listingId/messages',
  authMiddleware,
  messageController.getMessagesByListingId
);

// POST a new message for a specific listing (requires auth)
router.post(
  '/:listingId/messages',
  authMiddleware,
  messageController.createMessage
);

// --- Route to get booked dates for a listing ---
router.get(
    '/:listingId/booked-dates',
    listingController.getListingBookedDates
);


// --- POST, PUT, DELETE for listings (generally require auth) ---

// POST (create) a new listing (requires auth)
router.post(
  '/',
  authMiddleware,
  upload.array('photos', 10), // Expecting multiple files named 'photos'
  listingController.createListing
);

// PUT (update) an existing listing (requires auth, owner or admin)
router.put(
  '/:id',
  authMiddleware,
  upload.array('photos', 10), // Expecting *new* files named 'photos' for update
  listingController.updateListing
);

// DELETE a listing (requires auth, owner)
router.delete(
  '/:id',
  authMiddleware,
  listingController.deleteListing
);

module.exports = router;