import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { usePersistentIdSet } from '../hooks/usePersistentIdSet.js';
import Sidebar from '../components/Sidebar.jsx';

export default function Hidden() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [hidden, setHidden] = usePersistentIdSet('hiddenConversations');
  const [selectedIds, setSelectedIds] = useState([]);
  const navigate = useNavigate();
  const { socket } = useSocket();

  // Fetch conversations on mount
  useEffect(() => {
    api.get('/conversations')
      .then((res) => setConversations(res.data))
      .catch(() => {});
  }, []);

  // Keep lastMessage in sync in realtime, same as Sidebar
  useEffect(() => {
    if (!socket) return undefined;

    const onConversationUpdated = ({ conversationId, lastMessage }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c._id === conversationId);
        if (index === -1) return prev;
        const updated = { ...prev[index], lastMessage };
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    };

    socket.on('conversation:updated', onConversationUpdated);
    return () => socket.off('conversation:updated', onConversationUpdated);
  }, [socket]);

  const hiddenConversations = user
    ? conversations.filter((c) => hidden.includes(c._id))
    : [];

  const allSelected = hiddenConversations.length > 0 && selectedIds.length === hiddenConversations.length;

  const toggleSelect = (conversationId) => {
    setSelectedIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : hiddenConversations.map((c) => c._id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleUnhideSelected = () => {
    setHidden((prev) => prev.filter((id) => !selectedIds.includes(id)));
    setConversations((prev) => prev.filter((c) => !selectedIds.includes(c._id)));
    setSelectedIds([]);
  };

  // FIX: Pass the complete conversation data payload via incomingConversation
  const openConversation = (conversationObject) => {
    navigate('/chat', { state: { incomingConversation: conversationObject } });
  };

  return (
    <div className="chat-layout">
      <Sidebar 
        conversations={conversations}
        setConversations={setConversations}
        activeConversation={null} 
        onSelectConversation={openConversation} 
      />
      <div className="archive-page">
        <div className="archive-header">
          <div>
            <p className="sidebar-pretitle">Hidden</p>
            <h2>Hidden Chats</h2>
            <p className="archive-info">Unhide chats here or use the action menu to remove them from hidden.</p>
          </div>
          {selectedIds.length > 0 && (
            <div className="archive-actions">
              <button type="button" className="secondary-button" onClick={handleClearSelection}>
                Clear selection
              </button>
              <button type="button" className="primary-button" onClick={handleUnhideSelected}>
                Restore selected ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
        {hiddenConversations.length === 0 ? (
          <div className="empty-state">No hidden chats</div>
        ) : (
          <div className="archive-list">
            <div className="archive-list-header">
              <label className="archive-select-all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                Select all
              </label>
              <span>
                {hiddenConversations.length} hidden chat{hiddenConversations.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul>
              {hiddenConversations.map((conversation) => {
                const otherParticipant = conversation.participants?.find((p) => p._id !== user._id);
                if (!otherParticipant) return null;
                const otherNames = conversation.participants
                  ?.filter((p) => p._id !== user._id)
                  .map((p) => p.username)
                  .join(', ');
                return (
                  <li key={conversation._id} className="archive-item">
                    <label className="archive-item-select">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(conversation._id)}
                        onChange={() => toggleSelect(conversation._id)}
                      />
                    </label>
                    <button
                      type="button"
                      className="archive-item-body"
                      onClick={() => openConversation(conversation)}
                    >
                      <div>
                        <strong>{otherNames}</strong>
                        <p>{conversation.lastMessage?.text ?? 'No messages yet'}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}