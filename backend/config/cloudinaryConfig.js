// backend/config/cloudinaryConfig.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Налаштовуємо сховище для Multer
const listingsStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'diploma_project_listings', // Папка для фото оголошень
    allowed_formats: ['jpeg', 'png', 'jpg']
  }
});

// Сховище для аватарок
const profilesStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'diploma_project_profiles', // Окрема папка для аватарок
    allowed_formats: ['jpeg', 'png', 'jpg'],
    // Для аватарок можна одразу задати трансформацію, щоб вони були квадратними
    transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }]
  }
});

module.exports = {
  cloudinary,
  listingsStorage, // Експортуємо сховище для оголошень
  profilesStorage  // Експортуємо сховище для аватарок
};