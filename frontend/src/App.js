import React from 'react';
import { Routes, Route } from 'react-router-dom'; // Import Routes and Route

import Header from './components/Header';
import Footer from './components/Footer';

// Import or create placeholder components for your pages
// We'll create these shortly if you don't have them
import HomePage from './pages/HomePage'; // Placeholder - create this
import ListingsPage from './pages/ListingsPage'; // Placeholder - create this
import LoginPage from './pages/LoginPage'; // Placeholder - create this
import RegisterPage from './pages/RegisterPage'; // Placeholder - create this
// Add imports for other pages as you create them (ListingDetail, Profile, etc.)


function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main content area */}
      <main className="flex-grow pt-16">
        {/* Use Routes to define the different paths */}
        <Routes>
          {/* Define a Route for each page */}
          <Route path="/" element={<HomePage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Example of a dynamic route for listing details (will need more later) */}
          {/* <Route path="/listings/:id" element={<ListingDetail />} /> */}

          {/* Optional: A catch-all route for 404 pages */}
          {/* <Route path="*" element={<NotFoundPage />} /> */}
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;