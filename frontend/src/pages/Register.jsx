import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(username, email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
          <h1>Create your private chat account.</h1>
          <p>Sign up quickly and keep the conversation flowing across devices.</p>
        </div>

        <div className="pulse-bubbles">
          <div className="pulse-bubble pulse-bubble--out">
            <time>8:22</time>
            Ready when you are.
          </div>
          <div className="pulse-bubble pulse-bubble--in">
            <time>8:23</time>
            Great — the new group chat looks awesome.
          </div>
        </div>

        <div className="pulse-wave">
          <span style={{ '--i': 1 }} />
          <span style={{ '--i': 2 }} />
          <span style={{ '--i': 3 }} />
+          <span style={{ '--i': 4 }} />
+          <span style={{ '--i': 5 }} />
        </div>
      </section>

      <section className="pulse-form-panel">
        <form className="pulse-form" onSubmit={handleSubmit}>
          <div className="pulse-form__header">
            <h2>Join the network</h2>
            <p>Create a secure account and start chatting.</p>
          </div>

          {error && <div className="pulse-error">{error}</div>}

          <div className="pulse-field">
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              placeholder="Your display name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="pulse-field">
            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="pulse-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="pulse-submit" type="submit">Register</button>

          <div className="pulse-form__footer">
            <p>
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
