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
    // Renamed `isPolling` from useState to useRef to prevent unnecessary re-renders of useCallback
    // and ensure the latest value is always accessed within the memoized function.
    const isPollingRef = useRef(false); 
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
        // Guard conditions: use the `isPollingRef.current` value
        if (!currentToken || !currentUserId || !listingIdFromParams || !currentFetchedListing || isPollingRef.current) {
            if (isPollingRef.current) console.log("Fetch messages skipped: already polling or missing data.");
            return;
        }
        
        isPollingRef.current = true; // Set flag to prevent concurrent fetches
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
                    (newMessages.length > 0 && prevMessages.length > 0 && prevMessages[newMessages.length - 1]?.id !== newMessages[newMessages.length - 1]?.id) ||
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
            isPollingRef.current = false; // Clear flag
        }
    }, [listingIdFromParams, otherParticipantIdFromQuery, currentToken, currentUserId]); // `isPollingRef` is not a dependency as its `current` value is mutable

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
            // Clear any existing interval before setting a new one to prevent duplicates
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }

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

    // Determine the details of the other participant for the chat header
    let otherUserDetails = null;
    if (listing && user) {
        if (user.id === listing.owner_id && otherParticipantIdFromQuery) {
            // Owner chatting with someone specific
            const targetId = otherParticipantIdFromQuery;
            // Find if any message has this targetId as sender or receiver
            const participantMessage = messages.find(m =>
                m.sender_id?.toString() === targetId || m.receiver_id?.toString() === targetId
            );

            if (participantMessage) {
                if (participantMessage.sender_id?.toString() === targetId) {
                    otherUserDetails = participantMessage.Sender;
                } else if (participantMessage.receiver_id?.toString() === targetId) {
                    otherUserDetails = participantMessage.Receiver;
                }
            }
        } else if (user.id !== listing.owner_id && listing.Owner) {
            // Non-owner chatting with the listing owner
            otherUserDetails = listing.Owner;
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
                {/* *** MODIFIED: Link other participant's name in title to their profile *** */}
                {otherUserDetails && (
                    <p className="text-sm text-gray-600">
                        with{' '}
                        <RouterLink to={`/profiles/${otherUserDetails.id}`} className="font-semibold text-blue-600 hover:underline">
                            {otherUserDetails.name || otherUserDetails.email}
                        </RouterLink>
                        {listing && user && user.id !== listing.owner_id && listing.Owner && otherUserDetails.id === listing.Owner.id && " (Owner)"}
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
                    const otherMessageUser = isCurrentUserSender ? message.Receiver : message.Sender;

                    return (
                        <div
                            key={message.id}
                            className={`flex items-end ${isCurrentUserSender ? 'justify-end' : 'justify-start'}`}
                        >
                            {/* Display other participant's photo (and make it a link) if message is from them */}
                            {!isCurrentUserSender && otherMessageUser && (
                                <RouterLink to={`/profiles/${otherMessageUser.id}`}>
                                    <img
                                        src={otherMessageUser.profile_photo_url ? `http://localhost:5000/uploads/profiles/${otherMessageUser.profile_photo_url}` : 'https://via.placeholder.com/40'}
                                        alt={otherMessageUser.name || 'User'}
                                        title={`View profile of ${otherMessageUser.name || 'User'}`}
                                        className="w-8 h-8 rounded-full mr-2 object-cover self-start flex-shrink-0 cursor-pointer hover:opacity-80"
                                    />
                                </RouterLink>
                            )}
                            <div className={`rounded-lg p-3 max-w-xs lg:max-w-md shadow-sm ${
                                isCurrentUserSender ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-gray-800'
                            }`}>
                                {/* Display sender name (and make it a link) if it's not the current user */}
                                {!isCurrentUserSender && otherMessageUser && (
                                     <RouterLink to={`/profiles/${otherMessageUser.id}`} className="text-xs font-semibold mb-1 opacity-80 hover:underline text-gray-700 hover:text-gray-900">
                                        {otherMessageUser.name || otherMessageUser.email}
                                     </RouterLink>
                                )}
                                <p className="break-words">{message.content}</p>
                                 <div className="text-xs mt-1 opacity-75 text-right">
                                    {new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </div>
                            </div>
                             {/* Display current user's photo (and make it a link to their own editable profile) */}
                            {isCurrentUserSender && user && (
                                <RouterLink to={`/profile`}> {/* Links to own editable profile */}
                                    <img
                                        src={user.profile_photo_url ? `http://localhost:5000/uploads/profiles/${user.profile_photo_url}` : 'https://via.placeholder.com/40'}
                                        alt={user.name || 'You'}
                                        title="View your profile"
                                        className="w-8 h-8 rounded-full ml-2 object-cover self-start flex-shrink-0 cursor-pointer hover:opacity-80"
                                    />
                                </RouterLink>
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