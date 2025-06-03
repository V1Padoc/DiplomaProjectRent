// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function ProfilePage() {
  const { user, loading: authLoading, token, login } = useAuth(); // Get login to refresh user data contextually

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '', // This will be First Name
    last_name: '', // Added Last Name
    bio: '',
    phone_number: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  
  const [submitting, setSubmitting] = useState(false); // For general profile update
  const [error, setError] = useState(''); // For general profile update
  const [success, setSuccess] = useState(''); // For general profile update

  // State for password change form
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
        last_name: user.last_name || '', // Initialize last_name
        bio: user.bio || '',
        phone_number: user.phone_number || '',
      });
      setPreviewPhoto(user.profile_photo_url ? `http://localhost:5000/uploads/profiles/${user.profile_photo_url}` : null);
    }
  }, [user]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhotoFile(file);
      setPreviewPhoto(URL.createObjectURL(file)); // Show preview of new image
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    setPasswordError(''); // Clear password errors
    setPasswordSuccess(''); // Clear password successes

    const data = new FormData();
    data.append('name', formData.name); // First Name
    data.append('last_name', formData.last_name); // Last Name
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
      setSuccess(response.data.message);
      // Re-login to refresh user data in AuthContext
      if (token) {
          login(token); 
      }
      setIsEditing(false);
      setProfilePhotoFile(null); // Clear selected file after upload
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
      console.error("Profile update error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSubmitting(true);
    setPasswordError('');
    setPasswordSuccess('');
    setError(''); // Clear general errors
    setSuccess(''); // Clear general successes

    if (newPassword !== confirmNewPassword) {
        setPasswordError('New password and confirmation do not match.');
        setPasswordSubmitting(false);
        return;
    }
    if (newPassword.length < 6) { // Example: minimum password length
        setPasswordError('New password must be at least 6 characters long.');
        setPasswordSubmitting(false);
        return;
    }

    try {
        // *** FIXED: Added confirmNewPassword to the payload ***
        const response = await axios.post('http://localhost:5000/api/users/change-password', 
            { oldPassword, newPassword, confirmNewPassword }, 
            { headers: { Authorization: `Bearer ${token}` } }
        );
        setPasswordSuccess(response.data.message);
        // Clear password fields on success
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        // setShowPasswordForm(false); // Optionally hide form on success, but success message is good
    } catch (err) {
        console.error("Password change error:", err);
        setPasswordError(err.response?.data?.message || 'Failed to change password.');
    } finally {
        setPasswordSubmitting(false);
    }
};

  if (authLoading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading profile...</div>;
  }
  if (!user) {
    return <div className="container mx-auto px-4 py-8 text-center">User data not available. Please log in.</div>;
  }

  // Define a display name for the profile title or avatar fallback
  const displayName = user.name ? `${user.name}${user.last_name ? ' ' + user.last_name : ''}` : user.email || 'User';

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-sm shadow-md">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">User Profile</h1>

        {error && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">{error}</div>}
        {success && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded" role="alert">{success}</div>}

        <div className="text-center mb-6">
          <img
            // Updated fallback to use user.name or user.email for avatar generation
            src={previewPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email || 'U')}&background=random&size=128`} 
            alt="Profile"
            className="w-32 h-32 rounded-full mx-auto object-cover border-2 border-gray-300"
          />
          {isEditing && (
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Change Photo
            </button>
          )}
        </div>

        {!isEditing && !showPasswordForm ? ( // Only show profile details and buttons if neither form is active
          <>
            <div className="mb-4">
              <strong className="block text-gray-700">First Name:</strong>
              <p className="text-gray-800">{user.name || 'Not set'}</p>
            </div>
            {/* Added Last Name display field */}
            <div className="mb-4">
              <strong className="block text-gray-700">Last Name:</strong>
              <p className="text-gray-800">{user.last_name || 'Not set'}</p>
            </div>
            <div className="mb-4">
              <strong className="block text-gray-700">Email:</strong>
              <p className="text-gray-800">{user.email}</p>
            </div>
            <div className="mb-4">
              <strong className="block text-gray-700">Role:</strong>
              <p className="text-gray-800 capitalize">{user.role}</p>
            </div>
            <div className="mb-4">
              <strong className="block text-gray-700">Bio:</strong>
              <p className="text-gray-800 whitespace-pre-wrap">{user.bio || 'Not set'}</p>
            </div>
            <div className="mb-4">
              <strong className="block text-gray-700">Phone:</strong>
              <p className="text-gray-800">{user.phone_number || 'Not set'}</p>
            </div>
            <button
              onClick={() => {
                setIsEditing(true);
                setShowPasswordForm(false); // Hide password form if it was showing
                setError(''); 
                setSuccess('');
                setPasswordError(''); 
                setPasswordSuccess('');
              }}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline"
            >
              Edit Profile
            </button>
            <button
                onClick={() => {
                    setShowPasswordForm(true);
                    setIsEditing(false); // Hide general edit form
                    setError(''); 
                    setSuccess('');
                    setPasswordError(''); 
                    setPasswordSuccess('');
                }}
                className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline"
            >
                Change Password
            </button>
          </>
        ) : isEditing ? ( // Show general edit form if isEditing
          <form onSubmit={handleSubmit}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">First Name</label>
              <input
                type="text" name="name" id="name" value={formData.name} onChange={handleInputChange}
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700" 
                placeholder="First Name" // Added placeholder
              />
            </div>
            {/* Added Last Name input field */}
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="last_name">Last Name</label>
              <input
                type="text" name="last_name" id="last_name" value={formData.last_name} onChange={handleInputChange}
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700"
                placeholder="Last Name" // Added placeholder
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="bio">Bio</label>
              <textarea
                name="bio" id="bio" value={formData.bio} onChange={handleInputChange} rows="4"
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700"
              ></textarea>
            </div>
           <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone_number">Phone Number</label>
              <input
                type="tel" name="phone_number" id="phone_number" value={formData.phone_number} onChange={handleInputChange}
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700"
                required // *** ADDED: Make required ***
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={submitting}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                    setIsEditing(false);
                    // Reset form data and preview to original user data if canceling
                    if (user) {
                        setFormData({ 
                            name: user.name || '', 
                            last_name: user.last_name || '', // Reset last_name
                            bio: user.bio || '', 
                            phone_number: user.phone_number || '' 
                        });
                        setPreviewPhoto(user.profile_photo_url ? `http://localhost:5000/uploads/profiles/${user.profile_photo_url}` : null);
                        setProfilePhotoFile(null);
                    }
                    setError(''); 
                    setSuccess('');
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : ( // Show password change form if showPasswordForm
            <form onSubmit={handleChangePasswordSubmit} className="mt-6 pt-6 border-t border-gray-200">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Change Password</h2>
                {passwordError && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">{passwordError}</div>}
                {passwordSuccess && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded" role="alert">{passwordSuccess}</div>}
                
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="oldPassword">Old Password</label>
                    <input
                        type="password" name="oldPassword" id="oldPassword" value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700" required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPassword">New Password</label>
                    <input
                        type="password" name="newPassword" id="newPassword" value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700" required
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmNewPassword">Confirm New Password</label>
                    <input
                        type="password" name="confirmNewPassword" id="confirmNewPassword" value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700" required
                    />
                </div>
                <div className="flex items-center justify-between">
                    <button
                        type="submit"
                        disabled={passwordSubmitting}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline disabled:opacity-50"
                    >
                        {passwordSubmitting ? 'Changing...' : 'Update Password'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowPasswordForm(false);
                            setOldPassword('');
                            setNewPassword('');
                            setConfirmNewPassword('');
                            setPasswordError('');
                            setPasswordSuccess('');
                        }}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;