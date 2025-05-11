// backend/routes/listingRoutes.js

const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const authMiddleware = require('../middleware/authMiddleware'); // Import the auth middleware
const upload = require('../config/multerConfig'); // Import the configured multer instance


// Keep your existing GET / route above this
router.get('/', listingController.getListings); // <-- This should be there


router.get(
  '/owner', // The path for this route (relative to /api/listings)
  authMiddleware, // Requires authentication
  listingController.getOwnerListings // The controller function
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


module.exports = router;