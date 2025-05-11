// frontend/src/pages/ProfilePage.jsx

import React from 'react';
import { useAuth } from '../context/AuthContext'; // Import useAuth to display user info

function ProfilePage() {
  const { user, loading } = useAuth(); // Get user data from context

   if (loading) {
       return <div>Loading profile...</div>; // Show loading state
   }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">User Profile</h1>
      {user ? ( // Only render user info if user data is available
          <div>
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Role:</strong> {user.role}</p>
               <p><strong>Joined:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
              {/* Display other user details here */}
          </div>
      ) : (
          <p>User data not available.</p> // Should not happen with ProtectedRoute, but good fallback
      )}
    </div>
  );
}

export default ProfilePage;