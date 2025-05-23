// backend/routes/listingRoutes.js

const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware
const upload = require('../config/multerConfig'); // Import the configured multer instance
const messageController = require('../controllers/messageController');

// Keep your existing GET / route above this
router.get('/', listingController.getListings); // <-- This should be there


router.get(
  '/owner', // The path for this route (relative to /api/listings)
  authMiddleware, // Requires authentication
  listingController.getOwnerListings // The controller function
); 

router.get(
  '/:id/edit', // The path for this route
  authMiddleware, // Requires authentication
  listingController.getListingForEdit // The controller function
);

router.get('/:id', listingController.getListingById);

router.get('/:listingId/reviews', listingController.getReviewsByListingId);
// --- Make sure this POST route block is present and correct ---



router.post(
  '/', // The path for this route (relative to where the router is mounted, /api/listings)
  authMiddleware, // Apply authMiddleware first
  upload.array('photos', 10), // Apply multer middleware (expecting multiple files named 'photos')
  listingController.createListing // The controller function
);
// --- End of POST route block ---
router.post(
  '/:listingId/reviews', // URL path with the listing ID parameter
  authMiddleware,      // Requires authentication
  listingController.createReview // The controller function
);

router.delete(
  '/:id', // The path for this route (relative to /api/listings) with the listing ID parameter
  authMiddleware, // Requires authentication
  listingController.deleteListing // The controller function
); 
// Keep other listing routes below this
// router.get('/:id', listingController.getListingById);
// router.put('/:id', authMiddleware, listingController.updateListing);
// router.delete('/:id', authMiddleware, listingController.deleteListing);

router.put(
  '/:id', // The path for this route with the listing ID parameter
  authMiddleware, // Requires authentication
  upload.array('photos', 10), // Apply multer middleware (expecting *new* files named 'photos')
  listingController.updateListing // The controller function
);

router.get('/:listingId/reviews', listingController.getReviewsByListingId);
router.post(
  '/:listingId/reviews',
  authMiddleware,
  listingController.createReview
);

router.get(
  '/:listingId/messages', // URL path
  authMiddleware,        // Requires authentication
  messageController.getMessagesByListingId // The controller function
); // <-- Add this line

// --- Define the POST route for creating a message for a specific listing ---
// This route is protected.
router.post(
  '/:listingId/messages', // URL path (Note: listing_id also expected in body in controller)
  authMiddleware,      // Requires authentication
  messageController.createMessage // The controller function
); // <-- Add this line

module.exports = router;