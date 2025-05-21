// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function ProfilePage() {
  const { user, loading: authLoading, token, login } = useAuth(); // Get login to refresh user data contextually

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    phone_number: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
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

    const data = new FormData();
    data.append('name', formData.name);
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
      // Refresh user data in AuthContext by re-triggering the login logic (which fetches user)
      // or by adding a dedicated refreshUser function to AuthContext.
      // For simplicity, if 'login' in AuthContext fetches user data, this works.
      // A more robust way would be an explicit refreshUser function in AuthContext.
      // For now, let's assume `login(token)` implicitly refreshes user data.
      if (response.data.user && token) {
          // Manually update user in context for immediate reflection IF AuthContext doesn't auto-refresh.
          // This is a simplified approach. A dedicated refreshUser in AuthContext is better.
          // Forcing a re-fetch or update via AuthContext is key.
          // Let's call login again to force user data refetch in AuthContext.
          login(token); // This should update the user in AuthContext
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

  if (authLoading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading profile...</div>;
  }
  if (!user) {
    return <div className="container mx-auto px-4 py-8 text-center">User data not available. Please log in.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-sm shadow-md">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">User Profile</h1>

        {error && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">{error}</div>}
        {success && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded" role="alert">{success}</div>}

        <div className="text-center mb-6">
          <img
            src={previewPhoto || 'https://via.placeholder.com/150'} // Fallback placeholder
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

        {!isEditing ? (
          <>
            <div className="mb-4">
              <strong className="block text-gray-700">Name:</strong>
              <p className="text-gray-800">{user.name || 'Not set'}</p>
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
              onClick={() => setIsEditing(true)}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline"
            >
              Edit Profile
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">Name</label>
              <input
                type="text" name="name" id="name" value={formData.name} onChange={handleInputChange}
                className="shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700" required
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
                        setFormData({ name: user.name || '', bio: user.bio || '', phone_number: user.phone_number || '' });
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
        )}
      </div>
    </div>
  );
}

export default ProfilePage;