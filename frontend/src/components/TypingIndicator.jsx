export default function TypingIndicator({ typingUsers }) {
  if (!typingUsers.length) return null;
  return <div className="typing-indicator">Someone is typing...</div>;
}
