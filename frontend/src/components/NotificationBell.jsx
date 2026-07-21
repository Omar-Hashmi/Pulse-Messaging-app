import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../hooks/useSocket.js';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

const NOTIF_ICON = {
  message: '💬',
  friend_request: '🤝',
  friend_accept: '✅',
  mention: '📣',
  system: 'ℹ️'
};

// Matches the key Chat.jsx keeps in sync with whichever conversation is
// currently open, so we can tell whether an incoming notification is for
// the conversation the user is already looking at.
const ACTIVE_CONVERSATION_KEY = 'activeConversationId';

const getConversationId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id ? value._id.toString() : value.toString?.() ?? null;
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [snack, setSnack] = useState(null);
  const { socket } = useSocket();
  const nav = useNavigate();
  const ref = useRef();

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch (err) {
      console.error('Unable to load notifications', err);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const onNotification = (n) => {
      const activeConversationId = sessionStorage.getItem(ACTIVE_CONVERSATION_KEY);
      const isForOpenConversation =
        n.type === 'message' &&
        activeConversationId &&
        getConversationId(n.relatedConversation) === activeConversationId;

      if (isForOpenConversation) {
        // Fully suppress this one -- no popup, no entry in the dropdown, no
        // badge bump. Still tell the server it's read so it doesn't come
        // back as "unread" the next time notifications are loaded.
        api.patch(`/notifications/${n._id}/read`).catch(() => {});
        return;
      }

      setNotifications((prev) => [n, ...prev]);
      setSnack(n);
      setTimeout(() => setSnack(null), 3500);
    };
    socket?.on('notification:new', onNotification);
    return () => socket?.off('notification:new', onNotification);
  }, [socket]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const openAndClearSnack = () => {
    setOpen((v) => !v);
    setSnack(null);
  };

  const markRead = async (notification, e) => {
    e?.stopPropagation();
    if (notification.isRead) return;
    try {
      await api.patch(`/notifications/${notification._id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error('Unable to mark notification as read', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Unable to mark all as read', err);
    }
  };

  const deleteNotification = async (notification, e) => {
    e?.stopPropagation();
    try {
      await api.delete(`/notifications/${notification._id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== notification._id));
    } catch (err) {
      console.error('Unable to delete notification', err);
    }
  };

  const clearRead = async () => {
    try {
      await api.delete('/notifications/read');
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch (err) {
      console.error('Unable to clear read notifications', err);
    }
  };

  const describe = (n) => {
    const name = n.fromUser?.username || 'Someone';
    switch (n.type) {
      case 'message':
        return `${name} sent you a message`;
      case 'friend_request':
        return `${name} sent a friend request`;
      case 'friend_accept':
        return `${name} accepted your friend request`;
      default:
        return n.content || 'New activity';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const goToNotification = async (notification) => {
    setOpen(false);
    if (!notification.isRead) markRead(notification);

    if (notification.type === 'message' && notification.relatedConversation) {
      nav('/chat', { state: { conversationId: notification.relatedConversation } });
    } else if (notification.type === 'friend_request' || notification.type === 'friend_accept') {
      nav('/chat', { state: { focusRequests: true } });
    } else {
      nav('/chat');
    }
  };

  return (
    <div className="notification-bell" ref={ref}>
      <button 
        className={`bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`} 
        onClick={openAndClearSnack} 
        aria-expanded={open} 
        aria-label="Notifications"
      >
        <span className="bell-icon-emoji">🔔</span>
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notifications-dropdown">
          <div className="notif-header">
            <div className="notif-header-title">
              <strong>Notifications</strong>
              {unreadCount > 0 && <span className="notif-count-pill">{unreadCount} new</span>}
            </div>
            <div className="notif-header-actions">
              <button 
                type="button" 
                onClick={markAllRead} 
                disabled={unreadCount === 0}
                className="notif-action-link"
              >
                Mark all read
              </button>
              <span className="divider-dot" aria-hidden="true">•</span>
              <button 
                type="button" 
                onClick={clearRead}
                className="notif-action-link"
              >
                Clear read
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-icon">🔔</div>
              <p>All caught up!</p>
              <span>When you get notifications, they will appear here.</span>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  className={`notif-item ${n.isRead ? 'read' : 'unread'}`}
                  onClick={() => goToNotification(n)}
                >
                  <div className="notif-item-left">
                    <div className={`notif-avatar-wrapper type-${n.type}`}>
                      {NOTIF_ICON[n.type] || '🔔'}
                    </div>
                  </div>

                  <div className="notif-body">
                    <div className="notif-text">{describe(n)}</div>
                    <div className="notif-time">{formatTime(n.createdAt)}</div>
                  </div>

                  <div className="notif-item-actions">
                    {!n.isRead && (
                      <button 
                        type="button" 
                        title="Mark as read" 
                        className="notif-btn-check"
                        onClick={(e) => markRead(n, e)}
                      >
                        ✓
                      </button>
                    )}
                    <button 
                      type="button" 
                      title="Delete notification" 
                      className="notif-btn-delete" 
                      onClick={(e) => deleteNotification(n, e)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {snack && (
        <div className="snackbar" role="status" onClick={() => goToNotification(snack)}>
          <span className="snackbar-emoji">{NOTIF_ICON[snack.type] || '🔔'}</span>
          <div className="snackbar-content">
            <strong>{snack.fromUser?.username || 'Someone'}</strong> {describe(snack)}
          </div>
        </div>
      )}
    </div>
  );
}