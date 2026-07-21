import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { usePersistentIdSet } from '../hooks/usePersistentIdSet.js';
import UserList from './UserList.jsx';
import ConfirmSnackbar from './ConfirmSnackbar.jsx';

function ConversationMenuPortal({ anchorRect, onClose, children }) {
  if (!anchorRect) return null;

  const menuWidth = 200;
  const spacing = 8;
  const fitsRight = anchorRect.right + spacing + menuWidth <= window.innerWidth;

  const style = {
    position: 'fixed',
    top: Math.min(anchorRect.top, window.innerHeight - 240),
    left: fitsRight ? anchorRect.right + spacing : Math.max(8, anchorRect.left - menuWidth - spacing),
    minWidth: menuWidth
  };

  return createPortal(
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div 
        className="conversation-dropdown conversation-dropdown-portal" 
        style={style} 
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

// Memoized individual item to prevent unnecessary list re-renders
const ConversationItem = React.memo(({ 
  conversation, 
  isActive, 
  isUnread, 
  currentUserId, 
  onSelect, 
  renderMenu 
}) => {
  const otherNames = conversation.participants
    ?.filter((p) => p._id !== currentUserId)
    .map((p) => p.username)
    .join(', ') || 'New Chat';

  return (
    <li
      className={`conversation-item ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
      onClick={() => onSelect(conversation)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(conversation);
        }
      }}
    >
      <div className="conversation-item-content">
        <span className="conversation-item-title">
          {isUnread && (
            <span
              className="unread-dot"
              role="status"
              aria-label="Unread conversation"
              title="Unread"
            />
          )}
          <strong>{otherNames}</strong>
        </span>
        <span>{conversation.lastMessage?.text ?? 'No messages yet'}</span>
      </div>
      <div className="conversation-item-actions">
        {renderMenu(conversation)}
      </div>
    </li>
  );
});

ConversationItem.displayName = 'ConversationItem';

export default function Sidebar({
  conversations,
  setConversations,
  activeConversation,
  onSelectConversation,
  focusRequests,
  onFocusRequestsHandled
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [archived, setArchived] = usePersistentIdSet('archivedConversations');
  const [hidden, setHidden] = usePersistentIdSet('hiddenConversations');
  const [unread, setUnread] = usePersistentIdSet('unreadConversations');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const { user } = useAuth();
  const { socket } = useSocket();
  const activeConversationIdRef = useRef(activeConversation?._id ?? null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversation?._id ?? null;
  }, [activeConversation]);

  const requestConfirm = (message, confirmLabel, onConfirm) => {
    setConfirmState({ message, confirmLabel, onConfirm });
  };

  const closeConfirm = () => setConfirmState(null);

  useEffect(() => {
    if (!socket) return undefined;

    const onConversationUpdated = ({ conversationId, lastMessage }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c._id === conversationId);
        if (index === -1) return prev;
        const updated = { ...prev[index], lastMessage };
        const rest = prev.filter((c) => c._id !== conversationId);
        return [updated, ...rest];
      });

      const senderId = lastMessage?.sender?._id ?? lastMessage?.sender ?? lastMessage?.senderId ?? null;
      const isOwnMessage = Boolean(senderId) && Boolean(user?._id) && senderId === user._id;
      const isCurrentlyOpen = activeConversationIdRef.current === conversationId;

      // A new message on a conversation that isn't open right now, and that
      // wasn't sent by me, should show up as unread — without needing a refresh.
      if (!isOwnMessage && !isCurrentlyOpen) {
        setUnread((prev) => (prev.includes(conversationId) ? prev : [...prev, conversationId]));
      }
    };

    socket.on('conversation:updated', onConversationUpdated);
    return () => socket.off('conversation:updated', onConversationUpdated);
  }, [socket, setConversations, setUnread, user?._id]);

  const handleSelectConversation = (conversation) => {
    if (conversation?._id) {
      setUnread((prev) => (prev.includes(conversation._id) ? prev.filter((id) => id !== conversation._id) : prev));
    }
    onSelectConversation(conversation);
  };

  const startConversation = async (friend) => {
    const friendId = typeof friend === 'object' ? friend._id : friend;
    try {
      const { data } = await api.post('/conversations', { participantId: friendId });

      const structuredConversation = {
        ...data,
        participants: data.participants && data.participants[0]?._id
          ? data.participants
          : [
              { _id: user._id, username: user.username },
              { _id: friendId, username: friend.username || 'New Friend' }
            ]
      };

      setConversations((prev) => {
        const exists = prev.find((c) => c._id === data._id);
        if (exists) return prev;
        return [structuredConversation, ...prev];
      });

      onSelectConversation(structuredConversation);
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  const visibleConversations = conversations.filter((c) => !hidden.includes(c._id));
  const archivedConversations = visibleConversations.filter((c) => archived.includes(c._id));
  const activeConversations = visibleConversations.filter((c) => !archived.includes(c._id));

  const filteredActiveConversations = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return activeConversations.filter((c) => {
      if (!c.participants || c.participants.length === 0) return true;
      const otherNames = c.participants
        ?.filter((p) => p._id !== user?._id)
        .map((p) => p.username?.toLowerCase() || '')
        .join(', ') || 'you';

      return otherNames.includes(query);
    });
  }, [activeConversations, searchQuery, user?._id]);

  const handleDelete = async (conversationId) => {
    try {
      await api.delete(`/conversations/${conversationId}`);
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      if (activeConversation?._id === conversationId) onSelectConversation(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActiveMenuId(null);
    }
  };

  const handleArchive = (conversationId) => {
    setArchived((prev) => [...new Set([...prev, conversationId])]);
    setActiveMenuId(null);
  };

  const handleRestore = (conversationId) => {
    setArchived((prev) => prev.filter((id) => id !== conversationId));
    setActiveMenuId(null);
  };

  const handleHide = (conversationId) => {
    setHidden((prev) => [...new Set([...prev, conversationId])]);
    if (activeConversation?._id === conversationId) onSelectConversation(null);
    setActiveMenuId(null);
  };

  const handleMarkUnread = (conversationId) => {
    setUnread((prev) =>
      prev.includes(conversationId) ? prev.filter((id) => id !== conversationId) : [...prev, conversationId]
    );
    setActiveMenuId(null);
  };

  const handleBlock = async (conversation) => {
    const otherParticipant = conversation.participants?.find((p) => p._id !== user?._id);
    if (!otherParticipant) return;
    try {
      await api.post('/users/block', { userId: otherParticipant._id });
      setConversations((prev) => prev.filter((c) => c._id !== conversation._id));
      if (activeConversation?._id === conversation._id) onSelectConversation(null);
    } catch (err) {
      console.error('Unable to block user', err);
    } finally {
      setActiveMenuId(null);
    }
  };

  const openMenu = (e, conversationId) => {
    e.stopPropagation();
    if (activeMenuId === conversationId) {
      setActiveMenuId(null);
      setMenuAnchorRect(null);
      return;
    }
    setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
    setActiveMenuId(conversationId);
  };

  const closeMenu = () => {
    setActiveMenuId(null);
    setMenuAnchorRect(null);
  };

  const renderMenu = (conversation) => {
    const isArchived = archived.includes(conversation._id);
    const isUnread = unread.includes(conversation._id);
    const isOpen = activeMenuId === conversation._id;
    return (
      <div className="conversation-menu">
        <button
          type="button"
          className="conversation-dot-btn"
          onClick={(e) => openMenu(e, conversation._id)}
          aria-label="Conversation options"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          ⋮
        </button>

        {isOpen && (
          <ConversationMenuPortal anchorRect={menuAnchorRect} onClose={closeMenu}>
            {!isArchived && (
              <button type="button" role="menuitem" onClick={() => handleArchive(conversation._id)}>
                Archive chat
              </button>
            )}
            {isArchived ? (
              <button type="button" role="menuitem" onClick={() => handleRestore(conversation._id)}>
                Restore chat
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={() => handleHide(conversation._id)}>
                Hide chat
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => handleMarkUnread(conversation._id)}>
              {isUnread ? 'Mark as read' : 'Mark as unread'}
            </button>
            <button
              type="button"
              className="danger"
              role="menuitem"
              onClick={() => {
                closeMenu();
                requestConfirm(
                  `Block ${conversation.participants?.find((p) => p._id !== user?._id)?.username || 'this user'}? They won't be able to message you, and you'll stop being friends.`,
                  'Block',
                  () => handleBlock(conversation)
                );
              }}
            >
              Block user
            </button>
            <button
              type="button"
              className="danger"
              role="menuitem"
              onClick={() => {
                closeMenu();
                requestConfirm(
                  'Delete this conversation? This cannot be undone.',
                  'Delete',
                  () => handleDelete(conversation._id)
                );
              }}
            >
              Delete conversation
            </button>
          </ConversationMenuPortal>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar" role="complementary">
      <style>{`
        .conversation-item-title {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .unread-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          min-width: 8px;
          border-radius: 50%;
          background-color: #3b82f6;
        }
        .conversation-item.unread .conversation-item-content strong {
          font-weight: 700;
        }
      `}</style>
      {/* Header Card / Profile section */}
      <div className="sidebar-panel sidebar-header-card">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            {user?.username?.substring(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="sidebar-profile-details">
            <p className="sidebar-pretitle">Welcome back,</p>
            <h3 className="sidebar-username">{user?.username || 'User'}</h3>
          </div>
        </div>
      </div>

      {/* Navigation section */}
      <nav className="sidebar-panel" role="navigation" aria-label="Chat filters">
        <Link to="/archive" className="archive-nav-button">
          <div className="archive-nav-content">
            <strong>Archived chats</strong>
            <span className="archive-nav-badge">{archivedConversations.length} archived</span>
          </div>
        </Link>
      </nav>

      {/* Active Chats Section */}
      <div className="sidebar-panel recent-chats-box">
        <div className="sidebar-panel-header">
          <h4 className="sidebar-panel-title">Recent conversations</h4>
        </div>

        <div className="sidebar-search-container" role="search">
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search active chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search active conversations"
          />
        </div>

        <div className="sidebar-conversations-scrollbox">
          {filteredActiveConversations.length > 0 ? (
            <ul className="conversation-list" role="list">
              {filteredActiveConversations.map((conversation) => (
                <ConversationItem
                  key={conversation._id}
                  conversation={conversation}
                  isActive={activeConversation?._id === conversation._id}
                  isUnread={unread.includes(conversation._id)}
                  currentUserId={user?._id}
                  onSelect={handleSelectConversation}
                  renderMenu={renderMenu}
                />
              ))}
            </ul>
          ) : (
            <div className="sidebar-empty-state">
              No active chats found
            </div>
          )}
        </div>
      </div>

      {/* Friends Panel */}
      <div className="sidebar-panel sidebar-userlist-panel">
        <UserList
          showFriends={false}
          showRequests={true}
          showAddFriend={true}
          onSelectUser={startConversation}
          setConversations={setConversations}
          focusRequests={focusRequests}
          onFocusRequestsHandled={onFocusRequestsHandled}
        />
      </div>
      <ConfirmSnackbar
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={() => {
          confirmState?.onConfirm?.();
          closeConfirm();
        }}
        onCancel={closeConfirm}
      />
    </aside>
  );
}