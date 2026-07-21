import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useNavigate } from 'react-router-dom';

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleOpen = () => setOpen((prev) => !prev);

  const goProfile = () => {
    setOpen(false);
    navigate('/profile');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const avatarContent = user?.avatar ? (
    <img src={user.avatar} alt={`${user.username}'s avatar`} className="profile-avatar-img" />
  ) : (
    <div className="profile-avatar-fallback">{user?.username?.charAt(0).toUpperCase()}</div>
  );

  return (
    <div className="profile-menu" ref={ref}>
      <button 
        className="profile-toggle" 
        onClick={toggleOpen} 
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Toggle profile menu"
      >
        {avatarContent}
      </button>

      {open && (
        <div className="profile-dropdown" role="menu">
          <div className="profile-info">
            <strong className="profile-username">{user?.username}</strong>
            <div className="profile-email">{user?.email}</div>
          </div>
          
          
          
          <button className="profile-item" onClick={goProfile} role="menuitem">
            Profile
          </button>
          
          <button
            className="profile-item logout-small"
            role="menuitem"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}