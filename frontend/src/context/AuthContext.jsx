import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('gate_auth_token') || null);
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    async function checkAuth() {
      const savedToken = localStorage.getItem('gate_auth_token');
      if (!savedToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${savedToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
            setToken(savedToken);
          } else {
            localStorage.removeItem('gate_auth_token');
            setUser(null);
            setToken(null);
          }
        } else {
          localStorage.removeItem('gate_auth_token');
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn('Auth check error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (email = 'arenesha20@gmail.com', password = 'Arenesha@777') => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('gate_auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || 'Authentication failed' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('gate_auth_token');
      setToken(null);
      setUser(null);
    }
  };

  const authFetch = (url, options = {}) => {
    const currentToken = token || localStorage.getItem('gate_auth_token');
    const headers = {
      ...(options.headers || {}),
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
    };
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
