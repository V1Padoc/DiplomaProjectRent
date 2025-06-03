// frontend/src/context/AuthContext.js

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
// import axios from 'axios'; // We will now use the apiClient instance
import apiClient, { setupInterceptors } from '../services/api'; // <--- MODIFIED: Import apiClient and setupInterceptors
import { io } from 'socket.io-client';

// API URL base is now handled by apiClient, so we don't need this constant here.
// const API_URL = 'http://localhost:5000/api'; 
const SOCKET_URL = 'http://localhost:5000';

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
    setFavorites([]); // Clear favorites on logout
    setUnreadMessagesCount(0);
    setUnreadBookingRequestsCount(0);
    setUnreadMyBookingsUpdatesCount(0);
    setUnreadAdminTasksCount(0);
    setSocket(null);
    setIsSocketEligible(false); // Reset eligibility on logout
    console.log('User logged out via AuthContext.logout.');
    // No window.location.href here, let ProtectedRoute handle redirection based on isAuthenticated state
  }, [socket]); // socket is a dependency for socket.disconnect()

  // --- Initialize Axios interceptors ONCE when AuthProvider mounts ---
  useEffect(() => {
    setupInterceptors(logout); // Pass the memoized logout function to setup interceptors
  }, [logout]); // Re-run if logout function instance changes (it shouldn't if memoized correctly)


  const fetchUnreadMessagesCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam) return; // currentTokenParam is still used for initial call when token might not be in state yet
    try {
      // Use apiClient - it automatically includes the token from localStorage via request interceptor
      const response = await apiClient.get(`/chats/my-unread-count`);
      setUnreadMessagesCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread messages count:', error.response?.data?.message || error.message);
      // 401s are now handled by the global interceptor, so no local logout() needed here.
    }
  }, []); 

  const fetchFavoriteIds = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam) { // currentTokenParam for initial calls
        setFavorites([]); 
        return; 
    }
    try {
        const response = await apiClient.get(`/users/me/favorites/ids`); // Use apiClient
        setFavorites(response.data.favorite_ids && Array.isArray(response.data.favorite_ids) 
                      ? response.data.favorite_ids.map(String) 
                      : []);
    } catch (error) {
        console.error("Error fetching favorite IDs:", error.response?.data?.message || error.message);
        if (error.response?.status !== 401) { // If not a 401 (which auto-logs out via interceptor)
            setFavorites([]); // Default to empty on other errors
        }
    }
  }, []);

  // Fetch count of unread booking updates for tenants
  const fetchUnreadBookingUpdatesCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'tenant') return;
    try {
      const response = await apiClient.get(`/users/me/unread-booking-updates-count`); // Use apiClient
      setUnreadMyBookingsUpdatesCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread booking updates count:', error.response?.data?.message || error.message);
    }
  }, [user?.role]); 

  // Fetch count of admin tasks (e.g., pending listings)
  const fetchUnreadAdminTasksCount = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'admin') return;
    try {
      const response = await apiClient.get(`/admin/tasks-count`); // Use apiClient
      setUnreadAdminTasksCount(response.data.pendingListingsCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread admin tasks count:', error.response?.data?.message || error.message);
    }
  }, [user?.role]); 
  
  // Fetch count of new booking requests for owners
  const fetchUnreadBookingRequestsCountForOwner = useCallback(async (currentTokenParam) => {
    if (!currentTokenParam || user?.role !== 'owner') return;
    try {
      const response = await apiClient.get(`/bookings/owner/pending-count`); // Use apiClient
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
      const response = await apiClient.get(`/auth/socket-eligibility`); // Use apiClient
      setIsSocketEligible(response.data.eligible);
      return response.data.eligible; 
    } catch (error) {
      console.error('Failed to fetch socket eligibility:', error.response?.data?.message || error.message);
      setIsSocketEligible(false); 
      return false;
    }
  }, []); 

  // Effect for initial authentication check and loading user data
  useEffect(() => {
    const attemptAutoLogin = async () => {
      const storedToken = localStorage.getItem('token');
      console.log('Attempting auto-login and socket eligibility check...');
      if (storedToken) {
        setToken(storedToken); 
        try {
          // apiClient will automatically use the token from localStorage
          const res = await apiClient.get(`/auth/user`); 
          const userData = res.data;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData)); 

          // Fetch eligibility and other dependent data using the stored token
          await fetchSocketEligibility(storedToken);
          fetchUnreadMessagesCount(storedToken);
          fetchFavoriteIds(storedToken);
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
          // 401 error from apiClient.get('/auth/user') will be caught by the interceptor,
          // which calls logout(). So, this catch block might primarily see other errors.
          console.error('Auto-login failed (user fetch or subsequent calls):', err.response?.data?.message || err.message);
          if (err.response?.status !== 401) { // If not a 401 (which auto-logs out via interceptor)
            logout(); // Still logout for other critical failures during auto-login
          }
        }
      }
      setLoading(false);
    };

    attemptAutoLogin();
    // Dependencies include all callbacks to ensure stable references
  }, [logout, fetchUnreadMessagesCount, fetchFavoriteIds, fetchUnreadBookingUpdatesCount, fetchUnreadAdminTasksCount, fetchUnreadBookingRequestsCountForOwner, fetchSocketEligibility]);

  // Socket connection management
  useEffect(() => {
    // Only connect if token, user.id, AND isSocketEligible are true
    if (token && user?.id && isSocketEligible) {
      console.log(`User ${user.id} is eligible, attempting to connect socket.`);
      const newSocket = io(SOCKET_URL, {
        auth: { token: token } // Send token in auth object for server-side verification
      });
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
      });

      // Optional: Listen for a custom event from server confirming socket authentication
      newSocket.on('socket_authenticated', (data) => {
        console.log('Socket successfully authenticated by server:', data);
      });

      newSocket.on('socket_auth_error', (error) => {
        console.error('Socket authentication failed:', error.message);
        newSocket.disconnect();
      });

      newSocket.on('new_message_notification', (data) => {
        console.log('New message notification (AuthContext):', data);
        fetchUnreadMessagesCount(token); // Uses current token from state
        window.dispatchEvent(new CustomEvent('chat-update', { detail: data }));
      });

      newSocket.on('messages_read_update', (data) => {
        console.log('Messages read update received (AuthContext):', data);
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
        newSocket.off('socket_authenticated'); 
        newSocket.off('socket_auth_error');
        newSocket.off('new_message_notification');
        newSocket.off('messages_read_update');
        newSocket.off('new_booking_request_owner'); 
        newSocket.off('booking_status_update_tenant'); 
        newSocket.off('admin_new_pending_listing');
        newSocket.off('admin_pending_count_changed');
        newSocket.close();
        setSocket(null);
        console.log('Socket disconnected and cleaned up.');
      };
    } else if (socket) { 
      console.log(`User ${user?.id} no longer eligible or logged out, disconnecting socket.`);
      socket.close();
      setSocket(null);
    }
  }, [token, user?.id, user?.role, fetchUnreadMessagesCount, fetchUnreadBookingUpdatesCount, fetchUnreadAdminTasksCount, fetchUnreadBookingRequestsCountForOwner, isSocketEligible]); 

  // *** MODIFIED LOGIN FUNCTION ***
  const login = async (newToken) => { 
    if (!newToken) {
      console.error("Login called without a token.");
      logout(); 
      return;
    }
    localStorage.setItem('token', newToken);
    setToken(newToken); 

    try {
      // Fetch user data using apiClient - it will use the token just set in localStorage
      const res = await apiClient.get(`/auth/user`); 
      const userData = res.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      // Fetch eligibility and wait for it
      const eligible = await fetchSocketEligibility(newToken); 
      console.log("Socket eligibility after login:", eligible);

      // Now that user, token, and eligibility are set, fetch other dependent data
      await fetchUnreadMessagesCount(newToken); 
      await fetchFavoriteIds(newToken);
      if (userData.role === 'tenant') {
        await fetchUnreadBookingUpdatesCount(newToken);
      }
      if (userData.role === 'admin') {
        await fetchUnreadAdminTasksCount(newToken);
      }
      if (userData.role === 'owner') {
        await fetchUnreadBookingRequestsCountForOwner(newToken);
      }
    } catch (err) {
      console.error('Failed to fetch user data after login:', err.response?.data?.message || err.message);
      if (err.response?.status !== 401) { // If not a 401 (which auto-logs out via interceptor)
        logout(); // Logout for other critical failures during login
      }
    }
  };


  const refreshUser = async () => {
    if (token) {
      try {
        const res = await apiClient.get(`/auth/user`); // Use apiClient, no manual headers
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      } catch (err) {
        console.error('Error refreshing user data:', err);
        // Interceptor should handle 401 for this call
      }
    }
  };

  const toggleFavorite = async (listingId) => {
    if (!token) {
        console.warn('Attempted to toggle favorite without authentication token.');
        return favorites.includes(String(listingId)); 
    }
    const stringListingId = String(listingId);
    const isCurrentlyFavorited = favorites.includes(stringListingId);
    try {
      if (isCurrentlyFavorited) {
        await apiClient.delete(`/users/me/favorites/${stringListingId}`); // Use apiClient
        setFavorites(prev => prev.filter(id => id !== stringListingId));
        return false;
      } else {
        await apiClient.post(`/users/me/favorites/${stringListingId}`, {}); // Use apiClient
        setFavorites(prev => [...prev, stringListingId]);
        return true;
      }
    } catch (error) {
      console.error("Error toggling favorite:", error.response?.data?.message || error.message);
      // Interceptor should handle 401 for this call
      return isCurrentlyFavorited; 
    }
  };

  const markChatAsRead = useCallback(async (listingId, chatPartnerId) => {
    if (!token || !listingId || !chatPartnerId) return 0;
    try {
      const response = await apiClient.put(`/chats/mark-as-read`, // Use apiClient
        { listingId: String(listingId), chatPartnerId: String(chatPartnerId) }
      );
      await fetchUnreadMessagesCount(token); 
      return response.data.count || 0;
    } catch (error) {
      console.error('Failed to mark chat as read:', error.response?.data?.message || error.message);
      // Interceptor should handle 401 for this call
      return 0;
    }
  }, [token, fetchUnreadMessagesCount]);

  // Function for tenant to acknowledge their booking updates (clears the count)
  const acknowledgeBookingUpdates = useCallback(async () => {
    if (!token || user?.role !== 'tenant') return;
    try {
      await apiClient.put(`/users/me/acknowledge-booking-updates`, {}); // Use apiClient
      fetchUnreadBookingUpdatesCount(token);
    } catch (error) {
      console.error('Failed to acknowledge booking updates:', error.response?.data?.message || error.message);
      // Interceptor should handle 401 for this call
    }
  }, [token, user?.role, fetchUnreadBookingUpdatesCount]);

  // Function for admin to "refresh" task count (e.g., after viewing pending items)
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
    unreadBookingRequestsCount, 
    unreadMyBookingsUpdatesCount, 
    unreadAdminTasksCount, 
    socket,
    login, logout, refreshUser,
    toggleFavorite, fetchFavoriteIds,
    markChatAsRead,
    fetchUnreadMessagesCount,
    acknowledgeBookingUpdates, 
    refreshAdminTasksCount, 
    refreshBookingRequestsCountForOwner, 
    fetchUnreadBookingUpdatesCount, 
    fetchUnreadAdminTasksCount, 
    fetchUnreadBookingRequestsCountForOwner, 
    setUnreadBookingRequestsCount, 
    setUnreadMyBookingsUpdatesCount, 
    setUnreadAdminTasksCount, 
    isSocketEligible,
    fetchSocketEligibility,  
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {!loading ? children : <div className="text-center py-10">Loading application state...</div>}
    </AuthContext.Provider>
  );
};