// frontend/src/pages/ManageListingsPage.jsx

import React from 'react';
import { useAuth } from '../context/AuthContext'; // Optional: use auth context if needed here

function ManageListingsPage() {
     const { user } = useAuth(); // Get user to confirm role (optional visual check)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Manage Your Listings</h1>
       {user && user.role === 'owner' ? (
          <p>This page is for owners to create, edit, and delete their listings.</p>
       ) : (
           <p>You must be an owner to manage listings.</p> // Should not be seen due to ProtectedRoute role check
       )}
      {/* Listing management UI will go here */}
    </div>
  );
}

export default ManageListingsPage;