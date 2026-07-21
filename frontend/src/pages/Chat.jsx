import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import api from '../api/axios.js';
import { useLocation } from 'react-router-dom';

const ACTIVE_CONVERSATION_KEY = 'activeConversationId';

export default function Chat() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [focusRequests, setFocusRequests] = useState(false);
  // Guards the sessionStorage-sync effect below so it can't wipe the saved
  // conversation id before the restore attempt on mount has actually run.
  const [hydrated, setHydrated] = useState(false);
  const location = useLocation();

  // Load standard baseline rooms on load, and restore whatever conversation
  // was open before a reload (unless navigation is about to hand us one below)
  useEffect(() => {
    api.get('/conversations')
      .then((res) => {
        setConversations(res.data);

        const hasNavigationTarget =
          location.state?.incomingConversation || location.state?.conversationId;

        if (!hasNavigationTarget) {
          const savedId = sessionStorage.getItem(ACTIVE_CONVERSATION_KEY);
          if (savedId) {
            const found = res.data.find((c) => c._id === savedId);
            if (found) setActiveConversation(found);
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intercept data passed from navigation actions
  useEffect(() => {
    if (location.state?.focusRequests) {
      setFocusRequests(true);
      window.history.replaceState({}, document.title);
      return;
    }

    const incoming = location.state?.incomingConversation;
    if (incoming) {
      // Set the active workspace
      setActiveConversation(incoming);

      // Instantly push up into sidebar tracking arrays
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === incoming._id);
        if (exists) return prev;
        return [incoming, ...prev];
      });

      // Clear layout state so window flashes do not duplicate array entries
      window.history.replaceState({}, document.title);
    } else {
      // Fallback baseline layout checks via fallback parameters if present
      const conversationId = location?.state?.conversationId;
      if (!conversationId) return;
      const existing = conversations.find((c) => c._id === conversationId);
      if (existing) {
        setActiveConversation(existing);
      } else {
        api.get('/conversations')
          .then((res) => {
            setConversations(res.data);
            const found = res.data.find((c) => c._id === conversationId);
            if (found) setActiveConversation(found);
          })
          .catch(() => {});
      }
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Keep sessionStorage in sync so a page reload can restore the active chat.
  // Skipped until the initial restore attempt has finished, otherwise this
  // fires on the very first render (activeConversation still null) and
  // deletes the saved id before we've had a chance to read it back.
  useEffect(() => {
    if (!hydrated) return;

    if (activeConversation) {
      sessionStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversation._id);
    } else {
      sessionStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }
  }, [activeConversation, hydrated]);

  // useCallback with an empty dependency array keeps this function's
  // identity stable across renders. It's passed to ChatWindow, where it
  // sits in a useEffect dependency array -- if it were recreated on every
  // render (e.g. whenever the sidebar updates a conversation's last-message
  // preview via setConversations), that effect would keep tearing down and
  // rejoining the socket room, clearing and refetching messages each time.
  const handleConversationDeleted = useCallback(() => {
    setActiveConversation((current) => {
      if (current) {
        setConversations((prev) => prev.filter((c) => c._id !== current._id));
      }
      return null;
    });
  }, []);

  return (
    <div className={`chat-layout ${activeConversation ? 'has-active-conversation' : ''}`}>
      <Sidebar
        conversations={conversations}
        setConversations={setConversations}
        activeConversation={activeConversation}
        onSelectConversation={setActiveConversation}
        focusRequests={focusRequests}
        onFocusRequestsHandled={() => setFocusRequests(false)}
      />
      {activeConversation ? (
        <ChatWindow
          conversation={activeConversation}
          onConversationDeleted={handleConversationDeleted}
          onBack={() => setActiveConversation(null)}
        />
      ) : (
        <div className="empty-state chat-empty-state">Select a conversation to start chatting</div>
      )}
    </div>
  );
}