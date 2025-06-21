// frontend/src/context/AuthContext.js

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

import api from '../api/api.js';
import { io } from 'socket.io-client'; // Import socket.io-client

// API URL base
const API_URL = '';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

// Create the Auth Context
const AuthContext = createContext();

// Create a custom hook to use the Auth Context easily
export const useAuth = () => {
  return useContext(AuthContext);
};

// Helper function to safely parse user from localStorage
const getInitialUser = () => {
  const storedUserString = localStorage.getItem('user');
  if (storedUserString && storedUserString !== 'undefined' && storedUserString !== 'null') {
    try {
      const parsedUser = JSON.parse(storedUserString);
      // Basic validation: ensure it's an object, not null, and maybe has an id
      if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
        return parsedUser;
      }
      // If parsing is successful but data is not what we expect, treat as invalid
      localStorage.removeItem('user');
      return null;
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
      localStorage.removeItem('user'); // Clear corrupted item
      return null;
    }
  }
  // If "user" item is "undefined" or "null" string, remove it.
  if (storedUserString === 'undefined' || storedUserString === 'null') {
    localStorage.removeItem('user');
  }
  return null;
};


// Create the Auth Provider component
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(getInitialUser()); // Use the safe getter
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null); // Socket instance

  // For Favorites
  const [favorites, setFavorites] = useState([]);

  // For Unread Notifications
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadBookingRequestsCount, setUnreadBookingRequestsCount] = useState(0); // For Owner: new requests
  const [unreadMyBookingsUpdatesCount, setUnreadMyBookingsUpdatesCount] = useState(0); // For Tenant: booking status changes
  const [unreadAdminTasksCount, setUnreadAdminTasksCount] = useState(0); // For Admin: new pending listings

  // New state for socket eligibility
  const [isSocketEligible, setIsSocketEligible] = useState(false);

  // logout function, memoized
  const logout = useCallback(() => {
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setFavorites([]);
    setUnreadMessagesCount(0);
    setUnreadBookingRequestsCount(0);
    setUnreadMyBookingsUpdatesCount(0);
    setUnreadAdminTasksCount(0);
    setSocket(null);
    setIsSocketEligible(false); // Reset eligibility on logout
    console.log('User logged out.');
  }, [socket]); // socket is a dependency for socket.disconnect()

  const fetchUnreadMessagesCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam) return;
    try {
      const response = await api.get(`${API_URL}/chats/my-unread-count`, {
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadMessagesCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread messages count:', error.response?.data?.message || error.message);
    }
  }, []); // Removed token from deps, pass it as param

  const fetchFavoriteIds = useCallback(async (currentTokenParam) => {
    if (currentTokenParam) {
        try {
            const response = await api.get(`${API_URL}/users/me/favorites/ids`, {
                headers: { Authorization: `Bearer ${currentTokenParam}` },
            });
            setFavorites(response.data.favorite_ids ? response.data.favorite_ids.map(String) : []);
        } catch (error) {
            console.error("Error fetching favorite IDs:", error.response?.data?.message || error.message);
            if (error.response?.status === 401 && currentTokenParam) { // Check currentTokenParam to avoid loop if already logging out
                // logout(); // Consider if auto-logout here is desired, or handled by refreshUser/login
            } else {
                setFavorites([]);
            }
        }
    } else {
        setFavorites([]);
    }
  }, []); // Removed token from deps, pass it as param. `logout` not needed if handled elsewhere

  // Fetch count of unread booking updates for tenants
  const fetchUnreadBookingUpdatesCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'tenant') return;
    try {
      const response = await api.get(`${API_URL}/users/me/unread-booking-updates-count`, { // You'd need to create this endpoint on backend
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadMyBookingsUpdatesCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread booking updates count:', error.response?.data?.message || error.message);
    }
  }, [user?.role]); // Add user.role dependency

  // Fetch count of admin tasks (e.g., pending listings)
  const fetchUnreadAdminTasksCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'admin') return;
    try {
      // Assuming an endpoint like /api/admin/tasks-count that returns { pendingListingsCount: X }
      const response = await api.get(`${API_URL}/admin/tasks-count`, { // You'd need to create this endpoint
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadAdminTasksCount(response.data.pendingListingsCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread admin tasks count:', error.response?.data?.message || error.message);
    }
  }, [user?.role]); // Add user.role dependency

  // Fetch count of new booking requests for owners (placeholder if needed, similar to above)
  const fetchUnreadBookingRequestsCountForOwner = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'owner') return;
    try {
      // Example: Endpoint to get count of 'pending' bookings for owner's listings
      const response = await api.get(`${API_URL}/bookings/owner/pending-count`, { // You'd need to create this endpoint
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setUnreadBookingRequestsCount(response.data.pendingCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread booking requests count for owner:', error.response?.data?.message || error.message);
    }
  }, [user?.role]);

  // New: fetchSocketEligibility
  const fetchSocketEligibility = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam) {
      setIsSocketEligible(false);
      return false;
    }
    try {
      const response = await api.get(`${API_URL}/auth/socket-eligibility`, {
        headers: { Authorization: `Bearer ${currentTokenParam}` },
      });
      setIsSocketEligible(response.data.eligible);
      return response.data.eligible; // Return for immediate use if needed
    } catch (error) {
      console.error('Failed to fetch socket eligibility:', error.response?.data?.message || error.message);
      setIsSocketEligible(false); // Default to not eligible on error
      return false;
    }
  }, []); // No dependencies needed here, token passed as param

  // Effect for initial authentication check and loading user data
  useEffect(() => {
    const attemptAutoLogin = async () => {
      const storedToken = localStorage.getItem('token');
      console.log('Attempting auto-login and socket eligibility check...');
      if (storedToken) {
        setToken(storedToken); // Set token state for other hooks/logic
        try {
          const res = await api.get(`${API_URL}/auth/user`, {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          });
          const userData = res.data;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData)); // Correctly store user object

          // Fetch eligibility
          await fetchSocketEligibility(storedToken);

          // Fetch other dependent data now that user is confirmed
          fetchUnreadMessagesCount(storedToken);
          fetchFavoriteIds(storedToken);
          // Fetch role-specific counts
          if (userData.role === 'tenant') {
            fetchUnreadBookingUpdatesCount(storedToken);
          }
          if (userData.role === 'admin') {
            fetchUnreadAdminTasksCount(storedToken);
          }
          if (userData.role === 'owner') {
            fetchUnreadBookingRequestsCountForOwner(storedToken);
          }

        } catch (err) {
          console.error('Auto-login failed (token invalid or server error):', err.response?.data?.message || err.message);
          logout(); // Use the logout function to clear all state
        }
      }
      setLoading(false);
    };

    attemptAutoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout, fetchUnreadMessagesCount, fetchFavoriteIds, fetchUnreadBookingUpdatesCount, fetchUnreadAdminTasksCount, fetchUnreadBookingRequestsCountForOwner, fetchSocketEligibility]); // Add stable callbacks including fetchSocketEligibility

  // Socket connection management
  useEffect(() => {
    // Only connect if token, user.id, AND isSocketEligible are true
    if (token && user?.id && isSocketEligible) {
      console.log(`User ${user.id} is eligible, attempting to connect socket.`);
      const newSocket = io(SOCKET_URL, {
        // MODIFIED: Send token in auth object for server-side verification
        auth: { token: token }
      });
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        // NO LONGER NEEDED: newSocket.emit('authenticate_socket', { userId: user.id, role: user.role });
        // The server will now handle authentication and room joining based on the token.
        // We might need a way for the server to confirm successful socket auth back to client if desired.
      });

      // Optional: Listen for a custom event from server confirming socket authentication
      newSocket.on('socket_authenticated', (data) => {
        console.log('Socket successfully authenticated by server:', data);
        // You could use this for UI feedback or further client-side logic if needed
      });

      newSocket.on('socket_auth_error', (error) => {
        console.error('Socket authentication failed:', error.message);
        // Handle error, e.g., disconnect, show message to user, or attempt re-authentication.
        // This might indicate an invalid/expired token for the socket.
        newSocket.disconnect();
      });

      newSocket.on('new_message_notification', (data) => {
        console.log('New message notification (AuthContext):', data);
         console.log(`Dispatching 'chat-update' event.`)
        fetchUnreadMessagesCount(token); // Uses current token from state
        window.dispatchEvent(new CustomEvent('chat-update', { detail: data }));
      });

      newSocket.on('messages_read_update', (data) => {
        console.log('Messages read update received (AuthContext):', data);
         console.log(`Dispatching 'chat-update' event for read status.`)
        fetchUnreadMessagesCount(token); // Uses current token from state
        window.dispatchEvent(new CustomEvent('chat-update', { detail: { type: 'read_update', ...data } }));
      });

      // Listener for new booking requests (for owners)
      newSocket.on('new_booking_request_owner', (data) => {
          console.log('AuthContext: Received new_booking_request_owner:', data);
          if (user && user.role === 'owner' ) {
              fetchUnreadBookingRequestsCountForOwner(token);
          }
      });

      // Listener for booking status updates (for tenants)
      newSocket.on('booking_status_update_tenant', (data) => {
        console.log('AuthContext: Received booking_status_update_tenant:', data);
        if (user && user.role === 'tenant' && data.tenantId === user.id) {
          fetchUnreadBookingUpdatesCount(token);
        }
      });

      // Listeners for admin tasks (e.g., new pending listing OR change affecting pending count)
      newSocket.on('admin_new_pending_listing', (data) => {
        console.log('AuthContext: Received admin_new_pending_listing:', data);
        if (user && user.role === 'admin') {
          fetchUnreadAdminTasksCount(token);
        }
      });
      newSocket.on('admin_pending_count_changed', (data) => {
        console.log('AuthContext: Received admin_pending_count_changed:', data);
        if (user && user.role === 'admin') {
          fetchUnreadAdminTasksCount(token);
        }
      });


      return () => {
        newSocket.off('connect');
        newSocket.off('socket_authenticated'); // <--- ADDED
        newSocket.off('socket_auth_error');   // <--- ADDED
        newSocket.off('new_message_notification');
        newSocket.off('messages_read_update');
        newSocket.off('new_booking_request_owner'); // Specific event name
        newSocket.off('booking_status_update_tenant'); // Specific event name
        newSocket.off('admin_new_pending_listing');
        newSocket.off('admin_pending_count_changed');
        newSocket.close();
        setSocket(null);
        console.log('Socket disconnected and cleaned up.');
      };
    } else if (socket) { // If token or user becomes null (e.g., logout) or eligibility changes
      console.log(`User ${user?.id} no longer eligible or logged out, disconnecting socket.`);
      socket.close();
      setSocket(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, user?.role, fetchUnreadMessagesCount, fetchUnreadBookingUpdatesCount, fetchUnreadAdminTasksCount, fetchUnreadBookingRequestsCountForOwner, isSocketEligible]); // Added isSocketEligible

  // *** MODIFIED LOGIN FUNCTION ***
  const login = async (newToken) => { // Only takes newToken
    if (!newToken) {
      console.error("Login called without a token.");
      logout(); // Clear state if no token
      return;
    }
    localStorage.setItem('token', newToken);
    setToken(newToken); // Set token in state first

    try {
      // Fetch user data using the new token
      const res = await api.get(`${API_URL}/auth/user`, {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      const userData = res.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      // Fetch eligibility and wait for it
      const eligible = await fetchSocketEligibility(newToken);
      console.log("Socket eligibility after login:", eligible);


      // Now that user, token, and eligibility are set, fetch other dependent data
      await fetchUnreadMessagesCount(newToken); // Make sure these complete
      await fetchFavoriteIds(newToken);
      // Fetch role-specific counts after login
      if (userData.role === 'tenant') {
        await fetchUnreadBookingUpdatesCount(newToken);
      }
      if (userData.role === 'admin') {
        await fetchUnreadAdminTasksCount(newToken);
      }
      if (userData.role === 'owner') {
        await fetchUnreadBookingRequestsCountForOwner(newToken);
      }
      // Navigation will be handled by LoginPage's useEffect or App router based on isAuthenticated
    } catch (err) {
      console.error('Failed to fetch user data after login:', err.response?.data?.message || err.message);
      logout(); // If fetching user fails, revert to logged-out state
    }
  };


  const refreshUser = async () => {
    if (token) {
      try {
        const config = { headers: { 'Authorization': `Bearer ${token}` } };
        const res = await api.get(`${API_URL}/auth/user`, config);
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      } catch (err) {
        console.error('Error refreshing user data:', err);
        if (err.response?.status === 401) logout();
      }
    }
  };

  const toggleFavorite = async (listingId) => {
    if (!token) return favorites.includes(String(listingId)); // Should ideally not be called if no token
    const stringListingId = String(listingId);
    const isCurrentlyFavorited = favorites.includes(stringListingId);
    try {
      if (isCurrentlyFavorited) {
        await api.delete(`${API_URL}/users/me/favorites/${stringListingId}`, { headers: { Authorization: `Bearer ${token}` } });
        setFavorites(prev => prev.filter(id => id !== stringListingId));
        return false;
      } else {
        await api.post(`${API_URL}/users/me/favorites/${stringListingId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setFavorites(prev => [...prev, stringListingId]);
        return true;
      }
    } catch (error) {
      console.error("Error toggling favorite:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) logout();
      return isCurrentlyFavorited; // Return original state on error
    }
  };

  const markChatAsRead = useCallback(async (listingId, chatPartnerId) => {
    if (!token || !listingId || !chatPartnerId) return 0;
    try {
      const response = await api.put(`${API_URL}/chats/mark-as-read`,
        { listingId: String(listingId), chatPartnerId: String(chatPartnerId) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchUnreadMessagesCount(token); // Refresh total count, pass token
      return response.data.count || 0;
    } catch (error) {
      console.error('Failed to mark chat as read:', error.response?.data?.message || error.message);
      if (error.response?.status === 401 && token) logout();
      return 0;
    }
  }, [token, fetchUnreadMessagesCount, logout]);

  // Function for tenant to acknowledge their booking updates (clears the count)
  const acknowledgeBookingUpdates = useCallback(async () => {
    if (!token || user?.role !== 'tenant') return;
    try {
      await api.put(`${API_URL}/users/me/acknowledge-booking-updates`, {}, { // You'd need to create this endpoint
        headers: { Authorization: `Bearer ${token}` }
      });
      // After acknowledging, refresh the count (should be 0 or less)
      fetchUnreadBookingUpdatesCount(token);
    } catch (error) {
      console.error('Failed to acknowledge booking updates:', error.response?.data?.message || error.message);
      if (error.response?.status === 401) logout();
    }
  }, [token, user?.role, fetchUnreadBookingUpdatesCount, logout]);

  // Function for admin to "refresh" task count (e.g., after viewing pending items)
  // This simply re-fetches. A more complex system might mark specific tasks as "seen".
  const refreshAdminTasksCount = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    fetchUnreadAdminTasksCount(token);
  }, [token, user?.role, fetchUnreadAdminTasksCount]);

  // Function for owner to "refresh" booking request count
  const refreshBookingRequestsCountForOwner = useCallback(async () => {
    if (!token || user?.role !== 'owner') return;
    fetchUnreadBookingRequestsCountForOwner(token);
  }, [token, user?.role, fetchUnreadBookingRequestsCountForOwner]);


  const authContextValue = {
    token, user, loading, favorites,
    isAuthenticated: !!token && !!user,
    unreadMessagesCount,
    unreadBookingRequestsCount, // For Owner
    unreadMyBookingsUpdatesCount, // For Tenant
    unreadAdminTasksCount, // For Admin
    socket,
    login, logout, refreshUser,
    toggleFavorite, fetchFavoriteIds,
    markChatAsRead,
    fetchUnreadMessagesCount,
    // Expose new functions and setters if needed by components
    acknowledgeBookingUpdates, // For MyBookingsPage (tenant)
    refreshAdminTasksCount, // For AdminPage
    refreshBookingRequestsCountForOwner, // For BookingRequestsPage (owner)
    fetchUnreadBookingUpdatesCount, // Expose if needed
    fetchUnreadAdminTasksCount, // Expose if needed
    fetchUnreadBookingRequestsCountForOwner, // Expose if needed for owner
    setUnreadBookingRequestsCount, // Kept from original, potentially for direct updates if needed
    setUnreadMyBookingsUpdatesCount, // Kept from original
    setUnreadAdminTasksCount, // Kept from original
    isSocketEligible,
    fetchSocketEligibility,  // Expose if needed by other components (though mainly for internal AuthContext use)
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {!loading ? children : <div className="text-center py-10">Loading application state...</div>}
    </AuthContext.Provider>
  );
};