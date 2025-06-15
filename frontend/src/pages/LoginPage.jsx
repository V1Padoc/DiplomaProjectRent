// frontend/src/pages/LoginPage.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../api/api.js';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Success state is not typically used on login as it redirects

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
      if (isAuthenticated) {
          navigate('/'); 
      }
  }, [isAuthenticated, navigate]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });
      const token = response.data.token;
      login(token); 
      // Navigation is handled by useEffect or can be explicitly done here if preferred
      // navigate('/'); 
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Вхід не вдався. Будь ласка, перевірте свої облікові дані.');
    }
  };

   if (isAuthenticated) {
       return null; 
   }

  return (
    <div className="relative flex size-full min-h-screen flex-col items-center justify-center bg-slate-50 p-4 sm:p-6" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-xl shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center text-[#0c151d] tracking-tight">
          Увійдіть до свого облікового запису
        </h1>

        {error && (
          <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <p className="font-bold">Помилка</p>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="email">
              Адреса електронної пошти
            </label>
            <input
              className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d] placeholder:text-[#7b98b4]"
              id="email"
              type="email"
              placeholder="ви@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="password">
              Пароль
            </label>
            <input
              className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d] placeholder:text-[#7b98b4]"
              id="password"
              type="password"
              placeholder="Введіть ваш пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="pt-2">
            <button
              className="w-full bg-[#359dff] hover:bg-blue-700 text-white text-sm sm:text-base font-bold py-3 px-4 rounded-lg h-12 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              type="submit"
            >
              Увійти
            </button>
          </div>
           <div className="text-center pt-2">
            <Link className="font-medium text-sm text-blue-600 hover:text-blue-700 transition-colors" to="/register">
              Не маєте облікового запису? Зареєструватися
            </Link>
          </div>
        </form>
      </div>
      <style jsx global>{`
        .form-input { @apply shadow-sm; }
        .tracking-tight { letter-spacing: -0.025em; }
      `}</style>
    </div>
  );
}

export default LoginPage;