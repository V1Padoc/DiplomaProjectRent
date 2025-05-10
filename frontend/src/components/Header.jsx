// frontend/src/components/Header.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import the useAuth hook

function Header() {
  const { isAuthenticated, user, logout } = useAuth(); // Use the useAuth hook

  return (
    <header className="bg-white shadow-sm py-4"> {/* Minimalistic header styling */}
      <div className="container mx-auto px-4 flex justify-between items-center">
        {/* Logo or Site Title */}
        <Link to="/" className="text-2xl font-bold text-gray-800">
          ApartmentApp
        </Link>

        {/* Navigation */}
        <nav>
          <ul className="flex space-x-4"> {/* Simple horizontal navigation */}
            <li>
              <Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link>
            </li>
            <li>
              <Link to="/listings" className="text-gray-700 hover:text-gray-900">Listings</Link>
            </li>

            {/* Conditional rendering based on authentication state */}
            {isAuthenticated ? (
              <>
                {/* Links for logged-in users */}
                {user && user.role === 'owner' && (
                   <li>
                       {/* Example link for owners */}
                       <Link to="/manage-listings" className="text-gray-700 hover:text-gray-900">My Listings</Link>
                   </li>
                )}
                 {user && user.role === 'admin' && (
                    <li>
                         {/* Example link for admins */}
                         <Link to="/admin" className="text-gray-700 hover:text-gray-900">Admin Panel</Link>
                    </li>
                 )}
                <li>
                  {/* Link to user profile - will implement later */}
                  <Link to="/profile" className="text-gray-700 hover:text-gray-900">Profile</Link>
                </li>
                <li>
                  {/* Logout button */}
                  <button
                    onClick={logout} // Call the logout function from context
                    className="text-gray-700 hover:text-gray-900 focus:outline-none" // Basic button styling
                  >
                    Logout ({user?.name || user?.email}) {/* Show user name or email */}
                  </button>
                </li>
              </>
            ) : (
              <>
                {/* Links for logged-out users */}
                <li>
                  <Link to="/login" className="text-gray-700 hover:text-gray-900">Login</Link>
                </li>
                <li>
                  <Link to="/register" className="text-gray-700 hover:text-gray-900">Register</Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;