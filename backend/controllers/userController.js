// backend/controllers/userController.js

// Імпортуємо необхідні моделі та бібліотеки
const User = require('../models/User');
const Listing = require('../models/Listing');
const Booking = require('../models/Booking');
const bcrypt = require('bcryptjs'); 
const { Op } = require('sequelize');
// const { cloudinary } = require('../config/cloudinaryConfig'); // Може знадобитися для видалення

// PUT /api/users/profile - Оновлення профілю користувача
exports.updateUserProfile = async (req, res) => {
    const userId = req.user.id; // Отримуємо ID з middleware
    const { name, last_name, bio, phone_number } = req.body;

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Готуємо об'єкт з даними для оновлення
        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.name = name;
        if (last_name !== undefined) fieldsToUpdate.last_name = last_name;
        if (bio !== undefined) fieldsToUpdate.bio = bio;
        
        // Перевіряємо, чи не намагаються встановити порожній номер телефону
        if (phone_number !== undefined) {
            if (phone_number.trim() === '') {
                 return res.status(400).json({ message: "Phone number cannot be empty." });
            }
            fieldsToUpdate.phone_number = phone_number;
        }

        // Обробка завантаженого файлу аватарки
        if (req.file) {
            // *** ГОЛОВНА ЗМІНА: Просто зберігаємо URL з Cloudinary ***
            // Нам більше не потрібно видаляти старий файл вручну.
            // Cloudinary може бути налаштований на перезапис або ви можете
            // вручну видаляти старі файли за їх public_id, якщо це потрібно.
            fieldsToUpdate.profile_photo_url = req.file.path; // req.file.path містить URL з Cloudinary
        }

        // Перевіряємо, чи є взагалі дані для оновлення
        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ message: "No update information provided." });
        }
        
        // Оновлюємо дані користувача в базі
        await user.update(fieldsToUpdate);

        // Повертаємо оновлені дані користувача (без пароля)
        const updatedUser = await User.findByPk(userId, {
             attributes: { exclude: ['password'] }
        });

        res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser
        });

    } catch (error) {
        console.error("Error updating user profile:", error);
        // Обробка помилок від Multer, якщо такі є
        if (error.code && error.code.startsWith('LIMIT_')) { 
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Server error while updating profile." });
    }
};

// GET /api/users/public-profile/:userId - Отримання публічного профілю
exports.getPublicUserProfile = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findByPk(userId, {
            attributes: [
                'id',
                'name',
                'profile_photo_url',
                'bio',
                'created_at',
                'role'
            ]
        });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        let userListings = [];
        // Якщо користувач є власником, знаходимо його активні оголошення
        if (user.role === 'owner') {
            userListings = await Listing.findAll({
                where: { owner_id: userId, status: 'active' },
                attributes: ['id', 'title', 'price', 'type', 'location', 'photos'],
                limit: 5,
                order: [['created_at', 'DESC']]
            });
        }
        
        res.status(200).json({
            user: user,
            listings: userListings,
        });

    } catch (error) {
        console.error("Error fetching public user profile:", error);
        res.status(500).json({ message: "Server error while fetching public profile." });
    }
};

// POST /api/users/change-password - Зміна пароля
exports.changePassword = async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    try {
        // Валідація вхідних даних
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: "All password fields are required." });
        }
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: "New passwords do not match." });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters long." });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            // Ця помилка малоймовірна, оскільки користувач автентифікований
            return res.status(404).json({ message: "User not found." });
        }

        // Перевірка старого пароля
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect old password." });
        }

        // Хешування та оновлення нового пароля
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password changed successfully." });

    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Server error while changing password." });
    }
};

// GET /api/users/me/unread-booking-updates-count - Кількість непрочитаних оновлень бронювань
exports.getUnreadBookingUpdatesCountForTenant = async (req, res) => {
    const tenantId = req.user.id; 
                                  
    try {
        const count = await Booking.count({
            where: {
                tenant_id: tenantId,
                is_update_seen_by_tenant: false,
                status: { [Op.in]: ['confirmed', 'rejected'] }
            }
        });
        res.status(200).json({ unreadCount: count });
    } catch (error) {
        console.error('Error fetching unread booking updates count for tenant:', error); 
        res.status(500).json({ message: 'Server error.' }); 
    }
};

// PUT /api/users/me/acknowledge-booking-updates - Позначити оновлення як прочитані
exports.acknowledgeBookingUpdatesForTenant = async (req, res) => {
    const tenantId = req.user.id; 
    try {
        const [updatedCount] = await Booking.update(
            { is_update_seen_by_tenant: true },
            {
                where: {
                    tenant_id: tenantId,
                    is_update_seen_by_tenant: false,
                    status: { [Op.in]: ['confirmed', 'rejected'] }
                }
            }
        );
        console.log(`${updatedCount} booking updates acknowledged for tenant ${tenantId}`);
        res.status(200).json({ message: 'Booking updates acknowledged.', count: updatedCount });
    } catch (error) {
        console.error('Error acknowledging booking updates for tenant:', error); 
        res.status(500).json({ message: 'Server error.' });
    }
};