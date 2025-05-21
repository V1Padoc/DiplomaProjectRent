// backend/config/multerProfileConfig.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const profileUploadDir = path.join(__dirname, '../uploads/profiles'); // Subdirectory for profile photos

if (!fs.existsSync(path.join(__dirname, '../uploads'))) { // Ensure 'uploads' exists first
    fs.mkdirSync(path.join(__dirname, '../uploads'));
}
if (!fs.existsSync(profileUploadDir)) {
    fs.mkdirSync(profileUploadDir);
    console.log(`Created profile uploads directory: ${profileUploadDir}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + fileExtension); // Include user ID for easier association
  }
});

const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb('Error: Profile photo must be an image (jpeg, jpg, png, gif)!');
};

const profileUpload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 2 }, // 2MB limit for profile photos
  fileFilter: fileFilter
});

module.exports = profileUpload;