// frontend/src/pages/ChatPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function ChatPage() {
  // Get the 'listingId' parameter from the URL
  const { listingId } = useParams();

  // State for messages
  const [messages, setMessages] = useState([]);
  // State for message fetching loading/error
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [errorMessages, setErrorMessages] = useState(null);

  // State for listing details (needed for owner_id)
  const [listing, setListing] = useState(null);
  const [loadingListing, setLoadingListing] = useState(true);
  const [errorListing, setErrorListing] = useState(null);

  // State for the new message input
  const [newMessageContent, setNewMessageContent] = useState('');
  // State for sending message loading/error
  const [sendingMessage, setSendingMessage] = useState(false);
  const [errorSendingMessage, setErrorSendingMessage] = useState(null);

  const { isAuthenticated, user, token } = useAuth(); // Get auth state

  // Ref for the messages container for auto-scrolling
  const messagesEndRef = useRef(null);


  // --- Effect to fetch listing details AND messages when the page loads or listingId/token changes ---
  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
          setLoadingMessages(false);
          setErrorMessages('Authentication token missing.');
          setLoadingListing(false);
          setErrorListing('Authentication token missing.');
          return;
      }

      // Use a single config for authenticated requests
      const config = {
          headers: {
            'Authorization': `Bearer ${token}` // Include the JWT
          }
      };

      // --- Fetch Listing Details first ---
      try {
          setLoadingListing(true);
          setErrorListing(null); // Clear previous error
          const listingRes = await axios.get(`http://localhost:5000/api/listings/${listingId}`, config); // Use token for listing details too if protected
          setListing(listingRes.data);
          console.log('Listing fetched:', listingRes.data);
      } catch (err) {
          console.error('Error fetching listing details:', err);
           // Check if it's a 404 or forbidden error related to listing
          const errorMessage = err.response?.status === 404 ? 'Listing not found.' :
                               err.response?.status === 403 ? 'You do not have permission to view this listing.' :
                               err.response?.data?.message || 'Failed to load listing details.';
          setErrorListing(errorMessage);
           // If listing fails, messages will likely fail or are irrelevant
          setErrorMessages('Could not load messages due to listing error.'); // Set a related message error
          setLoadingMessages(false); // Stop message loading too
          setLoadingListing(false); // Make sure loading is off
          return; // Stop further fetching if listing fetch fails
      } finally {
           // setLoadingListing is set false after the try/catch block, or inside the catch if returning early
           if (!errorListing) { // Only set false here if no error occurred in this block
               setLoadingListing(false);
           }
      }


      // --- Fetch Messages (only if listing fetch was successful implicitly by not returning) ---
      try {
        setLoadingMessages(true);
        setErrorMessages(null); // Clear previous error
        const response = await axios.get(`http://localhost:5000/api/listings/${listingId}/messages`, config);

        setMessages(response.data); // Set the messages state
        console.log('Messages fetched:', response.data);

      } catch (err) {
        console.error('Error fetching messages:', err);
        setErrorMessages(err.response?.data?.message || 'Failed to load messages.');
      } finally {
        setLoadingMessages(false); // Set loading to false
      }
    };

    // Fetch data only if listingId and token are available
    if (listingId && token) {
       fetchData();
    } else {
        // Handle case where listingId or token is missing initially
         setLoadingMessages(false);
         setLoadingListing(false);
         if (!listingId) setErrorMessages('Listing ID missing.');
         // If token is missing, AuthContext handles redirect via ProtectedRoute,
         // but setting an error here is a safe fallback.
         if (!token) setErrorMessages('Authentication token missing.');
    }

     // The dependency array ensures this effect runs when listingId or token changes.
     // We don't need to re-fetch if messages are sent, as we'll add new message to state directly.
  }, [listingId, token]);


  // --- Effect to scroll to the bottom of the messages when they update ---
  useEffect(() => {
    // Scroll to the bottom when messages state changes, but only if ref exists
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]); // Dependency array: re-run effect when messages state changes


  // --- Handle sending a new message ---
  const handleSendMessage = async (e) => {
    e.preventDefault(); // Prevent form submission if using a form

    if (!newMessageContent.trim()) { // Prevent sending empty messages
        return;
    }

    if (!token) { // Should not happen with ProtectedRoute, but good check
        setErrorSendingMessage('Authentication token missing. Cannot send message.');
        return;
    }

    if (!listing) { // Ensure listing data was loaded by useEffect
         setErrorSendingMessage('Listing data not available. Cannot send message.');
         return;
    }
    if (!user) { // Ensure user data is available from AuthContext
         setErrorSendingMessage('User data not available. Cannot send message.');
         return;
    }


    setSendingMessage(true);
    setErrorSendingMessage(null); // Clear previous send error

    let receiverIdToSend = null;

    // Determine the receiver ID based on the authenticated user's role
    // This logic requires the listing owner_id which we get from the 'listing' state
    if (user.id === listing.owner_id) {
        // If the current user is the owner, they are replying to a tenant.
        // We need to find the ID of the *other* participant in the conversation thread.
         if (messages.length > 0) {
            // Find the ID of any participant in the messages who is NOT the current user (the owner)
             const participantIds = new Set(messages.flatMap(msg => [msg.sender_id, msg.receiver_id]));
             participantIds.delete(user.id); // Remove the current user's ID

             // In a simple 1-on-1 chat per listing, there should only be one other participant.
             // Get the first (and hopefully only) remaining ID from the set.
             receiverIdToSend = participantIds.values().next().value;

             if (!receiverIdToSend) {
                 setErrorSendingMessage("Could not determine recipient to reply to.");
                 setSendingMessage(false);
                 return;
             }
         } else {
            // Owner is trying to send the *first* message on this page.
            // This page is designed for tenant-initiated chats or owner replies.
            // Owner initiation requires knowing *which* tenant to message, which this simple page doesn't provide.
            // This scenario is also handled by the form visibility logic below, but this is a safety check.
             setErrorSendingMessage("Owners reply to specific users. Please use 'My Chats' (Coming Soon) to initiate.");
             setSendingMessage(false);
             return;
         }

    } else { // If the current user is NOT the owner (assumed to be a tenant or interested party)
        // They are sending a message to the owner.
        receiverIdToSend = listing.owner_id;
        // Note: The backend logic might implicitly set receiver_id to owner_id
        // if the sender is not the owner, but explicitly sending it is clearer.
    }

    try {
        const config = {
            headers: {
                'Authorization': `Bearer ${token}` // Include the JWT
            }
        };
        const response = await axios.post(`http://localhost:5000/api/listings/${listingId}/messages`,
            { // Request body
                listing_id: listingId, // Include listing_id in the body
                content: newMessageContent,
                receiver_id: receiverIdToSend // Include receiver_id determined above
            },
            config // Pass the configuration object with headers
        );

        // If message is sent successfully
        console.log('Message sent:', response.data.message);
        // Add the new message to the messages state to update UI immediately
        setMessages([...messages, response.data.message]); // Add new message to the end

        // Clear the new message input field
        setNewMessageContent('');

    } catch (err) {
        console.error('Error sending message:', err);
        setErrorSendingMessage(err.response?.data?.message || 'Failed to send message.');
    } finally {
        setSendingMessage(false); // Always set sending to false
    }
  };
  // --- End of Handle sending a new message ---


  // --- Render logic based on loading/error states ---

  // Render loading state for messages or listing
  if (loadingMessages || loadingListing) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
        Loading chat...
      </div>
    );
  }

  // Render error state if fetching messages or listing failed
  if (errorMessages || errorListing) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-red-600 min-h-screen">
        Error: {errorMessages || errorListing} {/* Display either error */}
      </div>
    );
  }

  // Render if not loading and no error, but no messages found
   // This state should only be reached if listing data loaded successfully but message data is empty.
   if (messages.length === 0) {
       return (
           <div className="container mx-auto px-4 py-8 text-center text-gray-700 min-h-screen">
               <p>No messages yet for this listing.</p>
                {/* Show messages based on auth state and role */}
                {!isAuthenticated && <p className="mt-2">Please log in to send a message.</p>}
                {isAuthenticated && user && listing && user.id !== listing.owner_id && (
                     <p className="mt-2">Be the first to send a message!</p>
                )}
                 {isAuthenticated && user && listing && user.id === listing.owner_id && (
                      <p className="mt-2 text-sm">You are the owner. To initiate a chat with a specific interested user, please use 'My Chats' (Coming Soon).</p>
                 )}
           </div>
       );
   }


  // Render the chat interface once messages are loaded and there are messages
  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen flex flex-col"> {/* Use flex-col for layout */}
       {/* Dynamic Title - Use listing address or generic if listing isn't fully loaded (shouldn't happen here) */}
       <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">Chat for Listing {listing?.address || listingId}</h1>

        {/* Messages Display Area */}
        {/* Use flex-col for message stacking within the scroll area */}
        <div className="flex-1 bg-white p-4 rounded-sm shadow-sm overflow-y-auto h-96 mb-4 flex flex-col">
            {messages.map(message => (
                // Style messages differently based on sender (current user vs. other participant)
                <div
                    key={message.id}
                    className={`flex mb-3 ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`} // Align messages based on sender, use optional chaining for user
                >
                    <div className={`rounded-lg p-3 max-w-xs lg:max-w-md ${
                        message.sender_id === user?.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800' // Different bubble colors
                    }`}>
                        {/* Optional: Display sender name above message if it's not the current user */}
                        {/* Check if Sender object exists and is not the current user */}
                        {message.Sender && message.sender_id !== user?.id && (
                             <div className="text-xs font-semibold mb-1 text-gray-700"> {/* Adjusted text color for better contrast */}
                                {message.Sender.name || message.Sender.email} {/* Use name or email */}
                             </div>
                        )}
                        <p className="break-words">{message.content}</p> {/* Display message content */}
                        {/* Optional: Display timestamp */}
                         <div className="text-xs mt-1 opacity-75 text-right">
                            {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </div>
                    </div>
                </div>
            ))}
            {/* Empty div for scrolling to the bottom */}
            <div ref={messagesEndRef} />
        </div>

        {/* Message Input Form (Visible only if authenticated and eligible to send) */}
        {/* Eligible means: authenticated, listing loaded, user loaded, AND (user is not owner OR there are existing messages) */}
        {isAuthenticated && user && listing && (user.id !== listing.owner_id || messages.length > 0) ? (
             <div className="bg-white p-4 rounded-sm shadow-sm"> {/* Input area styling */}
                 {errorSendingMessage && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-2 text-sm">{errorSendingMessage}</div>}

                <form onSubmit={handleSendMessage} className="flex">
                    <input
                        className="flex-grow shadow appearance-none border border-gray-300 rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mr-2"
                        type="text"
                        placeholder="Type a message..."
                        value={newMessageContent}
                        onChange={(e) => setNewMessageContent(e.target.value)}
                        disabled={sendingMessage} // Disable input while sending
                    />
                    <button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-sm focus:outline-none focus:shadow-outline transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" // Added disabled styles
                        type="submit"
                        disabled={sendingMessage || !newMessageContent.trim()} // Disable if sending or input is empty
                    >
                        {sendingMessage ? 'Sending...' : 'Send'}
                    </button>
                </form>
             </div>
        ) : (
            // Message for logged out users or owners who haven't received messages
             <div className="bg-gray-100 p-4 rounded-sm text-center text-gray-700">
                 {!isAuthenticated ? "Please log in to send a message." :
                  user && listing && user.id === listing.owner_id && messages.length === 0 ? "You are the owner. To initiate a chat with a specific interested user, please use 'My Chats' (Coming Soon)." :
                  "Cannot send message at this time." // Fallback for other conditions if form is hidden
                 }
             </div>
        )}

    </div>
  );
}

export default ChatPage;