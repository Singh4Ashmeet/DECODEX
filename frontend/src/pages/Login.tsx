import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import decodexLogo from '../assets/decodex-logo.jpg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = await apiFetch<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      login(data.user);
      const target = data.user.role === 'parent' ? '/parent/home' : data.user.role === 'teacher' ? '/teacher/dashboard' : '/dashboard';
      navigate(target);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-8 relative overflow-hidden text-on-surface">
      {/* Subtle dot pattern background */}
      <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#006474 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      
      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[440px] glass-card rounded-3xl p-8 sm:p-10 relative z-10 shadow-[0_20px_50px_rgba(0,100,116,0.10)] flex flex-col gap-6"
      >
        <div className="flex flex-col items-center justify-center text-center">
          <img alt="Decodex Logo" className="w-24 h-24 object-contain mb-3 drop-shadow-md" src={decodexLogo} />
          <h1 className="font-display text-2xl font-extrabold text-primary mb-1">Welcome Back to Decodex</h1>
          <p className="font-body text-sm text-on-surface-variant font-medium">Understand how every child reads</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="font-display text-[11px] font-bold tracking-[0.08em] uppercase text-on-surface-variant block" htmlFor="email">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span className="material-symbols-outlined text-outline text-xl">mail</span>
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-12 pr-4 glass-input rounded-xl font-body text-base text-on-surface placeholder-outline-variant focus:outline-none"
                placeholder="teacher@decodex.com"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-display text-[11px] font-bold tracking-[0.08em] uppercase text-on-surface-variant block" htmlFor="password">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span className="material-symbols-outlined text-outline text-xl">lock</span>
              </span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-12 pr-4 glass-input rounded-xl font-body text-base text-on-surface placeholder-outline-variant focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
            type="submit" 
            className="w-full h-[52px] mt-2 btn-clay flex items-center justify-center gap-2 text-base font-display font-bold uppercase tracking-wider cursor-pointer"
          >
            Log In
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </motion.button>
        </form>

        <div className="mt-1 text-center space-y-2">
          <p className="font-body text-sm text-on-surface-variant">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-bold hover:text-on-primary-fixed-variant underline decoration-2 underline-offset-4 transition-colors">
              Register
            </Link>
          </p>
          <p className="font-body text-xs text-on-surface-variant">
            <Link to="/terms" className="hover:text-primary underline">Terms of Service</Link>
            {' · '}
            <Link to="/privacy" className="hover:text-primary underline">Privacy Policy</Link>
          </p>
        </div>
      </motion.main>
    </div>
  );
}