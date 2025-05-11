// frontend/src/App.js

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ListingsPage from './pages/ListingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ManageListingsPage from './pages/ManageListingsPage';
import AdminPage from './pages/AdminPage';
import CreateListingPage from './pages/CreateListingPage';
import ListingDetailPage from './pages/ListingDetail';
// Import the new EditListingPage
import EditListingPage from './pages/EditListingPage'; // <-- Import the new page


import ProtectedRoute from './components/ProtectedRoute';


function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Add other public routes here */}

          {/* Protected Routes */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

           <Route
             path="/manage-listings"
             element={
               <ProtectedRoute allowedRoles={['owner']}>
                 <ManageListingsPage />
               </ProtectedRoute>
             }
           />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />

           <Route
             path="/create-listing"
             element={
               <ProtectedRoute allowedRoles={['owner']}>
                 <CreateListingPage />
               </ProtectedRoute>
             }
           />

           {/* --- Add the route for editing a listing, protected for owners/admins --- */}
           {/* This route includes a parameter ':id' */}
           <Route
             path="/manage-listings/edit/:id" // Path matching the link from ManageListingsPage
             element={
               <ProtectedRoute allowedRoles={['owner', 'admin']}> {/* Protected: requires owner or admin */}
                 <EditListingPage />
               </ProtectedRoute>
             }
           />
           {/* --- End of Edit Listing Route --- */}


          {/* Add other protected routes here */}

          {/* Optional: Catch-all route for 404 Not Found */}
          {/* <Route path="*" element={<NotFoundPage />} /> */}

        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;