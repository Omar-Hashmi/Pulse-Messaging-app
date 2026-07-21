import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import api from '../api/axios.js';
import UserList from '../components/UserList.jsx';
import Snackbar from '../components/Snackbar.jsx';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [privacy, setPrivacy] = useState(user?.isPrivate ? 'private' : 'public');
  const [privacySaving, setPrivacySaving] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [newName, setNewName] = useState(user?.username || '');
  const [savingName, setSavingName] = useState(false);
  const [toast, setToast] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const navigate = useNavigate();
  const { socket } = useSocket();

  const loadBlockedUsers = async () => {
    try {
      setBlockedLoading(true);
      const { data } = await api.get('/users/me');
      setBlockedUsers(data.blockedUsers || []);
    } catch (err) {
      console.error('Unable to load blocked users', err);
    } finally {
      setBlockedLoading(false);
    }
  };

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    // Server pushes these when a block/unblock happens anywhere — this tab,
    // another tab, another device, or the Sidebar's "Block user" menu.
    const onUserBlocked = (payload) => {
      const blockedUser = payload?.blockedUser ?? payload?.user ?? payload;
      if (!blockedUser?._id) return;
      setBlockedUsers((prev) => (prev.some((u) => u._id === blockedUser._id) ? prev : [blockedUser, ...prev]));
    };

    const onUserUnblocked = (payload) => {
      const userId = payload?.userId ?? payload?.blockedUser?._id ?? payload?.user?._id ?? payload;
      if (!userId) return;
      setBlockedUsers((prev) => prev.filter((u) => u._id !== userId));
    };

    socket.on('user:blocked', onUserBlocked);
    socket.on('user:unblocked', onUserUnblocked);
    return () => {
      socket.off('user:blocked', onUserBlocked);
      socket.off('user:unblocked', onUserUnblocked);
    };
  }, [socket]);

  const closePasswordModal = () => {
    setPasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    if (savingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ type: 'error', message: 'Fill in all three password fields.' });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      await api.patch('/users/password', { currentPassword, newPassword });
      closePasswordModal();
      setToast({ type: 'success', message: 'Password updated successfully.' });
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.response?.data?.message || 'Unable to update password. Please try again.'
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleUnblock = async (userId) => {
    const previous = blockedUsers;
    setBlockedUsers((prev) => prev.filter((u) => u._id !== userId));
    try {
      await api.post('/users/unblock', { userId });
    } catch (err) {
      console.error('Unable to unblock user', err);
      setBlockedUsers(previous);
      setToast({ type: 'error', message: 'Unable to unblock user. Please try again.' });
    }
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    try {
      const { data } = await api.patch('/users', { username: trimmed });
      updateUser({ username: data.username });
      setEditNameOpen(false);
      setToast({ type: 'success', message: `Name updated to "${data.username}".` });
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.response?.data?.message || 'Unable to update name. Please try again.'
      });
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div>
          <p className="sidebar-pretitle">My account</p>
          <h1>{user?.username || 'Your profile'}</h1>
          <p className="profile-subtitle">
            Manage your account details, friends, and privacy settings in one place.
          </p>
        </div>
        <div className="profile-avatar">
          <span>{user?.username?.[0]?.toUpperCase() || 'U'}</span>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-card profile-details-card">
          <div className="profile-card-header">
            <div>
              <p className="sidebar-pretitle">Profile details</p>
              <h2>Account information</h2>
            </div>
            <div className="profile-actions">
              <button className="secondary-button" onClick={() => { setEditNameOpen(true); setNewName(user?.username || ''); }}>
                Edit name
              </button>
              <button className="secondary-button" onClick={() => setPasswordOpen(true)}>
                Change password
              </button>
              <button className="danger-button" onClick={() => setDeleteOpen(true)}>
                Delete account
              </button>
            </div>
          </div>

          <div className="profile-row">
            <strong>Username</strong>
            <span>{user?.username}</span>
          </div>
          <div className="profile-row">
            <strong>Email</strong>
            <span>{user?.email}</span>
          </div>
          <div className="profile-row">
            <strong>Friend Key</strong>
            <span>{user?.friendKey || 'Not available'}</span>
          </div>
          <div className="profile-row">
            <strong>Privacy</strong>
            <div className="privacy-toggle">
              <button
                type="button"
                className={"privacy-option " + (privacy === 'public' ? 'active' : '')}
                onClick={async () => {
                  if (privacySaving) return;
                  setPrivacySaving(true);
                  try {
                    const { data } = await api.patch('/users/privacy', { isPrivate: false });
                    updateUser({ isPrivate: data.isPrivate });
                    setPrivacy(data.isPrivate ? 'private' : 'public');
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setPrivacySaving(false);
                  }
                }}
                disabled={privacySaving}
              >
                Public
              </button>
              <button
                type="button"
                className={"privacy-option " + (privacy === 'private' ? 'active' : '')}
                onClick={async () => {
                  if (privacySaving) return;
                  setPrivacySaving(true);
                  try {
                    const { data } = await api.patch('/users/privacy', { isPrivate: true });
                    updateUser({ isPrivate: data.isPrivate });
                    setPrivacy(data.isPrivate ? 'private' : 'public');
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setPrivacySaving(false);
                  }
                }}
                disabled={privacySaving}
              >
                Private
              </button>
            </div>
          </div>
        </div>

        <div className="profile-card profile-friends-card">
          <div className="profile-card-header">
            <div>
              <p className="sidebar-pretitle">Friends</p>
              <h2>Friend network</h2>
            </div>
          </div>
          {/* 
            UPDATED: Explicitly passes an empty wrapper fallback to satisfy internal callback hooks safely.
            The inner modified UserList logic handles your backend creation and state redirections on click automatically!
          */}
          <UserList 
            showFriends={true} 
            showRequests={true} 
            showAddFriend={false} 
            onSelectUser={() => {}} 
          />
        </div>

        <div className="profile-card profile-blocked-card">
          <div className="profile-card-header">
            <div>
              <p className="sidebar-pretitle">Blocked</p>
              <h2>Blocked users</h2>
            </div>
          </div>
          {blockedLoading ? (
            <p>Loading blocked users...</p>
          ) : blockedUsers.length === 0 ? (
            <p className="empty-state">No blocked users</p>
          ) : (
            <div className="blocked-list-scrollbox">
              <ul className="blocked-list">
                {blockedUsers.map((blocked) => (
                  <li key={blocked._id} className="blocked-item">
                    <div className="blocked-avatar">
                      {blocked.avatar ? <img src={blocked.avatar} alt={blocked.username} /> : <span>{blocked.username?.[0]?.toUpperCase()}</span>}
                    </div>
                    <div>
                      <strong>{blocked.username}</strong>
                      <p>{blocked.email || 'Blocked user'}</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => handleUnblock(blocked._id)}>
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {editNameOpen && (
        <div className="privacy-modal" role="dialog">
          <div className="privacy-card">
            <h3>Edit name</h3>
            <p>Update your display name.</p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
            <div className="privacy-actions">
              <button type="button" onClick={() => setEditNameOpen(false)} disabled={savingName}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveName} disabled={savingName || !newName.trim()}>
                {savingName ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordOpen && (
        <div className="privacy-modal" role="dialog">
          <div className="privacy-card">
            <h3>Change password</h3>
            <p>Enter your current password and choose a new one.</p>
            <div style={{ marginTop: 8 }}>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
              />
            </div>
            <div className="privacy-actions">
              <button type="button" onClick={closePasswordModal} disabled={savingPassword}>
                Cancel
              </button>
              <button type="button" onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? 'Saving...' : 'Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="privacy-modal" role="dialog">
          <div className="privacy-card">
            <h3>Delete account</h3>
            <p>This will permanently delete your account and all data. This action cannot be undone.</p>
            <div className="privacy-actions">
              <button onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button
                className="danger-button"
                onClick={async () => {
                  try {
                    await api.delete('/users');
                    logout();
                    navigate('/login');
                  } catch (err) {
                    console.error(err);
                  }
                }}
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}