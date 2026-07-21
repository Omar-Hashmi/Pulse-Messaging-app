import { useEffect, useState, useRef } from 'react';
import api from '../api/axios.js';
import { useSocket } from '../hooks/useSocket.js';
import { useAuth } from '../hooks/useAuth.js';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import Snackbar from './Snackbar.jsx';

export default function ChatWindow({ conversation, onConversationDeleted, onBack }) {
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const headerMenuRef = useRef();
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();

  // Guarded tracking to avoid runtime errors when mounting
  const conversationId = conversation?._id;
  const otherParticipant = conversation?.participants?.find((p) => p._id !== user._id);
  const isDirectChat = conversation?.participants?.length === 2;

  // Whether the other participant is still a friend. Falls back to `true`
  // (i.e. don't block) if `user.friends` isn't populated on the auth object,
  // so this only actively blocks sending once friend data is actually wired
  // up -- it never silently breaks messaging for accounts without it.
  // The server is still the source of truth: even if this check is wrong
  // or stale, the message:error handler below catches a server-side
  // rejection and shows the same explanation.
  const isFriend = !isDirectChat || !otherParticipant || (
    user?.friends
      ? user.friends.some((f) => (typeof f === 'string' ? f === otherParticipant._id : f?._id === otherParticipant._id))
      : true
  );

  const NOT_FRIENDS_MESSAGE = 'You need to be friends to send this user a message.';

  // Holds the latest onConversationDeleted without needing it in the big
  // effect's dependency array below. If a parent ever passes a new function
  // reference for this prop on every render, this keeps that effect (which
  // joins the socket room and fetches message history) from needlessly
  // tearing down and re-running -- which would otherwise clear the message
  // list and refetch it, flashing the screen blank for a moment.
  const onConversationDeletedRef = useRef(onConversationDeleted);
  useEffect(() => {
    onConversationDeletedRef.current = onConversationDeleted;
  }, [onConversationDeleted]);

  useEffect(() => {
    if (!conversationId) return;

    setReplyToMessage(null);
    setEditingMessage(null);
    setTypingUsers([]);
    setMessages([]);

    api.get(`/messages/${conversationId}`)
      .then((res) => setMessages(res.data))
      .catch((err) => console.error(err));

    socket?.emit('conversation:join', conversationId);

    const normalizeConversationId = (conv) => {
      if (!conv) return null;
      if (typeof conv === 'string') return conv;
      if (conv._id) return conv._id.toString();
      return conv.toString?.() || null;
    };

    const onNewMessage = (msg) => {
      if (normalizeConversationId(msg.conversation) !== conversationId) return;

      const { tempId, ...cleanMsg } = msg;

      setMessages((prev) => {
        if (tempId && prev.some((m) => m._id === tempId)) {
          return prev.map((m) => (m._id === tempId ? cleanMsg : m));
        }
        if (prev.some((m) => m._id === cleanMsg._id)) return prev;
        return [...prev, cleanMsg];
      });

      // Let the sender know we've received it, unless it's our own echo.
      if (!tempId && cleanMsg.sender?._id !== user._id) {
        socket?.emit('message:delivered', { messageIds: [cleanMsg._id], conversationId });
      }
    };

    const onMessageDelivered = ({ messageIds, deliveredTo }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          messageIds.includes(msg._id)
            ? { ...msg, deliveredTo: [...new Set([...(msg.deliveredTo || []).map(String), deliveredTo])] }
            : msg
        )
      );
    };

    const onMessageRead = ({ messageIds, readerId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          messageIds.includes(msg._id)
            ? { ...msg, readBy: [...new Set([...(msg.readBy || []).map(String), readerId])] }
            : msg
        )
      );
    };

    const onMessageUpdated = (updated) => {
      setMessages((prev) => prev.map((msg) => (msg._id === updated._id ? updated : msg)));
    };

    const onMessageDeleted = (deleted) => {
      setMessages((prev) => prev.map((msg) => (msg._id === deleted._id ? deleted : msg)));
    };

    const onTypingStart = ({ conversationId: cid, userId }) => {
      if (cid === conversationId && userId !== user._id) {
        setTypingUsers((prev) => [...new Set([...prev, userId])]);
      }
    };

    const onTypingStop = ({ conversationId: cid, userId }) => {
      if (cid === conversationId) {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
      }
    };

    const handleConversationDeletedEvent = ({ conversationId: cid }) => {
      if (cid === conversationId) {
        onConversationDeletedRef.current?.();
      }
    };

    const onMessageError = ({ message, tempId }) => {
      if (tempId) {
        setMessages((prev) =>
          prev.map((msg) => (msg._id === tempId ? { ...msg, status: 'failed' } : msg))
        );
      }
      setToast({ type: 'error', message: message || 'Unable to send message' });
    };

    socket?.on('message:new', onNewMessage);
    socket?.on('message:updated', onMessageUpdated);
    socket?.on('message:deleted', onMessageDeleted);
    socket?.on('message:delivered', onMessageDelivered);
    socket?.on('message:read', onMessageRead);
    socket?.on('typing:start', onTypingStart);
    socket?.on('typing:stop', onTypingStop);
    socket?.on('conversation:deleted', handleConversationDeletedEvent);
    socket?.on('message:error', onMessageError);

    return () => {
      socket?.emit('conversation:leave', conversationId);
      socket?.off('message:new', onNewMessage);
      socket?.off('message:updated', onMessageUpdated);
      socket?.off('message:deleted', onMessageDeleted);
      socket?.off('message:delivered', onMessageDelivered);
      socket?.off('message:read', onMessageRead);
      socket?.off('typing:start', onTypingStart);
      socket?.off('typing:stop', onTypingStop);
      socket?.off('conversation:deleted', handleConversationDeletedEvent);
      socket?.off('message:error', onMessageError);
    };
  }, [conversationId, socket, user._id]);

  useEffect(() => {
    if (!messages.length || !user._id || !conversationId) return;

    const unreadIds = messages
      .filter((msg) => !msg.status) // skip optimistic 'sending'/'failed' messages — they have client-only temp ids, not real Mongo _ids
      .filter((msg) => !msg.readBy?.some((id) => {
        if (!id) return false;
        if (typeof id === 'string') return id === user._id;
        return id._id ? id._id === user._id : id.toString() === user._id;
      }))
      .map((msg) => msg._id);

    if (!unreadIds.length) return;

    socket?.emit('message:read', { messageIds: unreadIds, conversationId });

    setMessages((prev) =>
      prev.map((msg) =>
        unreadIds.includes(msg._id)
          ? { ...msg, readBy: [...new Set([...(msg.readBy || []), user._id])] }
          : msg
      )
    );
  }, [messages.length, user._id, conversationId, socket]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) setHeaderMenuOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const sendMessage = (text, attachments, replyTo) => {
    if (!isFriend) {
      setToast({ type: 'error', message: NOT_FRIENDS_MESSAGE });
      return;
    }

    if (editingMessage) {
      socket?.emit('message:edit', { messageId: editingMessage._id, text });
      setEditingMessage(null);
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage = {
      _id: tempId,
      conversation: conversationId,
      sender: { _id: user._id, username: user.username, avatar: user.avatar },
      text,
      attachments: attachments || [],
      // Store the full message here (not just the id) so MessageList can
      // render "Replying to <username>: <text>" immediately, before the
      // server echoes back a populated version. The socket emit below still
      // sends just the id, which is what the backend expects.
      replyTo: replyToMessage || undefined,
      readBy: [],
      deliveredTo: [],
      createdAt: new Date().toISOString(),
      status: 'sending'
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    socket?.emit('message:send', { conversationId, text, attachments, replyTo, tempId });
    setReplyToMessage(null);
  };

  const startReply = (message) => setReplyToMessage(message);
  const startEdit = (message) => setEditingMessage(message);
  const clearReply = () => setReplyToMessage(null);
  const clearEdit = () => setEditingMessage(null);
  const deleteMessage = (messageId) => socket?.emit('message:delete', { messageId });
  const reactToMessage = (messageId, emoji) => socket?.emit('message:react', { messageId, emoji });

  const handleBlockUser = async () => {
    if (!otherParticipant) return;
    if (!window.confirm(`Block ${otherParticipant.username}? They won't be able to message you.`)) return;
    try {
      await api.post('/users/block', { userId: otherParticipant._id });
      setHeaderMenuOpen(false);
      onConversationDeleted?.();
    } catch (err) {
      console.error('Unable to block user', err);
    }
  };

  const otherParticipants = conversation?.participants
    ?.filter((p) => p._id !== user._id)
    .map((p) => p.username)
    .join(', ');

  const isOtherOnline = otherParticipant && onlineUsers.includes(otherParticipant._id);

  const formatLastSeen = (dateString) => {
    if (!dateString) return null;
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const presenceLabel = isDirectChat
    ? isOtherOnline
      ? 'Active now'
      : otherParticipant?.lastSeen
        ? `Active ${formatLastSeen(otherParticipant.lastSeen)}`
        : null
    : null;

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        {onBack && (
          <button type="button" className="chat-back-btn" onClick={onBack} aria-label="Back to conversations">
            ←
          </button>
        )}
        <div className="chat-window-header-title">
          <h3>{otherParticipants || 'Conversation'}</h3>
          {presenceLabel ? (
            <p className="chat-presence">
              <span className={`presence-dot ${isOtherOnline ? 'online' : 'offline'}`} aria-hidden="true" />
              {presenceLabel}
            </p>
          ) : (
            <p>{isDirectChat ? 'Private chat' : `${conversation?.participants?.length} participants`}</p>
          )}
        </div>
        {otherParticipant && (
          <div className="chat-header-menu" ref={headerMenuRef}>
            <button
              type="button"
              className="menu-trigger"
              onClick={() => setHeaderMenuOpen((v) => !v)}
              aria-label="Conversation options"
            >
              ⋮
            </button>
            {headerMenuOpen && (
              <div className="message-dropdown chat-header-dropdown">
                <button type="button" className="danger" onClick={handleBlockUser}>
                  Block {otherParticipant.username}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="chat-window-body">
        <MessageList
          messages={messages}
          currentUserId={user._id ?? user.id}
          onReply={startReply}
          onEdit={startEdit}
          onDelete={deleteMessage}
          onReact={reactToMessage}
        />
      </div>
      <TypingIndicator typingUsers={typingUsers} />
      {isFriend ? (
        <MessageInput
          conversationId={conversationId}
          onSend={sendMessage}
          replyToMessage={replyToMessage}
          editingMessage={editingMessage}
          onCancelEdit={clearEdit}
          onCancelReply={clearReply}
        />
      ) : (
        <div className="chat-composer-blocked" role="status">
          {NOT_FRIENDS_MESSAGE}
        </div>
      )}
      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}