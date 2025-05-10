import React from 'react';

function Footer() {
  return (
    // Apply Tailwind classes for styling: sticks to the bottom (will be pushed down by content), light background, text color
    <footer className="bg-gray-50 text-gray-700 py-4 text-center">
      <div className="container mx-auto px-4">
        {/* Simple text for the footer */}
        <p>© {new Date().getFullYear()} Rental App. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;