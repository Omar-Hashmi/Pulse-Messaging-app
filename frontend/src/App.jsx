import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';
import Profile from './pages/Profile.jsx';
import Archive from './pages/Archive.jsx';
import Hidden from './pages/Hidden.jsx';
import { useAuth } from './hooks/useAuth.js';
import NavBar from './components/NavBar.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;

  return (
    <div className="app-root">
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/chat" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/chat" />} />
          <Route path="/chat" element={user ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/archive" element={user ? <Archive /> : <Navigate to="/login" />} />
          <Route path="/hidden" element={user ? <Hidden /> : <Navigate to="/login" />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to={user ? '/chat' : '/login'} />} />
        </Routes>
      </main>
    </div>
  );
}
