// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function ProfilePage() {
  const { user, loading: authLoading, token, login } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    last_name: '',
    bio: '',
    phone_number: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  
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

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        last_name: user.last_name || '',
        bio: user.bio || '',
        phone_number: user.phone_number || '',
      });
      if (user.profile_photo_url) {
        // Ensure the URL is constructed correctly if profile_photo_url is just a filename
        const filename = user.profile_photo_url.split('/').pop();
        setPreviewPhoto(`http://localhost:5000/uploads/profiles/${filename}`);
      } else {
        setPreviewPhoto(null);
      }
    }
  }, [user]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhotoFile(file);
      setPreviewPhoto(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(''); setSuccess(''); setPasswordError(''); setPasswordSuccess('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('last_name', formData.last_name);
    data.append('bio', formData.bio);
    data.append('phone_number', formData.phone_number);
    if (profilePhotoFile) {
      data.append('profilePhoto', profilePhotoFile);
    }

    try {
      const response = await axios.put('http://localhost:5000/api/users/profile', data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setSuccess(response.data.message || "Profile updated successfully!");
      if (token) { login(token); }
      setIsEditing(false);
      setProfilePhotoFile(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
      console.error("Profile update error:", err);
      setTimeout(() => setError(''), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSubmitting(true);
    setPasswordError(''); setPasswordSuccess(''); setError(''); setSuccess('');

    if (newPassword !== confirmNewPassword) {
        setPasswordError('New password and confirmation do not match.');
        setPasswordSubmitting(false); return;
    }
    if (newPassword.length < 6) {
        setPasswordError('New password must be at least 6 characters long.');
        setPasswordSubmitting(false); return;
    }

    try {
        const response = await axios.post('http://localhost:5000/api/users/change-password', 
            { oldPassword, newPassword, confirmNewPassword }, 
            { headers: { Authorization: `Bearer ${token}` } }
        );
        setPasswordSuccess(response.data.message || "Password changed successfully!");
        setOldPassword(''); setNewPassword(''); setConfirmNewPassword('');
        setTimeout(() => {
            setPasswordSuccess('');
            // setShowPasswordForm(false); // Optionally hide after success
        }, 3000);
    } catch (err) {
        console.error("Password change error:", err);
        setPasswordError(err.response?.data?.message || 'Failed to change password.');
        setTimeout(() => setPasswordError(''), 3000);
    } finally {
        setPasswordSubmitting(false);
    }
  };

  const getUiAvatarUrl = (name, lastName) => {
    const initials = `${name ? name.charAt(0) : ''}${lastName ? lastName.charAt(0) : ''}` || (user?.email ? user.email.charAt(0) : 'U');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=128&font-size=0.5&bold=true`;
  };


  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Loading...</div>;
  }
  if (!user) {
    return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-slate-700" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Please log in to view your profile.</div>;
  }

  const displayName = `${user.name || ''}${user.last_name ? ' ' + user.last_name : ''}`.trim() || user.email;
  const joinedDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';


  return (
    <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="px-4 sm:px-10 md:px-20 lg:px-40 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col max-w-3xl w-full flex-1 bg-white shadow-xl rounded-lg p-6 md:p-8">
          
          {/* Profile Header Section */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <img
                src={previewPhoto || getUiAvatarUrl(user.name, user.last_name)}
                alt="Profile"
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 border-4 border-slate-200"
              />
              {isEditing && (
                 <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 bg-slate-600 hover:bg-slate-700 text-white p-2 rounded-full shadow-md transition-colors"
                    aria-label="Change profile photo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                  </button>
              )}
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-[#0d151c] text-2xl font-bold leading-tight tracking-tight">{displayName}</p>
              <p className="text-[#49749c] text-base font-normal leading-normal capitalize">{user.role}</p>
              <p className="text-[#49749c] text-sm font-normal leading-normal">Joined on {joinedDate}</p>
            </div>
            {!isEditing && !showPasswordForm && (
              <button
                onClick={() => { setIsEditing(true); setShowPasswordForm(false); setError(''); setSuccess(''); setPasswordError(''); setPasswordSuccess('');}}
                className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-[#e7edf4] text-[#0d151c] text-sm font-bold leading-normal tracking-[0.015em] w-full max-w-xs sm:w-auto hover:bg-slate-200 transition-colors"
              >
                <span className="truncate">Edit Profile</span>
              </button>
            )}
          </div>

          {/* Messages Area */}
          {error && <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Error</p><p>{error}</p></div>}
          {success && <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p className="font-bold">Success</p><p>{success}</p></div>}
          {passwordError && <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Password Error</p><p>{passwordError}</p></div>}
          {passwordSuccess && <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert"><p className="font-bold">Success</p><p>{passwordSuccess}</p></div>}


          {/* View Profile Information or Edit Form */}
          {!isEditing && !showPasswordForm ? (
            <>
              <h2 className="text-[#0d151c] text-xl font-bold leading-tight tracking-tight mb-4">Profile Information</h2>
              <div className="space-y-5">
                <div className="grid grid-cols-[_minmax(80px,25%)_1fr] items-center py-3 border-t border-t-[#cedce8]">
                  <p className="text-[#49749c] text-sm font-normal">Email</p>
                  <p className="text-[#0d151c] text-sm font-normal break-words">{user.email}</p>
                </div>
                <div className="grid grid-cols-[_minmax(80px,25%)_1fr] items-center py-3 border-t border-t-[#cedce8]">
                  <p className="text-[#49749c] text-sm font-normal">Phone</p>
                  <p className="text-[#0d151c] text-sm font-normal">{user.phone_number || 'Not set'}</p>
                </div>
                <div className="grid grid-cols-[_minmax(80px,25%)_1fr] items-start py-3 border-t border-t-[#cedce8]">
                  <p className="text-[#49749c] text-sm font-normal mt-0.5">Bio</p>
                  <p className="text-[#0d151c] text-sm font-normal whitespace-pre-wrap break-words">{user.bio || 'Not set'}</p>
                </div>
              </div>
              <div className="mt-8">
                <button
                  onClick={() => { setShowPasswordForm(true); setIsEditing(false); setError(''); setSuccess(''); setPasswordError(''); setPasswordSuccess('');}}
                  className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-[#e7edf4] text-[#0d151c] text-sm font-bold leading-normal tracking-[0.015em] w-full max-w-xs sm:w-auto hover:bg-slate-200 transition-colors"
                >
                  <span className="truncate">Change Password</span>
                </button>
              </div>
            </>
          ) : isEditing ? (
            <form onSubmit={handleSubmit}>
              <h2 className="text-[#0d151c] text-xl font-bold leading-tight tracking-tight mb-6">Edit Profile Information</h2>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="name">First Name</label>
                  <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange}
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="Enter first name"/>
                </div>
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="last_name">Last Name</label>
                  <input type="text" name="last_name" id="last_name" value={formData.last_name} onChange={handleInputChange}
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="Enter last name"/>
                </div>
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="bio">Bio</label>
                  <textarea name="bio" id="bio" value={formData.bio} onChange={handleInputChange} rows="4"
                    className="form-textarea w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="Tell us about yourself..."></textarea>
                </div>
                <div>
                  <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="phone_number">Phone Number</label>
                  <input type="tel" name="phone_number" id="phone_number" value={formData.phone_number} onChange={handleInputChange}
                    className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" placeholder="e.g., +1-555-123-4567" required/>
                </div>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-3">
                <button type="button"
                  onClick={() => {
                      setIsEditing(false);
                      if (user) {
                          setFormData({ name: user.name || '', last_name: user.last_name || '', bio: user.bio || '', phone_number: user.phone_number || '' });
                          setPreviewPhoto(user.profile_photo_url ? `http://localhost:5000/uploads/profiles/${user.profile_photo_url.split('/').pop()}` : null);
                          setProfilePhotoFile(null);
                      }
                      setError(''); setSuccess('');
                  }}
                  className="order-2 sm:order-1 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-slate-200 hover:bg-slate-300 text-[#0d151c] text-sm font-bold transition-colors"
                > Cancel </button>
                <button type="submit" disabled={submitting}
                  className="order-1 sm:order-2 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-70"
                > {submitting ? 'Saving...' : 'Save Changes'} </button>
              </div>
            </form>
          ) : ( // showPasswordForm is true
            <form onSubmit={handleChangePasswordSubmit}>
                <h2 className="text-[#0d151c] text-xl font-bold leading-tight tracking-tight mb-6">Change Password</h2>
                <div className="space-y-5">
                    <div>
                        <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="oldPassword">Old Password</label>
                        <input type="password" name="oldPassword" id="oldPassword" value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" required />
                    </div>
                    <div>
                        <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="newPassword">New Password</label>
                        <input type="password" name="newPassword" id="newPassword" value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" required />
                    </div>
                    <div>
                        <label className="block text-[#49749c] text-sm font-medium mb-1" htmlFor="confirmNewPassword">Confirm New Password</label>
                        <input type="password" name="confirmNewPassword" id="confirmNewPassword" value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="form-input w-full rounded-lg border-[#cedce8] focus:border-blue-500 focus:ring-blue-500 text-sm text-[#0d151c]" required />
                    </div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-3">
                    <button type="button"
                        onClick={() => { setShowPasswordForm(false); setOldPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordError(''); setPasswordSuccess('');}}
                        className="order-2 sm:order-1 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-slate-200 hover:bg-slate-300 text-[#0d151c] text-sm font-bold transition-colors"
                    > Cancel </button>
                    <button type="submit" disabled={passwordSubmitting}
                        className="order-1 sm:order-2 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-70"
                    > {passwordSubmitting ? 'Changing...' : 'Update Password'} </button>
                </div>
            </form>
        )}
        </div>
      </div>
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