// frontend/src/pages/ChatPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function ChatPage() {
    const { listingId: listingIdFromParams } = useParams(); // Renamed for clarity
    const [searchParams] = useSearchParams();
    const otherParticipantIdFromQuery = searchParams.get('with');

    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [isPolling, setIsPolling] = useState(false); // Used as a flag, not for function identity
    const [errorMessages, setErrorMessages] = useState(null);

    const [listing, setListing] = useState(null);
    const [loadingListing, setLoadingListing] = useState(true);
    const [errorListing, setErrorListing] = useState(null);

    const [newMessageContent, setNewMessageContent] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [errorSendingMessage, setErrorSendingMessage] = useState(null);

    const { isAuthenticated, user, token } = useAuth();
    const messagesEndRef = useRef(null);
    const pollingIntervalRef = useRef(null);

    // Stable references for dependencies if they don't change often
    const currentUserId = user?.id;
    const currentToken = token;

    // Memoized function to fetch only messages
    const fetchAndSetMessages = useCallback(async (currentFetchedListing) => {
        // Guard conditions: use the `isPolling` state variable via closure
        if (!currentToken || !currentUserId || !listingIdFromParams || !currentFetchedListing || isPolling) {
            if (isPolling) console.log("Fetch messages skipped: already polling or missing data.");
            return;
        }
        
        setIsPolling(true); // Set flag to prevent concurrent fetches
        let messagesApiUrl = `http://localhost:5000/api/listings/${listingIdFromParams}/messages`;
        const params = new URLSearchParams();

        // Use currentFetchedListing.owner_id for the condition
        if (currentUserId === currentFetchedListing.owner_id && otherParticipantIdFromQuery) {
            params.append('otherUserId', otherParticipantIdFromQuery);
        }
        if (params.toString()) {
            messagesApiUrl += `?${params.toString()}`;
        }
        const config = { headers: { Authorization: `Bearer ${currentToken}` } };

        try {
            const response = await axios.get(messagesApiUrl, config);
            const newMessages = response.data;
            setMessages(prevMessages => {
                // Smart update to prevent re-renders if messages haven't changed
                if (prevMessages.length !== newMessages.length ||
                    (newMessages.length > 0 && prevMessages.length > 0 && prevMessages[prevMessages.length - 1].id !== newMessages[newMessages.length - 1].id) ||
                    (newMessages.length > 0 && prevMessages.length === 0)) {
                    return newMessages;
                }
                return prevMessages;
            });
            setErrorMessages(null); // Clear error on successful fetch
        } catch (err) {
            console.error('Error polling messages:', err);
            // Avoid setting persistent error for polling failures unless it's critical
            // setErrorMessages(err.response?.data?.message || 'Failed to poll messages.');
        } finally {
            setIsPolling(false); // Clear flag
        }
    }, [listingIdFromParams, otherParticipantIdFromQuery, currentToken, currentUserId]); // REMOVED `isPolling` from dependencies

    // Effect for initial data load (listing details AND initial messages)
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!listingIdFromParams || !token || !user) {
                setLoadingListing(false);
                setLoadingMessages(false); 
                const errorMsg = !listingIdFromParams ? 'Listing ID missing.' : 'Authentication details missing.';
                setErrorListing(errorMsg);
                setErrorMessages(errorMsg);
                return;
            }

            setLoadingListing(true);
            setLoadingMessages(true); 
            setErrorListing(null);
            setErrorMessages(null);

            const config = { headers: { Authorization: `Bearer ${token}` } };
            let fetchedListingData = null;

            try {
                const listingRes = await axios.get(`http://localhost:5000/api/listings/${listingIdFromParams}`, config);
                fetchedListingData = listingRes.data;
                setListing(fetchedListingData); // Set listing state

                if (fetchedListingData) {
                    // Call fetchAndSetMessages for the initial load, passing the freshly fetched listing data.
                    await fetchAndSetMessages(fetchedListingData);
                }
            } catch (err) {
                console.error('Error fetching initial listing details:', err);
                setErrorListing(err.response?.data?.message || 'Failed to load listing details.');
                // No need to call fetchAndSetMessages if listing failed
            } finally {
                setLoadingListing(false);
                // Messages loading (initial attempt) is complete regardless of listing fetch success or failure
                setLoadingMessages(false); 
            }
        };

        fetchInitialData();
    }, [listingIdFromParams, token, user, fetchAndSetMessages]); // Added fetchAndSetMessages for correctness

    // Effect for polling messages (starts after initial load is complete and listing is set)
    useEffect(() => {
        if (listing && token && user && !loadingListing && !loadingMessages) { 
            pollingIntervalRef.current = setInterval(() => {
                // Pass the current `listing` from state to `fetchAndSetMessages`
                // This ensures it uses the most up-to-date listing info (like listing.owner_id)
                fetchAndSetMessages(listing);
            }, 5000); // Poll every 5 seconds
            console.log("Chat polling started for listing:", listing.id);

            return () => { // Cleanup function
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    console.log("Chat polling stopped for listing:", listing.id);
                }
            };
        }
        // Cleanup if dependencies change before polling could start or while it's active
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [listing, token, user, loadingListing, loadingMessages, fetchAndSetMessages]);

    // Effect for scrolling to the bottom of messages
    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            setTimeout(() => {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }, 100); 
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessageContent.trim() || !listing || !user || !token) return;

        setSendingMessage(true);
        setErrorSendingMessage(null);

        let receiverIdToSend;
        if (user.id === listing.owner_id) {
            if (!otherParticipantIdFromQuery) {
                setErrorSendingMessage("Cannot determine recipient for owner's message.");
                setSendingMessage(false);
                return;
            }
            receiverIdToSend = otherParticipantIdFromQuery;
        } else {
            receiverIdToSend = listing.owner_id;
        }

        try {
            const response = await axios.post(
                `http://localhost:5000/api/listings/${listingIdFromParams}/messages`,
                { listing_id: listingIdFromParams, content: newMessageContent, receiver_id: receiverIdToSend },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Immediately add the new message to state for responsiveness
            // The server response should include the full message object with id, createdAt, etc.
            setMessages(prevMessages => [...prevMessages, response.data.message]);
            setNewMessageContent('');
            // Optionally, trigger a manual poll to ensure sync if there are complex server-side updates
            // fetchAndSetMessages(listing); // Or wait for the next polling interval
        } catch (err) {
            console.error('Error sending message:', err);
            setErrorSendingMessage(err.response?.data?.message || 'Failed to send message.');
        } finally {
            setSendingMessage(false);
        }
    };

    const isLoadingPage = loadingListing || (loadingMessages && messages.length === 0); // Refined loading condition

    if (isLoadingPage && !listing) { 
        return <div className="container mx-auto px-4 py-8 text-center">Loading chat details...</div>;
    }

    if (errorListing) {
        return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {errorListing}</div>;
    }
    
    if (errorMessages && messages.length === 0 && !loadingMessages) { 
        return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error loading messages: {errorMessages}</div>;
    }
    
    if (!listing && !errorListing) { // Fallback if listing is still null but no specific error yet
        return <div className="container mx-auto px-4 py-8 text-center">Preparing chat...</div>;
    }

    const canSendMessage = isAuthenticated && user && listing &&
    (user.id !== listing.owner_id || (user.id === listing.owner_id && !!otherParticipantIdFromQuery));

    // Determine the name of the other participant for the chat header
    let otherParticipantName = 'Participant';
    if (listing && user) {
        if (user.id === listing.owner_id && otherParticipantIdFromQuery) {
            // Owner chatting with someone specific
            const otherUserInMessages = messages.find(m => 
                (m.Sender?.id?.toString() === otherParticipantIdFromQuery && m.sender_id !== user.id) ||
                (m.Receiver?.id?.toString() === otherParticipantIdFromQuery && m.receiver_id !== user.id)
            );
            if (otherUserInMessages) {
                otherParticipantName = (otherUserInMessages.sender_id.toString() === otherParticipantIdFromQuery ? otherUserInMessages.Sender?.name : otherUserInMessages.Receiver?.name) || 'Participant';
            }
        } else if (user.id !== listing.owner_id && listing.Owner) {
            // Non-owner chatting with the listing owner
            otherParticipantName = `${listing.Owner?.name || listing.Owner?.email} (Owner)`;
        }
    }


    return (
        <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen flex flex-col">
            <div className="mb-4 text-center">
                <h1 className="text-2xl font-bold text-gray-800">
                    Chat
                    {listing?.title && (
                        <> for <RouterLink to={`/listings/${listingIdFromParams}`} className="text-blue-600 hover:underline">{listing.title}</RouterLink></>
                    )}
                </h1>
                {listing && user && (
                    (user.id === listing.owner_id && otherParticipantIdFromQuery) || (user.id !== listing.owner_id)
                ) && (
                    <p className="text-sm text-gray-600">
                        with {otherParticipantName}
                    </p>
                )}
            </div>

            <div className="flex-1 bg-white p-4 rounded-sm shadow-sm overflow-y-auto h-96 mb-4 flex flex-col space-y-3">
                {loadingMessages && messages.length === 0 && ( 
                    <p className="text-center text-gray-700 m-auto">Loading messages...</p>
                )}
                {!loadingMessages && messages.length === 0 && ( 
                    <p className="text-center text-gray-700 m-auto">
                        No messages yet.
                        {canSendMessage ? " Be the first to send one!" : 
                         (user && listing && user.id === listing.owner_id && !otherParticipantIdFromQuery ? 
                            " Select a conversation from 'My Chats' to reply." : "" )
                        }
                    </p>
                )}
                {messages.map(message => {
                    const isCurrentUserSender = message.sender_id === user?.id;
                    // Determine the other user involved in the message, whether sender or receiver.
                    // This assumes Sender and Receiver objects are populated from the backend.
                    const otherUserInMessage = isCurrentUserSender ? message.Receiver : message.Sender;

                    return (
                        <div
                            key={message.id}
                            className={`flex items-end ${isCurrentUserSender ? 'justify-end' : 'justify-start'}`}
                        >
                            {!isCurrentUserSender && otherUserInMessage && (
                                <img
                                    src={otherUserInMessage.profile_photo_url ? `http://localhost:5000/uploads/profiles/${otherUserInMessage.profile_photo_url}` : 'https://via.placeholder.com/40'}
                                    alt={otherUserInMessage.name || 'User'}
                                    className="w-8 h-8 rounded-full mr-2 object-cover self-start flex-shrink-0"
                                />
                            )}
                            <div className={`rounded-lg p-3 max-w-xs lg:max-w-md shadow-sm ${
                                isCurrentUserSender ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-gray-800'
                            }`}>
                                {!isCurrentUserSender && otherUserInMessage && (
                                     <div className="text-xs font-semibold mb-1 opacity-80">
                                        {otherUserInMessage.name || otherUserInMessage.email}
                                     </div>
                                )}
                                <p className="break-words">{message.content}</p>
                                 <div className="text-xs mt-1 opacity-75 text-right">
                                    {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </div>
                            </div>
                            {isCurrentUserSender && user && ( // Current user's avatar
                                <img
                                    src={user.profile_photo_url ? `http://localhost:5000/uploads/profiles/${user.profile_photo_url}` : 'https://via.placeholder.com/40'}
                                    alt={user.name || 'You'}
                                    className="w-8 h-8 rounded-full ml-2 object-cover self-start flex-shrink-0"
                                />
                            )}
                        </div>
                    );
                })}
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