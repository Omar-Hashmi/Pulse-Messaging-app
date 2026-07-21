import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="pulse-auth">
      <section className="pulse-hero">
        <div className="pulse-hero__glow" />
        <div className="pulse-hero__brand">
          <span className="pulse-hero__dot" />
          <span className="pulse-hero__wordmark">Realtime Chat</span>
        </div>

        <div className="pulse-hero__copy">
          <h1>Secure conversations, built for speed and comfort.</h1>
          <p>Login to access your chats, stay connected with your team, and keep your messages private.</p>
        </div>

        <div className="pulse-bubbles">
          <div className="pulse-bubble pulse-bubble--in">
            <time>9:04</time>
            Hey, are you free to chat about the new design?
          </div>
          <div className="pulse-bubble pulse-bubble--out">
            <time>9:06</time>
            Yes, I’m online now — send it over.
          </div>
        </div>

        <div className="pulse-wave">
          <span style={{ '--i': 1 }} />
          <span style={{ '--i': 2 }} />
          <span style={{ '--i': 3 }} />
          <span style={{ '--i': 4 }} />
          <span style={{ '--i': 5 }} />
        </div>
      </section>

      <section className="pulse-form-panel">
        <form className="pulse-form" onSubmit={handleSubmit}>
          <div className="pulse-form__header">
            <h2>Welcome back</h2>
            <p>Sign in to continue where you left off.</p>
          </div>

          {error && <div className="pulse-error">{error}</div>}

          <div className="pulse-field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="pulse-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="pulse-submit" type="submit">Login</button>

          <div className="pulse-form__footer">
            <p>
              Don’t have an account? <Link to="/register">Create one</Link>
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
