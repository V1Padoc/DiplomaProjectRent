import React from 'react';
import { Link } from 'react-router-dom'; // Import Link

function Header() {
  return (
    <header className="fixed top-0 left-0 w-full bg-white shadow-sm z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        {/* Site Title or Logo - Use Link for homepage */}
        <Link to="/" className="text-xl font-semibold text-gray-900 hover:text-gray-700">
          Rental App
        </Link>

        {/* Navigation */}
        <nav>
          <ul className="flex space-x-4">
            {/* Use Link instead of a */}
            <li><Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link></li>
            <li><Link to="/listings" className="text-gray-700 hover:text-gray-900">Listings</Link></li>
            <li><Link to="/login" className="text-gray-700 hover:text-gray-900">Login</Link></li>
            <li><Link to="/register" className="text-gray-700 hover:text-gray-900">Register</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;