// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api.js';

function ProfilePage() {
  const { user, loading: authLoading, token, login } = useAuth(); // `login` function is used to update user context

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    last_name: '',
    bio: '',
    phone_number: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null); // Stores the actual File object
  const [previewPhoto, setPreviewPhoto] = useState(null); // Stores URL for displaying preview (could be blob: or Cloudinary URL)
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const fileInputRef = useRef(null); // Ref for the hidden file input element

  // Effect to initialize form data and photo preview when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        last_name: user.last_name || '',
        bio: user.bio || '',
        phone_number: user.phone_number || '',
      });
      // Set previewPhoto to the user's current profile photo URL from the backend
      setPreviewPhoto(user.profile_photo_url || null);
    }
    // This effect does not need a cleanup function here, as individual Blob URLs
    // are managed where they are created/replaced/no longer needed.
  }, [user]); // Dependency on `user` ensures this runs when user data loads or changes

  // Handler for text input changes
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handler for file input change (profile photo selection)
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // IMPORTANT: Revoke the previous Blob URL before creating a new one to prevent memory leaks
      if (previewPhoto && previewPhoto.startsWith('blob:')) {
        URL.revokeObjectURL(previewPhoto);
      }
      setProfilePhotoFile(file); // Store the actual file to be uploaded
      setPreviewPhoto(URL.createObjectURL(file)); // Create a Blob URL for instant preview
    } else {
        // If user cancels file selection, revert to previous photo or null
        if (profilePhotoFile) { // If a file was previously selected
            if (previewPhoto && previewPhoto.startsWith('blob:')) {
                URL.revokeObjectURL(previewPhoto);
            }
            setProfilePhotoFile(null);
            setPreviewPhoto(user?.profile_photo_url || null); // Revert to stored user photo or null
        }
    }
  };

  // Handler for submitting profile updates
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Clear all previous messages
    setError(''); setSuccess(''); setPasswordError(''); setPasswordSuccess('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('last_name', formData.last_name);
    data.append('bio', formData.bio);
    data.append('phone_number', formData.phone_number);
    if (profilePhotoFile) {
      data.append('profilePhoto', profilePhotoFile); // Append the actual File object
    }

    try {
      const response = await api.put('/users/profile', data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data' is typically set automatically by the browser for FormData
        },
      });
      setSuccess(response.data.message || "Профіль успішно оновлено!");
      
      // Update the user data in AuthContext. This will trigger the `useEffect` above,
      // which will then update `previewPhoto` with the new URL from `response.data.user`.
      if (token && response.data.user) {
          login(token, response.data.user); 
      }
      
      setIsEditing(false); // Exit editing mode
      setProfilePhotoFile(null); // Clear the file state after successful upload

      // The Blob URL (if any) is now stale and its cleanup will be handled by the `handleFileChange` on subsequent selections,
      // or implicitly by garbage collection if no longer referenced, or if the component unmounts.
      // Since `previewPhoto` is updated via `user` context, explicit `URL.revokeObjectURL` for the *previous* blob here is unnecessary.

      setTimeout(() => setSuccess(''), 3000); // Clear success message after 3 seconds
    } catch (err) {
      // If upload failed, explicitly revoke the Blob URL if it exists
      if (previewPhoto && previewPhoto.startsWith('blob:')) {
         URL.revokeObjectURL(previewPhoto);
      }
      // Revert preview photo to the user's current photo stored in context
      setPreviewPhoto(user?.profile_photo_url || null);
      setProfilePhotoFile(null); // Clear the file state as upload failed

      setError(err.response?.data?.message || 'Не вдалося оновити профіль.');
      console.error("Profile update error:", err);
      setTimeout(() => setError(''), 3000); // Clear error message after 3 seconds
    } finally {
      setSubmitting(false); // End submission process
    }
  };

  // Handler for changing password submission
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSubmitting(true);
    // Clear all previous messages
    setPasswordError(''); setPasswordSuccess(''); setError(''); setSuccess('');

    // Client-side validation for new passwords
    if (newPassword !== confirmNewPassword) {
        setPasswordError('Новий пароль та підтвердження не збігаються.');
        setPasswordSubmitting(false); return;
    }
    if (newPassword.length < 6) {
        setPasswordError('Новий пароль повинен містити щонайменше 6 символів.');
        setPasswordSubmitting(false); return;
    }

    try {
        const response = await api.post('/users/change-password', 
            { oldPassword, newPassword, confirmNewPassword }, 
            { headers: { Authorization: `Bearer ${token}` } }
        );
        setPasswordSuccess(response.data.message || "Пароль успішно змінено!");
        // Clear password fields on success
        setOldPassword(''); setNewPassword(''); setConfirmNewPassword('');
        setTimeout(() => {
            setPasswordSuccess('');
            // setShowPasswordForm(false); // Optionally hide password form after success
        }, 3000);
    } catch (err) {
        console.error("Password change error:", err);
        setPasswordError(err.response?.data?.message || 'Не вдалося змінити пароль.');
        setTimeout(() => setPasswordError(''), 3000); // Clear error after 3 seconds
    } finally {
        setPasswordSubmitting(false);
    }
  };

  // Helper function to generate UI Avatars URL if no profile photo is available
  const getUiAvatarUrl = (name, lastName) => {
    const initials = `${name ? name.charAt(0) : ''}${lastName ? lastName.charAt(0) : ''}`.trim() || (user?.email ? user.email.charAt(0) : 'U');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=128&font-size=0.5&bold=true`;
  };


  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження...</div>;
  }
  if (!user) {
    return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Будь ласка, увійдіть, щоб переглянути свій профіль.</div>;
  }

  const displayName = `${user.name || ''}${user.last_name ? ' ' + user.last_name : ''}`.trim() || user.email;
  const joinedDate = user.created_at ? new Date(user.created_at).toLocaleDateString('uk-UA', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Н/Д';


  return (
    <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="px-4 sm:px-10 md:px-20 lg:px-40 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col max-w-3xl w-full flex-1 bg-white shadow-xl rounded-lg p-6 md:p-8">
          
          {/* Profile Header Section */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <img
                src={previewPhoto || getUiAvatarUrl(user.name, user.last_name)}
                alt="Профіль"
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 border-4 border-slate-200"
              />
              {isEditing && (
                 <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()} // Trigger hidden file input click
                    className="absolute -bottom-2 -right-2 bg-slate-600 hover:bg-slate-700 text-white p-2 rounded-full shadow-md transition-colors"
                    aria-label="Змінити фото профілю"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 20 000-2.828z" />
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                  </button>
              )}
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-[#0d151c] text-2xl font-bold leading-tight tracking-tight">{displayName}</p>
              <p className="text-[#49749c] text-base font-normal leading-normal capitalize">{user.role === 'owner' ? 'Власник' : 'Користувач'}</p>
              <p className="text-[#49749c] text-sm font-normal leading-normal">Приєднався {joinedDate}</p>
            </div>
            {/* Conditional button for editing profile */}
            {!isEditing && !showPasswordForm && (
              <button
                onClick={() => { 
                    setIsEditing(true); 
                    setShowPasswordForm(false); // Ensure password form is hidden
                    setError(''); setSuccess(''); setPasswordError(''); setPasswordSuccess(''); // Clear all messages
                }}
                className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-[#e7edf4] text-[#0d151c] text-sm font-bold leading-normal tracking-[0.015em] w-full max-w-xs sm:w-auto hover:bg-slate-200 transition-colors"
              >
                <span className="truncate">Редагувати профіль</span>
              </button>
            )}
          </div>

          {/* Messages Area (errors/success from profile update or password change) */}
          {error && <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Помилка</p><p>{error}</p></div>}
          {success && <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p className="font-bold">Успіх</p><p>{success}</p></div>}
          {passwordError && <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Помилка пароля</p><p>{passwordError}</p></div>}
          {passwordSuccess && <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p className="font-bold">Успіх</p><p>{passwordSuccess}</p></div>}


          {/* Conditional rendering: View Profile Info / Edit Form / Change Password Form */}
          {!isEditing && !showPasswordForm ? (
            <>
              <h2 className="text-[#0d151c] text-xl font-bold leading-tight tracking-tight mb-4">Інформація про профіль</h2>
              <div className="space-y-5">
                <div className="grid grid-cols-[_minmax(80px,25%)_1fr] items-center py-3 border-t border-t-[#cedce8]">
                  <p className="text-[#49749c] text-sm font-normal">Електронна пошта</p>
                  <p className="text-[#0d151c] text-sm font-normal break-words">{user.email}</p>
                </div>
                <div className="grid grid-cols-[_minmax(80px,25%)_1fr] items-center py-3 border-t border-t-[#cedce8]">
                  <p className="text-[#49749c] text-sm font-normal">Телефон</p>
                  <p className="text-[#0d151c] text-sm font-normal">{user.phone_number || 'Не встановлено'}</p>
                </div>
                <div className="grid grid-cols-[_minmax(80px,25%)_1fr] items-start py-3 border-t border-t-[#cedce8]">
                  <p className="text-[#49749c] text-sm font-normal mt-0.5">Біографія</p>
                  <p className="text-[#0d151c] text-sm font-normal whitespace-pre-wrap break-words">{user.bio || 'Не встановлено'}</p>
                </div>
              </div>
              <div className="mt-8">
                <button
                  onClick={() => { 
                      setShowPasswordForm(true); 
                      setIsEditing(false); // Ensure editing mode is off
                      setError(''); setSuccess(''); setPasswordError(''); setPasswordSuccess(''); // Clear all messages
                  }}
                  className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-[#e7edf4] text-[#0d151c] text-sm font-bold leading-normal tracking-[0.015em] w-full max-w-xs sm:w-auto hover:bg-slate-200 transition-colors"
                >
                  <span className="truncate">Змінити пароль</span>
                </button>
              </div>
            </>
          ) : isEditing ? ( // Show edit profile form
            <form onSubmit={handleSubmit}>
              <h2 className="text-[#0d151c] text-xl font-bold leading-tight tracking-tight mb-6">Редагувати інформацію профілю</h2>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="name">Ім'я</label>
                  <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange}
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="Введіть ім'я"/>
                </div>
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="last_name">Прізвище</label>
                  <input type="text" name="last_name" id="last_name" value={formData.last_name} onChange={handleInputChange}
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="Введіть прізвище"/>
                </div>
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="bio">Біографія</label>
                  <textarea name="bio" id="bio" value={formData.bio} onChange={handleInputChange} rows="4"
                    className="form-textarea w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="Розкажіть нам про себе..."></textarea>
                </div>
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="phone_number">Номер телефону</label>
                  <input type="tel" name="phone_number" id="phone_number" value={formData.phone_number} onChange={handleInputChange}
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="напр., +380-50-123-4567" required/>
                </div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-3">
                <button type="button"
                  onClick={() => {
                      setIsEditing(false); // Exit editing mode
                      // Revert form data to current user data from context
                      if (user) {
                          setFormData({ 
                              name: user.name || '', 
                              last_name: user.last_name || '', 
                              bio: user.bio || '', 
                              phone_number: user.phone_number || '' 
                          });
                          // Clean up the Blob URL if user selected a new file and then clicked cancel
                          if (previewPhoto && previewPhoto.startsWith('blob:')) {
                             URL.revokeObjectURL(previewPhoto);
                           }
                          setPreviewPhoto(user.profile_photo_url || null); // Revert preview to original
                          setProfilePhotoFile(null); // Clear the selected file
                      }
                      setError(''); setSuccess(''); // Clear messages
                  }}
                  className="order-2 sm:order-1 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-slate-200 hover:bg-slate-300 text-[#0d151c] text-sm font-bold transition-colors"
                > Скасувати </button>
                <button type="submit" disabled={submitting}
                  className="order-1 sm:order-2 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-70"
                > {submitting ? 'Збереження...' : 'Зберегти зміни'} </button>
              </div>
            </form>
          ) : ( // showPasswordForm is true, show change password form
            <form onSubmit={handleChangePasswordSubmit}>
                <h2 className="text-[#0d151c] text-xl font-bold leading-tight tracking-tight mb-6">Змінити пароль</h2>
                <div className="space-y-5">
                    <div>
                        <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="oldPassword">Старий пароль</label>
                        <input type="password" name="oldPassword" id="oldPassword" value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" required />
                    </div>
                    <div>
                        <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="newPassword">Новий пароль</label>
                        <input type="password" name="newPassword" id="newPassword" value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" required />
                    </div>
                    <div>
                        <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="confirmNewPassword">Підтвердьте новий пароль</label>
                        <input type="password" name="confirmNewPassword" id="confirmNewPassword" value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" required />
                    </div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-3">
                    <button type="button"
                        onClick={() => { 
                            setShowPasswordForm(false); // Hide password form
                            // Clear password fields and messages
                            setOldPassword(''); setNewPassword(''); setConfirmNewPassword(''); 
                            setPasswordError(''); setPasswordSuccess('');
                        }}
                        className="order-2 sm:order-1 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-slate-200 hover:bg-slate-300 text-[#0d151c] text-sm font-bold transition-colors"
                    > Скасувати </button>
                    <button type="submit" disabled={passwordSubmitting}
                        className="order-1 sm:order-2 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-70"
                    > {passwordSubmitting ? 'Зміна...' : 'Оновити пароль'} </button>
                </div>
            </form>
        )}
        </div>
      </div>
      {/* Global CSS for forms */}
      <style jsx global>{`
        /* Ensure Tailwind forms plugin is active for form-input, form-textarea */
        .form-input, .form-textarea {
          @apply shadow-sm; 
        }
        .tracking-tight { letter-spacing: -0.025em; }
      `}</style>
    </div>
  );
}

export default ProfilePage;