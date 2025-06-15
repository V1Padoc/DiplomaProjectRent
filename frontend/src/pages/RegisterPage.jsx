// frontend/src/pages/RegisterPage.jsx

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom'; // Added Link

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [role, setRole] = useState('tenant');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        email,
        password,
        name,
        last_name: lastName,
        phone_number: phoneNumber, 
        role
      });
      setSuccess(response.data.message || "Обліковий запис успішно створено!"); // Translated success message
      setTimeout(() => {
        navigate('/login');
      }, 2000); 
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.response?.data?.message || 'Реєстрація не вдалася. Будь ласка, спробуйте ще раз.'); // Translated error message
    }
  };

  return (
    <div className="relative flex size-full min-h-screen flex-col items-center justify-center bg-slate-50 p-4 sm:p-6" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
      <div className="w-full max-w-lg bg-white p-6 sm:p-8 rounded-xl shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center text-[#0c151d] tracking-tight">
          Створити обліковий запис
        </h1>

        {success && (
          <div className="mb-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md" role="alert">
            <p className="font-bold">Успіх</p>
            <p>{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <p className="font-bold">Помилка</p>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="name">
                Ім'я
              </label>
              <input
                className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d] placeholder:text-[#7b98b4]" 
                id="name" type="text" placeholder="Іван" value={name} // Translated placeholder
                onChange={(e) => setName(e.target.value)} required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="last_name">
                Прізвище
              </label>
              <input
                className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d] placeholder:text-[#7b98b4]" 
                id="last_name" type="text" placeholder="Коваленко" value={lastName} // Translated placeholder
                onChange={(e) => setLastName(e.target.value)} required 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="email">
              Адреса електронної пошти
            </label>
            <input
              className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d] placeholder:text-[#7b98b4]" 
              id="email" type="email" placeholder="ви@example.com" value={email} // Placeholder kept similar, but context implies Ukrainian
              onChange={(e) => setEmail(e.target.value)} required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="password">
              Пароль
            </label>
            <input
              className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d] placeholder:text-[#7b98b4]" 
              id="password" type="password" placeholder="Створіть надійний пароль" value={password} // Translated placeholder
              onChange={(e) => setPassword(e.target.value)} required minLength="6"
            />
          </div>
          
          <div> 
            <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="phone_number">
                Номер телефону
            </label>
            <input
                className="form-input w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d] placeholder:text-[#7b98b4]"
                id="phone_number" type="tel" placeholder="+380-50-123-4567" value={phoneNumber} // Translated placeholder to Ukrainian format
                onChange={(e) => setPhoneNumber(e.target.value)} required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4574a1] mb-1" htmlFor="role">
              Зареєструватися як:
            </label>
            <select
              className="form-select w-full rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 p-3 text-sm text-[#0c151d]" 
              id="role" value={role} onChange={(e) => setRole(e.target.value)} required 
            >
              <option value="tenant">Орендар / Покупець</option>
              <option value="owner">Власник / Продавець</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              className="w-full bg-[#359dff] hover:bg-blue-700 text-white text-sm sm:text-base font-bold py-3 px-4 rounded-lg h-12 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" 
              type="submit"
            >
              Зареєструватися
            </button>
          </div>
          <div className="text-center pt-2">
            <Link className="font-medium text-sm text-blue-600 hover:text-blue-700 transition-colors" to="/login">
              Вже маєте обліковий запис? Увійти
            </Link>
          </div>
        </form>
      </div>
       <style jsx global>{`
        .form-input, .form-select { @apply shadow-sm; }
        .tracking-tight { letter-spacing: -0.025em; }
      `}</style>
    </div>
  );
}

export default RegisterPage;