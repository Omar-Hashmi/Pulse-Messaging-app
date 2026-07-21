import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket.js';
import api from '../api/axios.js';
import FileUpload from './FileUpload.jsx';

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function MessageInput({ conversationId, onSend, replyToMessage, editingMessage, onCancelEdit, onCancelReply }) {
  const [text, setText] = useState(editingMessage?.text || '');
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { socket } = useSocket();
  const typingTimeout = useRef(null);

  useEffect(() => {
    if (editingMessage) setText(editingMessage.text || '');
  }, [editingMessage]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    if (pendingFile.type?.startsWith('image/')) {
      const url = URL.createObjectURL(pendingFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [pendingFile]);

  const handleChange = (e) => {
    setText(e.target.value);
    socket?.emit('typing:start', { conversationId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket?.emit('typing:stop', { conversationId });
    }, 1500);
  };

  const handleFileSelected = (file) => {
    setPendingFile(file);
  };

  const clearPendingFile = () => setPendingFile(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText && !pendingFile) return;

    const replyTo = replyToMessage?._id;

    if (pendingFile) {
      try {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', pendingFile);
        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        onSend(trimmedText, [data], replyTo);
      } catch (err) {
        console.error('File upload failed', err);
        return;
      } finally {
        setUploading(false);
      }
    } else {
      onSend(trimmedText, [], replyTo);
    }

    setText('');
    setPendingFile(null);
    socket?.emit('typing:stop', { conversationId });
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      {(replyToMessage || editingMessage || pendingFile) && (
        <div className="message-context">
          {replyToMessage && (
            <div className="reply-context">
              Replying to {replyToMessage.sender.username}: {replyToMessage.text || 'Attachment'}
              <button type="button" onClick={onCancelReply}>Cancel</button>
            </div>
          )}
          {editingMessage && (
            <div className="edit-context">
              Editing message
              <button type="button" onClick={onCancelEdit}>Cancel</button>
            </div>
          )}
          {pendingFile && (
            <div className="file-pending-preview">
              {previewUrl ? (
                <img src={previewUrl} alt={pendingFile.name} className="file-pending-thumb" />
              ) : (
                <span className="file-pending-icon">📎</span>
              )}
              <div className="file-pending-info">
                <strong>{pendingFile.name}</strong>
                <span>{formatFileSize(pendingFile.size)}</span>
              </div>
              <button type="button" onClick={clearPendingFile} aria-label="Remove attachment">✕</button>
            </div>
          )}
        </div>
      )}
      <div className="message-input-row">
        <FileUpload onFileSelected={handleFileSelected} />
        <input
          value={text}
          onChange={handleChange}
          placeholder={pendingFile ? 'Add a caption (optional)...' : 'Type a message...'}
        />
        <button type="submit" disabled={uploading}>{uploading ? 'Sending...' : 'Send'}</button>
      </div>
    </form>
  );
}
