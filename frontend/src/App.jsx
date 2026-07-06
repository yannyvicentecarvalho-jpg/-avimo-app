import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      // Verify token is still valid
      axios.get(`${API_URL}/ranking/user`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {
        setToken(null);
        localStorage.removeItem('token');
      });
    }
  }, [token]);

  const handleLogin = (loginToken, userData) => {
    setToken(loginToken);
    setUser(userData);
    localStorage.setItem('token', loginToken);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <div className="App">
      {!token ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard token={token} user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
