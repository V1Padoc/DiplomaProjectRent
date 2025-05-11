// frontend/src/pages/AdminPage.jsx

import React from 'react';
import { useAuth } from '../context/AuthContext'; // Optional: use auth context if needed here

function AdminPage() {
    const { user } = useAuth(); // Get user to confirm role (optional visual check)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Admin Panel</h1>
        {user && user.role === 'admin' ? (
           <p>This page is for administrators to moderate users and listings.</p>
        ) : (
            <p>You must be an admin to access this panel.</p> // Should not be seen due to ProtectedRoute role check
        )}
      {/* Admin UI will go here */}
    </div>
  );
}

export default AdminPage;