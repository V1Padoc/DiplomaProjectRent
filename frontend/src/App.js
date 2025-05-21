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
import EditListingPage from './pages/EditListingPage';
// Import the new ChatPage
import ChatPage from './pages/ChatPage'; // <-- Import the new page
import MyChatsPage from './pages/MyChatsPage'; 

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
              <ProtectedRoute> {/* Requires authentication */}
                <ProfilePage />
              </ProtectedRoute>
            }
          />

           <Route
             path="/manage-listings"
             element={
               <ProtectedRoute allowedRoles={['owner']}> {/* Protected for owners */}
                 <ManageListingsPage />
               </ProtectedRoute>
             }
           />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}> {/* Protected for admins */}
                  <AdminPage />
                </ProtectedRoute>
              }
            />

           <Route
             path="/create-listing"
             element={
               <ProtectedRoute allowedRoles={['owner']}> {/* Protected for owners */}
                 <CreateListingPage />
               </ProtectedRoute>
             }
           />

           <Route
             path="/manage-listings/edit/:id"
             element={
               <ProtectedRoute allowedRoles={['owner', 'admin']}> {/* Protected for owners/admins */}
                 <EditListingPage />
               </ProtectedRoute>
             }
           />

           {/* --- Add the route for the Chat Page, protected for authenticated users --- */}
           {/* The route path includes the listingId parameter */}
           <Route
             path="/listings/:listingId/chat" // Path matching the backend endpoint structure
             element={
               <ProtectedRoute> {/* Requires ANY authenticated user */}
                 <ChatPage />
               </ProtectedRoute>
             }
           />
           {/* --- End of Chat Page Route --- */}

 {/* *** NEW: Route for MyChatsPage *** */}
          <Route
            path="/my-chats"
            element={
              <ProtectedRoute> {/* Requires ANY authenticated user */}
                <MyChatsPage />
              </ProtectedRoute>
            }
          />
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