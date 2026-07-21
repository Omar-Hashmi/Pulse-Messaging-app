import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useSocket } from '../hooks/useSocket.js';
import ConfirmSnackbar from './ConfirmSnackbar.jsx';

export default function UserList({
  onSelectUser,
  setConversations,
  showFriends = true,
  showRequests = true,
  showAddFriend = true,
  focusRequests = false,
  onFocusRequestsHandled
}) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState(null);
  const [highlightRequests, setHighlightRequests] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();
  const requestsRef = useRef(null);

  const requestConfirm = (message, confirmLabel, onConfirm) => {
    setConfirmState({ message, confirmLabel, onConfirm });
  };

  const closeConfirm = () => setConfirmState(null);

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/users');
      setFriends(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRequests = async () => {
    try {
      const { data } = await api.get('/users/me/requests');
      setRequests(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  useEffect(() => {
    if (focusRequests && requestsRef.current) {
      requestsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightRequests(true);
      loadRequests();
      const timeout = setTimeout(() => setHighlightRequests(false), 2200);
      onFocusRequestsHandled?.();
      return () => clearTimeout(timeout);
    }
  }, [focusRequests]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) return;
    try {
      const { data } = await api.post('/users/request', { identifier: trimmed });
      setStatus({ type: 'success', text: data.message });
      setIdentifier('');

      if (data.accepted) {
        loadFriends();

        const targetFriendId = data.friend?._id || data.friendId || data.userId;

        if (targetFriendId) {
          const convRes = await api.post('/conversations', { participantId: targetFriendId });

          if (setConversations && convRes.data) {
            setConversations((prev) => {
              if (prev.find((c) => c._id === convRes.data._id)) return prev;
              return [convRes.data, ...prev];
            });
          }
        }
      }
    } catch (err) {
      setStatus({
        type: 'error',
        text: err?.response?.data?.message || 'Unable to send request'
      });
    }
  };

  const handleAccept = async (requesterId) => {
    try {
      await api.post('/users/request/accept', { requesterId });
      const convRes = await api.post('/conversations', { participantId: requesterId });

      setStatus({ type: 'success', text: 'Friend request accepted! Chat initialized.' });
      loadFriends();
      loadRequests();

      if (setConversations && convRes.data) {
        setConversations((prev) => {
          if (prev.find((c) => c._id === convRes.data._id)) return prev;
          return [convRes.data, ...prev];
        });
      }
    } catch (err) {
      setStatus({
        type: 'error',
        text: err?.response?.data?.message || 'Unable to accept request'
      });
    }
  };

  const handleReject = async (requesterId) => {
    try {
      await api.post('/users/request/reject', { requesterId });
      setRequests((prev) => prev.filter((r) => r._id !== requesterId));
    } catch (err) {
      setStatus({
        type: 'error',
        text: err?.response?.data?.message || 'Unable to reject request'
      });
    }
  };

  const handleRemove = async (friendId) => {
    try {
      await api.post('/users/remove', { friendId });
      setFriends((prev) => prev.filter((friend) => friend._id !== friendId));
    } catch (err) {
      setStatus({
        type: 'error',
        text: err?.response?.data?.message || 'Unable to remove friend'
      });
    }
  };

  const handleBlock = async (friendId) => {
    try {
      await api.post('/users/block', { userId: friendId });
      setFriends((prev) => prev.filter((friend) => friend._id !== friendId));
      setStatus({ type: 'success', text: 'User blocked' });
    } catch (err) {
      setStatus({
        type: 'error',
        text: err?.response?.data?.message || 'Unable to block user'
      });
    }
  };

  const handleChatTransition = async (friendObject) => {
    try {
      const response = await api.post('/conversations', { participantId: friendObject._id });
      const conversationData = response.data;
      navigate('/chat', { state: { incomingConversation: conversationData } });
    } catch (err) {
      console.error("Failed to transition into chat room view:", err);
    }
  };

  const title = showFriends ? 'Friends' : 'Add Friend';
  return (
    <div className="user-list">
      <h4>{title}</h4>
      {showAddFriend && (
        <form className="friend-form" onSubmit={handleSubmit}>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Username or friend key"
            aria-label="Friend identifier"
          />
          <button type="submit">Add Friend</button>
        </form>
      )}
      {status && <div className={`friend-status ${status.type}`}>{status.text}</div>}

      {showFriends && (
        <div className="friend-section">
          <h5>Your friends</h5>

          <div className="friend-list-scrollbox">
            <ul>
              {friends.length === 0 ? (
                <li className="empty-item">
                  No friends yet. Add someone above.
                </li>
              ) : (
                friends.map((u) => (
                  <li
                    key={u._id}
                    className="friend-item"
                    onClick={() => handleChatTransition(u)}
                  >
                    <div className="friend-item-info">
                      <span className={onlineUsers.includes(u._id) ? 'dot online' : 'dot offline'} />
                      <span>{u.username}</span>
                    </div>

                    <div className="friend-item-actions">
                      <button
                        className="friend-chat"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChatTransition(u);
                        }}
                      >
                        Chat
                      </button>
                      <button
                        className="friend-remove"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestConfirm(
                            `Remove ${u.username} from your friends?`,
                            'Remove',
                            () => handleRemove(u._id)
                          );
                        }}
                      >
                        Remove
                      </button>
                      <button
                        className="friend-block"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestConfirm(
                            `Block ${u.username}? They won't be able to message you, and you'll stop being friends.`,
                            'Block',
                            () => handleBlock(u._id)
                          );
                        }}
                      >
                        Block
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {showRequests && (
        <div className={`friend-section requests-section ${highlightRequests ? 'highlight' : ''}`} ref={requestsRef}>
          <h5>Incoming requests</h5>

          <div className="requests-list-scrollbox">
            <ul>
              {requests.length === 0 ? (
                <li className="empty-item">
                  No pending requests
                </li>
              ) : (
                requests.map((u) => (
                  <li key={u._id} className="request-item">
                    <div className="friend-item-info">
                      <span className={onlineUsers.includes(u._id) ? 'dot online' : 'dot offline'} />
                      {u.username}
                    </div>
                    <div className="friend-item-actions">
                      <button type="button" onClick={() => handleAccept(u._id)}>
                        Accept
                      </button>
                      <button type="button" className="friend-remove" onClick={() => handleReject(u._id)}>
                        Reject
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
      <ConfirmSnackbar
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={() => {
          confirmState?.onConfirm?.();
          closeConfirm();
        }}
        onCancel={closeConfirm}
      />
    </div>
  );
}