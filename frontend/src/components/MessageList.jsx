import { useEffect, useRef, useState } from 'react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const idsEqual = (id, target) => {
  if (!id) return false;
  if (typeof id === 'string') return id === target;
  return id._id ? id._id === target : id.toString() === target;
};

// Calendar-day key (ignores time) so two messages compare equal only if they
// fall on the same local day -- the boundary naturally resets at midnight.
const dayKey = (dateString) => new Date(dateString).toDateString();

const formatDayLabel = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const msgDay = startOfDay(date).getTime();
  const today = startOfDay(now).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;

  if (msgDay === today) return 'Today';
  if (msgDay === yesterday) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric'
  });
};

const formatMessageTime = (dateString) =>
  new Date(dateString).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function MessageList({ messages, currentUserId, onReply, onEdit, onDelete, onReact }) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [activeReactionId, setActiveReactionId] = useState(null);
  const menuRef = useRef();
  const reactionRef = useRef();
  const bottomRef = useRef();
  // Tracks whether the *next* scroll is the initial load of a conversation's
  // history (should snap instantly) vs. a genuinely new message arriving
  // while already viewing the chat (should animate smoothly).
  const isInitialLoadRef = useRef(true);
  // Tracks the previous message count so we only auto-scroll when a message
  // was actually appended -- not on every in-place update (delivered/read
  // receipts, reactions, edits, the optimistic-message-swapped-for-real-one
  // update after sending), which would otherwise re-trigger a scroll and
  // look like the screen "flashing" every time you send a message.
  const prevLengthRef = useRef(0);
  // Snapshot of which message is the "first unread" boundary, captured once
  // when a conversation's history first loads -- NOT recalculated live off
  // readBy. ChatWindow marks rendered messages as read almost immediately
  // after they appear, so a live calculation would make the divider vanish
  // before it's ever visible. Freezing it here keeps it in place for as long
  // as this conversation stays open, the way most chat apps do it.
  const frozenUnreadIdRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
      if (reactionRef.current && !reactionRef.current.contains(event.target)) {
        setActiveReactionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ChatWindow clears messages to [] the moment you open/switch to a
  // conversation, before the history has loaded. Treat that as a signal that
  // the *next* non-empty update is a fresh history load, not a new message.
  useEffect(() => {
    if (messages.length === 0) {
      isInitialLoadRef.current = true;
      frozenUnreadIdRef.current = null;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!bottomRef.current) return;

    const prevLength = prevLengthRef.current;
    const currentLength = messages.length;
    prevLengthRef.current = currentLength;

    if (currentLength === 0) return;

    // Skip entirely if this update didn't actually add a message -- e.g. a
    // delivered/read receipt landing, a reaction, an edit, or the optimistic
    // temp message being swapped for the real one from the server.
    const messageWasAppended = currentLength > prevLength;
    if (!messageWasAppended) return;

    if (isInitialLoadRef.current) {
      // Freeze which message is the first unread one right now, before the
      // auto-mark-as-read effect in ChatWindow marks everything as read.
      // This snapshot -- not a live readBy check -- is what the divider
      // renders from, so it stays visible for the rest of this conversation
      // view instead of disappearing within the same tick it appears.
      const firstUnread = messages.find(
        (msg) =>
          !idsEqual(msg.sender._id, currentUserId) &&
          !msg.readBy?.some((id) => idsEqual(id, currentUserId))
      );
      frozenUnreadIdRef.current = firstUnread ? firstUnread._id : null;

      // Initial load (mount, reload, or switching conversations): snap
      // straight to the bottom with no animation.
      bottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      isInitialLoadRef.current = false;
    } else {
      // A new message actually arrived/was sent while already viewing this
      // conversation: animate the short scroll smoothly.
      requestAnimationFrame(() => {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
  }, [messages]);

  // "Read" for the sender's own message should only appear once someone
  // OTHER than the sender has read it -- not simply because readBy is non-empty.
  const isReadByOthers = (msg) =>
    msg.readBy?.some((id) => !idsEqual(id, msg.sender._id));

  const isDeliveredToOthers = (msg) =>
    msg.deliveredTo?.some((id) => !idsEqual(id, msg.sender._id));

  const getStatusLabel = (msg) => {
    if (msg.status === 'sending') return 'Sending...';
    if (msg.status === 'failed') return 'Failed to send';
    if (isReadByOthers(msg)) return 'Read';
    if (isDeliveredToOthers(msg)) return 'Delivered';
    return 'Sent';
  };

  const groupReactions = (reactions = []) => {
    const groups = {};
    reactions.forEach((r) => {
      const key = r.emoji;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r.user);
    });
    return groups;
  };

  return (
    <div className="message-list">
      {messages.map((msg, index) => {
        const isOwn = msg.sender._id === currentUserId;
        const showUnreadDivider = msg._id === frozenUnreadIdRef.current;
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const showDateDivider = !prevMsg || dayKey(prevMsg.createdAt) !== dayKey(msg.createdAt);
        const reactionGroups = groupReactions(msg.reactions);
        const myReaction = msg.reactions?.find((r) => idsEqual(r.user, currentUserId))?.emoji;

        return (
          <div key={msg._id}>
            {showDateDivider && (
              <div className="date-divider">{formatDayLabel(msg.createdAt)}</div>
            )}
            {showUnreadDivider && (
              <div className="unread-divider">Unread messages</div>
            )}
            <div className={`${isOwn ? 'msg own' : 'msg'}`}>
              <div className="message-header">
                <div className="message-meta">
                  <span className="sender-row">
                    <span className="sender">{msg.sender.username}</span>
                    <span className="message-time">{formatMessageTime(msg.createdAt)}</span>
                  </span>
                  {msg.editedAt && <span className="edited-tag">Edited</span>}
                </div>
                {!msg.isDeleted && (
                  <div className="message-header-actions">
                    <div className="reaction-menu" ref={activeReactionId === msg._id ? reactionRef : null}>
                      <button
                        type="button"
                        className="menu-trigger react-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReactionId((current) => (current === msg._id ? null : msg._id));
                        }}
                        aria-label="React to message"
                      >
                        🙂
                      </button>
                      {activeReactionId === msg._id && (
                        <div className="emoji-picker">
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`emoji-option ${myReaction === emoji ? 'selected' : ''}`}
                              onClick={() => {
                                onReact?.(msg._id, emoji);
                                setActiveReactionId(null);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="message-menu" ref={activeMenuId === msg._id ? menuRef : null}>
                      <button
                        type="button"
                        className="menu-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId((current) => (current === msg._id ? null : msg._id));
                        }}
                        aria-label="Message options"
                      >
                        ⋮
                      </button>
                      {activeMenuId === msg._id && (
                        <div className="message-dropdown">
                          <button type="button" onClick={() => { onReply?.(msg); setActiveMenuId(null); }}>
                            Reply
                          </button>
                          {isOwn && (
                            <>
                              <button type="button" onClick={() => { onEdit?.(msg); setActiveMenuId(null); }}>
                                Edit
                              </button>
                              <button type="button" onClick={() => { onDelete?.(msg._id); setActiveMenuId(null); }} className="danger">
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {msg.replyTo && (
                <div className="reply-preview">
                  <strong>{msg.replyTo.sender?.username ?? 'Unknown'}</strong>
                  <p>{msg.replyTo.text || 'Attachment'}</p>
                </div>
              )}
              {msg.isDeleted ? (
                <p className="deleted-message">This message was deleted</p>
              ) : (
                <>
                  {msg.text && <p>{msg.text}</p>}
                  {msg.attachments?.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="attachment-link">
                      📎 {a.fileName}
                    </a>
                  ))}
                </>
              )}
              {Object.keys(reactionGroups).length > 0 && (
                <div className="reaction-bar">
                  {Object.entries(reactionGroups).map(([emoji, users]) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`reaction-pill ${users.some((u) => idsEqual(u, currentUserId)) ? 'mine' : ''}`}
                      onClick={() => onReact?.(msg._id, emoji)}
                      title={`${users.length} reaction${users.length > 1 ? 's' : ''}`}
                    >
                      {emoji} {users.length}
                    </button>
                  ))}
                </div>
              )}
              {isOwn && !msg.isDeleted && (
                <span className={`read-receipt ${msg.status === 'failed' ? 'failed' : ''} ${msg.status === 'sending' ? 'pending' : ''}`}>
                  {getStatusLabel(msg)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}