import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regMsg, setRegMsg] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        router.push('/');
      } else {
        setError('Invalid credentials');
      }
    } catch {
      setError('Server error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMsg('');
    try {
      const res = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword })
      });
      if (res.ok) {
        setRegMsg('Registration successful! You can now log in.');
        setShowRegister(false);
        setEmail(regEmail);
        setPassword('');
      } else {
        const data = await res.json();
        setRegMsg(data.detail || 'Registration failed');
      }
    } catch {
      setRegMsg('Server error');
    }
  };

  return (
    <div className="login-container">
      <h2>{showRegister ? 'Register' : 'Login'}</h2>
      {showRegister ? (
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Name"
            value={regName}
            onChange={e => setRegName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={regEmail}
            onChange={e => setRegEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={regPassword}
            onChange={e => setRegPassword(e.target.value)}
            required
          />
          <button type="submit">Register</button>
          <button type="button" onClick={() => setShowRegister(false)} style={{ marginLeft: 8 }}>Back to Login</button>
          {regMsg && <p className={regMsg.startsWith('Registration successful') ? 'success' : 'error'}>{regMsg}</p>}
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Login</button>
          </form>
          <button onClick={() => setShowRegister(true)} style={{ marginTop: 12 }}>New user? Register</button>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  );
}
