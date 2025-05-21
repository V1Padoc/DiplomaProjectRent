// frontend/src/pages/ChatPage.jsx

import React, { useState, useEffect, useRef } from 'react';
// *** MODIFIED: Import useSearchParams ***
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function ChatPage() {
  const { listingId } = useParams();
  // *** NEW: Get searchParams to read query parameters ***
  const [searchParams] = useSearchParams();
  const otherParticipantIdFromQuery = searchParams.get('with'); // Get the 'with' parameter

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [errorMessages, setErrorMessages] = useState(null);

  const [listing, setListing] = useState(null);
  const [loadingListing, setLoadingListing] = useState(true);
  const [errorListing, setErrorListing] = useState(null);

  const [newMessageContent, setNewMessageContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [errorSendingMessage, setErrorSendingMessage] = useState(null);

  const { isAuthenticated, user, token } = useAuth();
  const messagesEndRef = useRef(null);

  // *** MODIFIED: useEffect to fetch data ***
  useEffect(() => {
    const fetchData = async () => {
      if (!token || !user) { // Ensure user is also loaded
          setLoadingMessages(false);
          setErrorMessages('Authentication details missing.');
          setLoadingListing(false);
          setErrorListing('Authentication details missing.');
          return;
      }

      const config = {
          headers: { Authorization: `Bearer ${token}` }
      };

      // Fetch Listing Details
      try {
          setLoadingListing(true);
          setErrorListing(null);
          const listingRes = await axios.get(`http://localhost:5000/api/listings/${listingId}`, config);
          setListing(listingRes.data);
      } catch (err) {
          console.error('Error fetching listing details:', err);
          const errorMessage = err.response?.status === 404 ? 'Listing not found.' :
                               err.response?.data?.message || 'Failed to load listing details.';
          setErrorListing(errorMessage);
          setErrorMessages('Could not load messages due to listing error.');
          setLoadingMessages(false);
          setLoadingListing(false);
          return;
      } finally {
          // setLoadingListing will be set false after try/catch or inside catch if returned early
          // This ensures it's set correctly even on early return.
          // No explicit setLoadingListing(false) here as it's conditional on error.
      }
      setLoadingListing(false); // Set false here if successfully fetched listing

      // Fetch Messages
      try {
        setLoadingMessages(true);
        setErrorMessages(null);

        // *** MODIFIED: Construct messages URL with otherUserId if applicable ***
        let messagesApiUrl = `http://localhost:5000/api/listings/${listingId}/messages`;
        const params = new URLSearchParams();

        // If the current user is the owner of THIS listing and 'otherParticipantIdFromQuery' is present,
        // it means we are opening a specific chat thread for the owner.
        // The listing object should be available here from the fetch above.
        if (listing && user.id === listing.owner_id && otherParticipantIdFromQuery) {
            params.append('otherUserId', otherParticipantIdFromQuery);
        }
        // If current user is NOT the owner, the backend's getMessagesByListingId
        // will automatically fetch messages between this user and the owner. No extra param needed.

        if (params.toString()) {
            messagesApiUrl += `?${params.toString()}`;
        }
        // *** END OF MODIFICATION ***

        const response = await axios.get(messagesApiUrl, config);
        setMessages(response.data);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setErrorMessages(err.response?.data?.message || 'Failed to load messages.');
      } finally {
        setLoadingMessages(false);
      }
    };

    if (listingId && token && user) { // Make sure user object is available too
       fetchData();
    } else {
         setLoadingMessages(false);
         setLoadingListing(false);
         if (!listingId) setErrorMessages('Listing ID missing.');
         if (!token || !user) setErrorMessages('Authentication details missing.');
    }
  }, [listingId, token, user, otherParticipantIdFromQuery, listing?.owner_id]); // Added dependencies

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // *** MODIFIED: handleSendMessage ***
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageContent.trim() || !listing || !user || !token) return;

    setSendingMessage(true);
    setErrorSendingMessage(null);

    let receiverIdToSend;

    if (user.id === listing.owner_id) {
        // Owner is sending. Receiver is the 'otherParticipantIdFromQuery'
        // (the tenant they are chatting with, passed from MyChats)
        // or, if they initiated via "Contact Owner" on their own listing (unlikely UI flow),
        // this logic would need to be smarter or the UI would prevent it.
        // For now, we assume 'otherParticipantIdFromQuery' is the specific tenant.
        if (!otherParticipantIdFromQuery) {
            // This case should ideally not happen if UI flow is correct.
            // If owner is on a chat page without 'with' param, who are they talking to?
            // This implies an issue or a new chat initiation by owner is not yet fully supported by this page design.
            // For now, this addresses replies from MyChats.
            setErrorSendingMessage("Cannot determine recipient. Chat context is unclear for owner without specific participant.");
            setSendingMessage(false);
            return;
        }
        receiverIdToSend = otherParticipantIdFromQuery;
    } else {
        // Tenant (or non-owner) is sending. Receiver is the listing owner.
        receiverIdToSend = listing.owner_id;
    }

    try {
        const response = await axios.post(
            `http://localhost:5000/api/listings/${listingId}/messages`,
            { listing_id: listingId, content: newMessageContent, receiver_id: receiverIdToSend },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(prevMessages => [...prevMessages, response.data.message]);
        setNewMessageContent('');
    } catch (err) {
        console.error('Error sending message:', err);
        setErrorSendingMessage(err.response?.data?.message || 'Failed to send message.');
    } finally {
        setSendingMessage(false);
    }
  };

  if (loadingMessages || loadingListing) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading chat...</div>;
  }

  if (errorMessages || errorListing) {
    return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {errorMessages || errorListing}</div>;
  }

  // Check if user can send messages.
  // Tenant can always initiate/reply.
  // Owner can reply if 'otherParticipantIdFromQuery' is set (i.e., coming from a specific chat in MyChats).
  // Owner cannot initiate from this generic chat page without a target participant.
  const canSendMessage = isAuthenticated && user && listing &&
    (user.id !== listing.owner_id || (user.id === listing.owner_id && !!otherParticipantIdFromQuery));


  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen flex flex-col">
       <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
           Chat for Listing: {listing?.title || `ID ${listingId}`}
           {listing && user && user.id === listing.owner_id && otherParticipantIdFromQuery && messages.length > 0 &&
             messages[0] && (messages[0].sender_id === otherParticipantIdFromQuery || messages[0].receiver_id === otherParticipantIdFromQuery) &&
             ` with ${messages[0].sender_id === otherParticipantIdFromQuery ? messages[0].Sender?.name : messages[0].Receiver?.name}`
           }
       </h1>

        <div className="flex-1 bg-white p-4 rounded-sm shadow-sm overflow-y-auto h-96 mb-4 flex flex-col">
            {messages.length === 0 ? (
                <p className="text-center text-gray-700 m-auto">
                    No messages yet.
                    {canSendMessage ? " Be the first to send one!" : 
                     (user && listing && user.id === listing.owner_id && !otherParticipantIdFromQuery ? 
                        " Select a conversation from 'My Chats' to reply." : "" )
                    }
                </p>
            ) : (
                messages.map(message => (
                    <div
                        key={message.id}
                        className={`flex mb-3 ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`rounded-lg p-3 max-w-xs lg:max-w-md shadow-sm ${
                            message.sender_id === user?.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
                        }`}>
                            {message.Sender && message.sender_id !== user?.id && (
                                 <div className="text-xs font-semibold mb-1 opacity-80">
                                    {message.Sender.name || message.Sender.email}
                                 </div>
                            )}
                            <p className="break-words">{message.content}</p>
                             <div className="text-xs mt-1 opacity-75 text-right">
                                {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </div>
                        </div>
                    </div>
                ))
            )}
            <div ref={messagesEndRef} />
        </div>

        {canSendMessage ? (
             <div className="bg-white p-4 rounded-sm shadow-sm">
                 {errorSendingMessage && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-2 text-sm">{errorSendingMessage}</div>}
                <form onSubmit={handleSendMessage} className="flex">
                    <input
                        className="flex-grow shadow appearance-none border border-gray-300 rounded-l-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        type="text"
                        placeholder="Type a message..."
                        value={newMessageContent}
                        onChange={(e) => setNewMessageContent(e.target.value)}
                        disabled={sendingMessage}
                    />
                    <button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-sm focus:outline-none focus:shadow-outline disabled:opacity-50"
                        type="submit"
                        disabled={sendingMessage || !newMessageContent.trim()}
                    >
                        {sendingMessage ? 'Sending...' : 'Send'}
                    </button>
                </form>
             </div>
        ) : (
             <div className="bg-gray-100 p-4 rounded-sm text-center text-gray-700">
                 {!isAuthenticated ? "Please log in to send a message." :
                  (user && listing && user.id === listing.owner_id && !otherParticipantIdFromQuery ?
                    "To reply to a specific user, please select the conversation from 'My Chats'." :
                    "You cannot send messages in this chat at the moment.")
                 }
             </div>
        )}
    </div>
  );
}

export default ChatPage;