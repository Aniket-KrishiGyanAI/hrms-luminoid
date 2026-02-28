import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.accessToken
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    user: null,
    token: localStorage.getItem('token'),
    loading: true
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Fetch user data to restore session
      axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/auth/me`)
        .then(response => {
          dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.data.user, accessToken: token } });
          dispatch({ type: 'SET_LOADING', payload: false });
        })
        .catch(error => {
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          delete axios.defaults.headers.common['Authorization'];
          dispatch({ type: 'SET_LOADING', payload: false });
        });
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const login = async (email, password) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      console.log('API URL:', apiUrl);
      const response = await axios.post(`${apiUrl}/api/auth/login`, { email, password });
      const { user, accessToken, refreshToken } = response.data;
      
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, accessToken } });
      return { success: true };
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (payload) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiUrl}/api/auth/register`, payload);
      const { user, accessToken, refreshToken } = response.data;

      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, accessToken } });
      return { success: true };
    } catch (error) {
      console.error('Register error:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};