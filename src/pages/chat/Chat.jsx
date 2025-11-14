import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, orderBy, addDoc, onSnapshot, getDoc, doc, updateDoc, setDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import Header from "../../components/Header";

const Chat = () => {
  const { bookingId: urlBookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userRole } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState(null);
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);
  const [otherUserData, setOtherUserData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfile, setShowProfile] = useState(true);
  const [listingId, setListingId] = useState(null); // For "Contact Host" without booking
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isUserScrollingRef = useRef(false);
  const previousMessageCountRef = useRef(0);

  // Handle "Contact Host" without booking - create conversation from listing
  useEffect(() => {
    if (location.state && location.state.listingId && location.state.hostId && currentUser && userRole === "guest") {
      const { listingId: stateListingId, hostId: stateHostId, hostEmail: stateHostEmail } = location.state;
      
      // Check if conversation already exists
      const existingConv = conversations.find(conv => conv.otherUserId === stateHostId);
      if (existingConv) {
        setSelectedOtherUserId(existingConv.otherUserId);
        setSelectedBookingIds(existingConv.bookings.map(b => b.id));
      } else {
        // Create a temporary conversation entry
        setSelectedOtherUserId(stateHostId);
        setSelectedBookingIds([]); // No bookings yet
        setListingId(stateListingId);
        
        // Fetch host user data
        getDoc(doc(db, "users", stateHostId)).then(hostDoc => {
          if (hostDoc.exists()) {
            setOtherUserData({ id: hostDoc.id, ...hostDoc.data() });
          } else {
            setOtherUserData({
              name: stateHostEmail || "Host",
              email: stateHostEmail,
              role: "host"
            });
          }
        }).catch(err => {
          console.error("Error fetching host data:", err);
          setOtherUserData({
            name: stateHostEmail || "Host",
            email: stateHostEmail,
            role: "host"
          });
        });
      }
      
      // Clear location state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, conversations, currentUser, userRole, navigate, location.pathname]);

  // Fetch all conversations grouped by other user
  useEffect(() => {
    if (!currentUser || !userRole) return;

    const fetchConversations = async () => {
      try {
        setLoading(true);
        let bookingsQuery;
        
        if (userRole === "guest") {
          bookingsQuery = query(
            collection(db, "bookings"),
            where("guestId", "==", currentUser.uid)
          );
        } else {
          bookingsQuery = query(
            collection(db, "bookings"),
            where("hostId", "==", currentUser.uid)
          );
        }

        const snapshot = await getDocs(bookingsQuery);
        const bookingsByOtherUser = new Map(); // Map<otherUserId, { bookings: [], userData: {}, lastMessage: null, unreadCount: 0 }>

        // Group bookings by other user
        for (const docSnap of snapshot.docs) {
          const bookingData = { id: docSnap.id, ...docSnap.data() };
          const otherUserId = userRole === "guest" ? bookingData.hostId : bookingData.guestId;
          
          if (!bookingsByOtherUser.has(otherUserId)) {
            bookingsByOtherUser.set(otherUserId, {
              otherUserId,
              bookings: [],
              lastMessage: null,
              unreadCount: 0,
              lastActivityTime: new Date(bookingData.createdAt || 0).getTime()
            });
          }
          
          const conversation = bookingsByOtherUser.get(otherUserId);
          conversation.bookings.push(bookingData);
          
          // Update last activity time
          const bookingTime = new Date(bookingData.createdAt || 0).getTime();
          if (bookingTime > conversation.lastActivityTime) {
            conversation.lastActivityTime = bookingTime;
          }
        }

        // Fetch user data and messages for each conversation
        const conversationsData = [];
        for (const [otherUserId, conversation] of bookingsByOtherUser.entries()) {
          try {
            // Fetch other user's data
            const otherUserDoc = await getDoc(doc(db, "users", otherUserId));
            if (otherUserDoc.exists()) {
              conversation.userData = { id: otherUserDoc.id, ...otherUserDoc.data() };
        } else {
              // Fallback to booking data
              const firstBooking = conversation.bookings[0];
              conversation.userData = {
                firstName: userRole === "guest" 
                  ? (firstBooking.hostEmail?.split("@")[0] || "Host")
                  : (firstBooking.guestName?.split(" ")[0] || firstBooking.guestEmail?.split("@")[0] || "Guest"),
                lastName: userRole === "guest" 
                  ? ""
                  : (firstBooking.guestName?.split(" ").slice(1).join(" ") || ""),
                name: userRole === "guest" 
                  ? (firstBooking.hostEmail || "Host")
                  : (firstBooking.guestName || firstBooking.guestEmail || "Guest"),
                email: userRole === "guest" 
                  ? firstBooking.hostEmail 
                  : firstBooking.guestEmail,
                role: userRole === "guest" ? "host" : "guest"
              };
            }

            // Fetch all messages across all bookings with this user
            const allMessages = [];
            for (const booking of conversation.bookings) {
              try {
                const messagesQuery = query(
                  collection(db, "messages"),
                  where("bookingId", "==", booking.id),
                  orderBy("createdAt", "desc")
                );
                const messagesSnapshot = await getDocs(messagesQuery);
                messagesSnapshot.forEach(doc => {
                  allMessages.push({ id: doc.id, ...doc.data() });
                });
      } catch (error) {
                // Skip if query fails (might need index)
                console.log("Could not fetch messages for booking:", booking.id);
              }
            }
            
            // Also fetch messages without bookings (using conversationId)
            try {
              const conversationId1 = `${currentUser.uid}_${otherUserId}`;
              const conversationId2 = `${otherUserId}_${currentUser.uid}`;
              
              const [convSnapshot1, convSnapshot2] = await Promise.all([
                getDocs(query(
                  collection(db, "messages"),
                  where("conversationId", "==", conversationId1),
                  orderBy("createdAt", "desc")
                )).catch(() => ({ empty: true, forEach: () => {} })),
                getDocs(query(
                  collection(db, "messages"),
                  where("conversationId", "==", conversationId2),
                  orderBy("createdAt", "desc")
                )).catch(() => ({ empty: true, forEach: () => {} }))
              ]);
              
              if (!convSnapshot1.empty) {
                convSnapshot1.forEach(doc => {
                  allMessages.push({ id: doc.id, ...doc.data() });
                });
              }
              if (!convSnapshot2.empty) {
                convSnapshot2.forEach(doc => {
                  allMessages.push({ id: doc.id, ...doc.data() });
                });
              }
            } catch (error) {
              // Skip if query fails
              console.log("Could not fetch conversation messages:", error);
            }

            // Sort all messages by time and get the most recent
            allMessages.sort((a, b) => {
              const timeA = new Date(a.createdAt || 0).getTime();
              const timeB = new Date(b.createdAt || 0).getTime();
              return timeB - timeA;
            });

            if (allMessages.length > 0) {
              conversation.lastMessage = allMessages[0];
              conversation.lastActivityTime = new Date(conversation.lastMessage.createdAt).getTime();
              
              // Count unread messages
              conversation.unreadCount = allMessages.filter(msg => 
                msg.receiverId === currentUser.uid && !msg.read
              ).length;
            }

            conversationsData.push(conversation);
          } catch (error) {
            console.error("Error processing conversation:", error);
            // Still add the conversation with fallback data so it shows up
            const firstBooking = conversation.bookings[0];
            if (firstBooking) {
              conversation.userData = {
                firstName: userRole === "guest" 
                  ? (firstBooking.hostEmail?.split("@")[0] || "Host")
                  : (firstBooking.guestName?.split(" ")[0] || firstBooking.guestEmail?.split("@")[0] || "Guest"),
                lastName: userRole === "guest" 
                  ? ""
                  : (firstBooking.guestName?.split(" ").slice(1).join(" ") || ""),
                name: userRole === "guest" 
                  ? (firstBooking.hostEmail || "Host")
                  : (firstBooking.guestName || firstBooking.guestEmail || "Guest"),
                email: userRole === "guest" 
                  ? firstBooking.hostEmail 
                  : firstBooking.guestEmail,
                role: userRole === "guest" ? "host" : "guest"
              };
              conversationsData.push(conversation);
            }
          }
        }

        // Also fetch conversations without bookings (messages only)
        try {
          // Get all messages where user is sender or receiver without bookingId
    const sentMessagesQuery = query(
      collection(db, "messages"),
      where("senderId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
          );
          const sentMessagesSnapshot = await getDocs(sentMessagesQuery);
          
          const messagesByOtherUser = new Map();
          sentMessagesSnapshot.forEach(doc => {
            const msg = doc.data();
            if (msg.conversationId && !msg.bookingId) {
              // Extract other user ID from conversationId
              const parts = msg.conversationId.split('_');
              const otherUserId = parts[0] === currentUser.uid ? parts[1] : parts[0];
              
              if (!bookingsByOtherUser.has(otherUserId) && !messagesByOtherUser.has(otherUserId)) {
                messagesByOtherUser.set(otherUserId, {
                  otherUserId,
                  bookings: [],
                  lastMessage: msg,
                  unreadCount: 0,
                  lastActivityTime: new Date(msg.createdAt || 0).getTime()
                });
              }
            }
          });
          
          // Also check received messages
    const receivedMessagesQuery = query(
      collection(db, "messages"),
      where("receiverId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
          );
          const receivedMessagesSnapshot = await getDocs(receivedMessagesQuery);
          
          receivedMessagesSnapshot.forEach(doc => {
            const msg = doc.data();
            if (msg.conversationId && !msg.bookingId) {
              const parts = msg.conversationId.split('_');
              const otherUserId = parts[0] === currentUser.uid ? parts[1] : parts[0];
              
              if (!bookingsByOtherUser.has(otherUserId)) {
                if (!messagesByOtherUser.has(otherUserId)) {
                  messagesByOtherUser.set(otherUserId, {
                    otherUserId,
                    bookings: [],
                    lastMessage: msg,
                    unreadCount: msg.read ? 0 : 1,
                    lastActivityTime: new Date(msg.createdAt || 0).getTime()
                  });
                } else {
                  const conv = messagesByOtherUser.get(otherUserId);
                  if (new Date(msg.createdAt || 0).getTime() > conv.lastActivityTime) {
                    conv.lastMessage = msg;
                    conv.lastActivityTime = new Date(msg.createdAt || 0).getTime();
                  }
                  if (!msg.read) conv.unreadCount++;
                }
              }
            }
          });
          
          // Fetch user data for message-only conversations
          for (const [otherUserId, conv] of messagesByOtherUser.entries()) {
            try {
              const otherUserDoc = await getDoc(doc(db, "users", otherUserId));
              if (otherUserDoc.exists()) {
                conv.userData = { id: otherUserDoc.id, ...otherUserDoc.data() };
              } else {
                conv.userData = {
                  name: "User",
                  email: "",
                  role: userRole === "guest" ? "host" : "guest"
                };
              }
              conversationsData.push(conv);
            } catch (error) {
              console.error("Error fetching user data for conversation:", error);
            }
          }
        } catch (error) {
          console.error("Error fetching message-only conversations:", error);
        }

        // Sort by last activity time
        conversationsData.sort((a, b) => b.lastActivityTime - a.lastActivityTime);

        setConversations(conversationsData);
        
        // If URL has bookingId, find the conversation and select it
        if (urlBookingId && urlBookingId !== 'new') {
          const conversation = conversationsData.find(conv => 
            conv.bookings.some(b => b.id === urlBookingId)
          );
          if (conversation) {
            setSelectedOtherUserId(conversation.otherUserId);
            setSelectedBookingIds(conversation.bookings.map(b => b.id));
            // Also set otherUserData immediately if available
            if (conversation.userData) {
              setOtherUserData(conversation.userData);
            }
          } else {
            // If conversation not found, try to fetch booking and create conversation
            getDoc(doc(db, "bookings", urlBookingId)).then(async (bookingDoc) => {
              if (bookingDoc.exists()) {
                const bookingData = bookingDoc.data();
                const otherUserId = userRole === "guest" ? bookingData.hostId : bookingData.guestId;
                setSelectedOtherUserId(otherUserId);
                setSelectedBookingIds([urlBookingId]);
                
                // Fetch other user data
                try {
                  const userDoc = await getDoc(doc(db, "users", otherUserId));
                  if (userDoc.exists()) {
                    setOtherUserData({ id: userDoc.id, ...userDoc.data() });
                  } else {
                    // Fallback to booking data
                    setOtherUserData({
                      name: userRole === "guest" 
                        ? (bookingData.hostEmail || "Host")
                        : (bookingData.guestName || bookingData.guestEmail || "Guest"),
                      email: userRole === "guest" 
                        ? bookingData.hostEmail 
                        : bookingData.guestEmail,
                      role: userRole === "guest" ? "host" : "guest"
                    });
                  }
                } catch (error) {
                  console.error("Error fetching user data:", error);
                  // Still set basic data
                  setOtherUserData({
                    name: userRole === "guest" 
                      ? (bookingData.hostEmail || "Host")
                      : (bookingData.guestName || bookingData.guestEmail || "Guest"),
                    email: userRole === "guest" 
                      ? bookingData.hostEmail 
                      : bookingData.guestEmail,
                    role: userRole === "guest" ? "host" : "guest"
                  });
                }
              }
            }).catch((error) => {
              console.error("Error fetching booking:", error);
            });
          }
        } else if (conversationsData.length > 0 && !selectedOtherUserId && !urlBookingId) {
          // Select first conversation by default (only if no URL bookingId)
          const firstConv = conversationsData[0];
          setSelectedOtherUserId(firstConv.otherUserId);
          setSelectedBookingIds(firstConv.bookings.map(b => b.id));
          if (firstConv.userData) {
            setOtherUserData(firstConv.userData);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching conversations:", error);
        setLoading(false);
      }
    };

    fetchConversations();
  }, [currentUser, userRole, urlBookingId]);

  // Fetch other user data when conversation is selected
  useEffect(() => {
    if (!selectedOtherUserId || !currentUser) {
      setOtherUserData(null);
      return;
    }

    const fetchUserData = async () => {
      try {
        const otherUserDoc = await getDoc(doc(db, "users", selectedOtherUserId));
        if (otherUserDoc.exists()) {
          setOtherUserData({ id: otherUserDoc.id, ...otherUserDoc.data() });
        } else {
          // Fallback - find from conversations
          const conversation = conversations.find(c => c.otherUserId === selectedOtherUserId);
          if (conversation && conversation.userData) {
            setOtherUserData(conversation.userData);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [selectedOtherUserId, currentUser, conversations]);

  // Set up real-time listener for messages across all selected bookings or conversations
  useEffect(() => {
    if (!selectedOtherUserId || !currentUser) {
      setMessages([]);
      previousMessageCountRef.current = 0;
      return;
    }
    
    // Reset message count when switching conversations
    previousMessageCountRef.current = 0;

    const allMessages = new Map();
    const unsubscribeFunctions = [];

    const updateMessages = () => {
      const messagesArray = Array.from(allMessages.values());
      messagesArray.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateA - dateB;
      });
      
      const isNewMessage = messagesArray.length > previousMessageCountRef.current;
      previousMessageCountRef.current = messagesArray.length;
      
      setMessages(messagesArray);
      markMessagesAsRead(messagesArray);
      
      if (isNewMessage) {
        setTimeout(() => {
          const container = messagesContainerRef.current;
          if (!container || !messagesEndRef.current) return;
          
          const { scrollTop, scrollHeight, clientHeight } = container;
          const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
          const isAtBottom = distanceFromBottom < 150;
          
          if (isAtBottom && !isUserScrollingRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    };

    const markMessagesAsRead = async (messages) => {
      if (!currentUser) return;
      
      const unreadMessages = messages.filter(
        (msg) => msg.receiverId === currentUser.uid && !msg.read
      );

      if (unreadMessages.length > 0) {
        const updatePromises = unreadMessages.map((msg) =>
          updateDoc(doc(db, "messages", msg.id), {
            read: true,
            readAt: new Date().toISOString(),
          })
        );
        try {
          await Promise.all(updatePromises);
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      }
    };

    if (selectedBookingIds.length > 0) {
      // Set up listeners for each booking
      selectedBookingIds.forEach(bookingId => {
        // Sent messages
        const sentQuery = query(
          collection(db, "messages"),
          where("bookingId", "==", bookingId),
          where("senderId", "==", currentUser.uid),
          orderBy("createdAt", "asc")
        );

        const unsubscribeSent = onSnapshot(
          sentQuery,
      (snapshot) => {
        snapshot.forEach((doc) => {
              allMessages.set(doc.id, { id: doc.id, ...doc.data() });
            });
        updateMessages();
      },
      (error) => {
        console.error("Error listening to sent messages:", error);
          }
        );

        // Received messages
        const receivedQuery = query(
          collection(db, "messages"),
          where("bookingId", "==", bookingId),
          where("receiverId", "==", currentUser.uid),
          orderBy("createdAt", "asc")
        );

        const unsubscribeReceived = onSnapshot(
          receivedQuery,
          (snapshot) => {
            snapshot.forEach((doc) => {
              allMessages.set(doc.id, { id: doc.id, ...doc.data() });
            });
            updateMessages();
          },
          (error) => {
            console.error("Error listening to received messages:", error);
          }
        );

        unsubscribeFunctions.push(unsubscribeSent, unsubscribeReceived);
      });
    } else {
      // Listen for messages without bookings (using conversationId or direct user pair)
      const conversationId = `${currentUser.uid}_${selectedOtherUserId}`;
      const altConversationId = `${selectedOtherUserId}_${currentUser.uid}`;
      
      // Sent messages
      const sentQuery1 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId),
        where("senderId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );
      
      const sentQuery2 = query(
        collection(db, "messages"),
        where("conversationId", "==", altConversationId),
        where("senderId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const unsubscribeSent1 = onSnapshot(
        sentQuery1,
      (snapshot) => {
        snapshot.forEach((doc) => {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          });
          updateMessages();
        },
        (error) => {
          console.error("Error listening to sent messages:", error);
        }
      );
      
      const unsubscribeSent2 = onSnapshot(
        sentQuery2,
        (snapshot) => {
          snapshot.forEach((doc) => {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          });
          updateMessages();
        },
        (error) => {
          console.error("Error listening to sent messages:", error);
        }
      );

      // Received messages
      const receivedQuery1 = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId),
        where("receiverId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );
      
      const receivedQuery2 = query(
        collection(db, "messages"),
        where("conversationId", "==", altConversationId),
        where("receiverId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
      );

      const unsubscribeReceived1 = onSnapshot(
        receivedQuery1,
        (snapshot) => {
          snapshot.forEach((doc) => {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          });
        updateMessages();
      },
      (error) => {
        console.error("Error listening to received messages:", error);
        }
      );
      
      const unsubscribeReceived2 = onSnapshot(
        receivedQuery2,
        (snapshot) => {
          snapshot.forEach((doc) => {
            allMessages.set(doc.id, { id: doc.id, ...doc.data() });
          });
          updateMessages();
        },
        (error) => {
          console.error("Error listening to received messages:", error);
        }
      );

      unsubscribeFunctions.push(unsubscribeSent1, unsubscribeSent2, unsubscribeReceived1, unsubscribeReceived2);
    }

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [selectedBookingIds, selectedOtherUserId, currentUser]);

  // Track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollTimer = null;
    const handleScroll = () => {
      isUserScrollingRef.current = true;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 300);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, []);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "auto" });
          isUserScrollingRef.current = false;
          previousMessageCountRef.current = messages.length;
        }
      }, 200);
    }
  }, [selectedOtherUserId]);

  // Handle typing indicator (use first booking ID for typing indicator)
  useEffect(() => {
    if (!currentUser || !selectedOtherUserId) return;

    // Use bookingId if available, otherwise use conversationId
    const conversationId = selectedBookingIds.length 
      ? selectedBookingIds[0] 
      : `${currentUser.uid}_${selectedOtherUserId}`;
    const typingDocRef = doc(db, "typing", `${conversationId}_${currentUser.uid}`);
    
    if (!newMessage.trim()) {
      setDoc(typingDocRef, {
        isTyping: false,
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      return;
    }

    setDoc(typingDocRef, {
      isTyping: true,
      userId: currentUser.uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setDoc(typingDocRef, {
        isTyping: false,
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }, 3000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [newMessage, selectedBookingIds, currentUser, selectedOtherUserId]);

  // Listen for other user's typing status
  useEffect(() => {
    if (!currentUser || !selectedOtherUserId) return;

    // Use bookingId if available, otherwise use conversationId
    const conversationId = selectedBookingIds.length 
      ? selectedBookingIds[0] 
      : `${currentUser.uid}_${selectedOtherUserId}`;
    const otherUserTypingDocRef = doc(db, "typing", `${conversationId}_${selectedOtherUserId}`);

    const unsubscribe = onSnapshot(
      otherUserTypingDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const updatedAt = data.updatedAt?.toDate();
          const now = new Date();
          const timeDiff = updatedAt ? (now - updatedAt) / 1000 : Infinity;
          
          if (data.isTyping && timeDiff < 4) {
            setOtherUserTyping(true);
          } else {
            setOtherUserTyping(false);
          }
        } else {
          setOtherUserTyping(false);
        }
      },
      (error) => {
        console.error("Error listening to typing status:", error);
        setOtherUserTyping(false);
      }
    );

    return () => unsubscribe();
  }, [selectedBookingIds, currentUser, selectedOtherUserId, userRole]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !selectedOtherUserId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Use bookingId if available, otherwise use a conversation ID based on user IDs
    const conversationId = selectedBookingIds.length 
      ? selectedBookingIds[0] 
      : `${currentUser.uid}_${selectedOtherUserId}`;
    
    if (currentUser) {
      const typingDocRef = doc(db, "typing", `${conversationId}_${currentUser.uid}`);
      setDoc(typingDocRef, {
        isTyping: false,
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage("");
    
    try {
      const senderId = currentUser.uid;
      const senderName = currentUser.displayName || currentUser.email?.split("@")[0] || "User";
      const senderEmail = currentUser.email;
      const receiverId = selectedOtherUserId;
      const receiverEmail = otherUserData?.email || "";

      const messageData = {
        bookingId: selectedBookingIds.length ? selectedBookingIds[0] : null,
        listingId: listingId || null,
        conversationId: conversationId, // For grouping messages without bookings
        senderId: senderId,
        senderName: senderName,
        senderEmail: senderEmail,
        receiverId: receiverId,
        receiverEmail: receiverEmail,
        message: messageText,
        createdAt: new Date().toISOString(),
        read: false,
      };

      await addDoc(collection(db, "messages"), messageData);
      
      // If this was the first message and we don't have bookings, refresh conversations
      if (!selectedBookingIds.length) {
        // Trigger a refresh by updating conversations
        const newConv = {
          otherUserId: selectedOtherUserId,
          bookings: [],
          userData: otherUserData,
          lastMessage: messageData,
          unreadCount: 0,
          lastActivityTime: new Date().getTime()
        };
        setConversations(prev => {
          const existing = prev.find(c => c.otherUserId === selectedOtherUserId);
          if (existing) {
            return prev.map(c => c.otherUserId === selectedOtherUserId ? newConv : c);
          }
          return [newConv, ...prev];
        });
      }
      
      isUserScrollingRef.current = false;
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
      
      setSending(false);
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
      alert("Failed to send message. Please try again.");
      setSending(false);
    }
  };

  const getOtherPartyName = () => {
    if (!otherUserData) return "";
    const firstName = otherUserData.firstName || "";
    const lastName = otherUserData.lastName || "";
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return otherUserData.name || otherUserData.email || "User";
  };

  const getOtherPartyInitials = () => {
    if (!otherUserData) return "U";
    const firstName = otherUserData.firstName || "";
    const lastName = otherUserData.lastName || "";
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    } else if (otherUserData.name) {
      const nameParts = otherUserData.name.split(" ");
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return nameParts[0][0].toUpperCase();
    }
    return "U";
  };

  const getOtherPartyInitialsFromData = (userData) => {
    if (!userData) return "U";
    const firstName = userData.firstName || "";
    const lastName = userData.lastName || "";
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    } else if (userData.name) {
      const nameParts = userData.name.split(" ");
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return nameParts[0][0].toUpperCase();
    }
    return "U";
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const userData = conv.userData || {};
    const firstName = userData.firstName || "";
    const lastName = userData.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || userData.name || userData.email || "";
    return fullName.toLowerCase().includes(searchLower);
  });

  if (loading && conversations.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-[#1C1C1E] font-light">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header />
      
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden relative">
        {/* Left Sidebar - Inbox */}
        <div className={`absolute sm:relative inset-0 sm:inset-auto w-full sm:w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-10 ${
          selectedOtherUserId ? 'hidden sm:flex' : 'flex'
        }`}>
          {/* Inbox Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1C1C1E] mb-4">Inbox</h2>
            
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#F2F2F7] rounded-xl text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[#8E8E93] text-sm font-light">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const userData = conv.userData || {};
                const firstName = userData.firstName || "";
                const lastName = userData.lastName || "";
                const fullName = firstName && lastName 
                  ? `${firstName} ${lastName}`.trim()
                  : (userData.name || userData.email || "User");
                const initials = getOtherPartyInitialsFromData(userData);
                const isSelected = conv.otherUserId === selectedOtherUserId;

  return (
          <button
                    key={conv.otherUserId}
                    onClick={() => {
                      setSelectedOtherUserId(conv.otherUserId);
                      setSelectedBookingIds(conv.bookings.map(b => b.id));
                      setShowProfile(true);
                    }}
                    className={`w-full p-4 hover:bg-gray-50 transition-colors duration-200 text-left border-b border-gray-100 ${
                      isSelected ? "bg-[#0071E3]/5 border-l-4 border-l-[#0071E3]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-[#0071E3] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                        {initials}
                      </div>
                      
                      {/* Content */}
          <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-semibold text-[#1C1C1E] truncate">
                            {fullName}
                          </h3>
                          {conv.unreadCount > 0 && (
                            <span className="bg-[#0071E3] text-white text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
            </div>
                        <p className="text-xs text-[#8E8E93] font-light line-clamp-1">
                          {conv.lastMessage 
                            ? conv.lastMessage.message 
                            : "No messages yet"}
                        </p>
            </div>
          </div>
                  </button>
                );
              })
            )}
        </div>
        </div>

        {/* Center Panel - Conversation */}
        <div className={`flex-1 flex flex-col bg-white min-w-0 ${selectedOtherUserId ? 'flex' : 'hidden sm:flex'}`}>
          {selectedOtherUserId && otherUserData ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#0071E3] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                    {getOtherPartyInitials()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-[#1C1C1E] truncate">
                      {getOtherPartyName()}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => navigate(-1)}
                  className="sm:hidden p-2 text-[#8E8E93] hover:text-[#1C1C1E] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
                className="flex-1 overflow-y-auto bg-[#F5F5F7] px-4 sm:px-6 py-6 sm:py-8"
      >
          {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[#8E8E93] text-sm font-light">
                No messages yet. Start the conversation!
              </p>
                    </div>
            </div>
          ) : (
                  <div className="space-y-1">
                    {messages.map((message, index) => {
              const isOwnMessage = message.senderId === currentUser.uid;
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const isSameSender = prevMessage && prevMessage.senderId === message.senderId;
                      const getMessageDate = (msg) => {
                        if (!msg.createdAt) return new Date(0);
                        if (msg.createdAt.toDate) return msg.createdAt.toDate();
                        if (msg.createdAt instanceof Date) return msg.createdAt;
                        if (typeof msg.createdAt === 'string') return new Date(msg.createdAt);
                        if (msg.createdAt.seconds) return new Date(msg.createdAt.seconds * 1000);
                        return new Date(msg.createdAt);
                      };
              const timeDiff = prevMessage 
                        ? getMessageDate(message) - getMessageDate(prevMessage)
                : Infinity;
                      const showTime = !isSameSender || timeDiff > 300000;
              
              // Check if this is a system message
              const isSystemMessage = message.isSystem || message.senderId === "system";
              
              if (isSystemMessage) {
                // Render system message with special styling
                return (
                  <div
                    key={message.id}
                    className="flex justify-center mb-3 animate-fadeInUp"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="max-w-[85%] sm:max-w-[75%]">
                      <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-2xl px-5 py-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#34C759]/20 flex items-center justify-center mt-0.5">
                            <svg className="w-3 h-3 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words text-[#1C1C1E]">
                              {message.message}
                            </p>
                            <span className="text-xs text-[#8E8E93] mt-2 block">
                              {(() => {
                                try {
                                  if (!message.createdAt) return "";
                                  let date;
                                  if (message.createdAt.toDate) {
                                    date = message.createdAt.toDate();
                                  } else if (message.createdAt instanceof Date) {
                                    date = message.createdAt;
                                  } else if (typeof message.createdAt === 'string') {
                                    date = new Date(message.createdAt);
                                  } else if (message.createdAt.seconds) {
                                    date = new Date(message.createdAt.seconds * 1000);
                                  } else {
                                    date = new Date(message.createdAt);
                                  }
                                  if (isNaN(date.getTime())) return "";
                                  return date.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                } catch (error) {
                                  return "";
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={message.id}
                          className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-3 animate-fadeInUp`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                >
                          <div className={`max-w-[75%] sm:max-w-[65%] ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}>
                    {!isOwnMessage && !isSameSender && (
                              <div className="text-xs text-[#8E8E93] font-medium mb-2 px-3">
                        {message.senderName}
                      </div>
                    )}
                    <div
                              className={`px-5 py-4 rounded-2xl ${
                        isOwnMessage
                                  ? "bg-[#0071E3] text-white rounded-br-sm"
                          : "bg-white text-[#1C1C1E] rounded-bl-sm shadow-sm"
                      }`}
                    >
                              <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words mb-2">
                        {message.message}
                      </p>
                              <div className={`flex items-baseline gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                          <span
                                  className={`text-xs ${
                                    isOwnMessage ? "text-white/80" : "text-[#8E8E93]"
                                  }`}
                                >
                                  {(() => {
                                    try {
                                      if (!message.createdAt) return "";
                                      let date;
                                      if (message.createdAt.toDate) {
                                        date = message.createdAt.toDate();
                                      } else if (message.createdAt instanceof Date) {
                                        date = message.createdAt;
                                      } else if (typeof message.createdAt === 'string') {
                                        date = new Date(message.createdAt);
                                      } else if (message.createdAt.seconds) {
                                        date = new Date(message.createdAt.seconds * 1000);
                                      } else {
                                        date = new Date(message.createdAt);
                                      }
                                      if (isNaN(date.getTime())) return "";
                                      return date.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                                      });
                                    } catch (error) {
                                      return "";
                                    }
                                  })()}
                          </span>
                        {isOwnMessage && (
                                  <span className="text-xs text-white/80">
                              {message.read ? "✓✓" : "✓"}
                            </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
                    })}
          {otherUserTyping && (
                      <div className="flex justify-start mb-3">
                        <div className="bg-white rounded-2xl rounded-bl-sm shadow-sm px-5 py-4">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2.5 h-2.5 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2.5 h-2.5 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
                )}
      </div>

              {/* Message Input */}
              <div className="border-t border-gray-200 bg-white p-4 sm:p-6 flex-shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
                  <div className="flex-1 bg-[#F2F2F7] rounded-2xl px-4 py-3 border border-transparent focus-within:border-[#0071E3]/30 focus-within:bg-white transition-colors min-h-[44px] flex items-center">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="w-full bg-transparent text-sm sm:text-base text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none"
              disabled={sending}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
                    className="bg-[#0071E3] text-white rounded-full w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:bg-[#0051D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm active:scale-95"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[#8E8E93] text-sm font-light">
                  Select a conversation to start messaging
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Profile (Desktop) */}
        {selectedOtherUserId && otherUserData && (
          <div className={`hidden lg:flex w-80 bg-white border-l border-gray-200 flex-col flex-shrink-0`}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-[#1C1C1E] mb-6">Profile</h3>
              
              {/* Profile Info */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#0071E3] flex items-center justify-center text-white font-semibold text-xl">
                  {getOtherPartyInitials()}
                </div>
                <h4 className="text-lg font-semibold text-[#1C1C1E] mb-2">
                  {getOtherPartyName()}
                </h4>
                {otherUserData.firstName && otherUserData.lastName && (
                  <p className="text-sm text-[#8E8E93] font-light mb-4">
                    {otherUserData.firstName} {otherUserData.lastName}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-[#0071E3]/10 text-[#0071E3] rounded-lg text-xs font-medium">
                    {otherUserData.role === "host" ? "Host" : "Guest"}
                  </span>
                  {otherUserData.role === "host" && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Prime Host
                    </span>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#8E8E93] mb-1 block">Email</label>
                  <p className="text-sm text-[#1C1C1E] font-light">
                    {otherUserData.email || "Not provided"}
                  </p>
                </div>
                {otherUserData.phone && (
                  <div>
                    <label className="text-xs font-medium text-[#8E8E93] mb-1 block">Phone</label>
                    <p className="text-sm text-[#1C1C1E] font-light">
                      {otherUserData.phone}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
