import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeClosed, Loader2, Lock, Mail } from 'lucide-react';

const LoginForm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    try {
      await login(email.trim(), password);
      const goTo = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/home';
      navigate(goTo, { replace: true });
    } catch {
      return;
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-xs font-medium text-zinc-300">
          E-mail
        </label>
        <div className="relative group">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/70 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="login-password" className="block text-xs font-medium text-zinc-300">
          Senha
        </label>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-zinc-950/70 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            {showPassword ? (
              <EyeClosed className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer group"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Entrando...</span>
          </>
        ) : (
          <>
            <span>Entrar na plataforma</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
    </form>
  );
};

export default LoginForm;
