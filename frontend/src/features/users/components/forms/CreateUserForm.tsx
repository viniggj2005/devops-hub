import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { createUserApi } from '../../services/UserService';
import { CreateUserPayload } from '../../../../interfaces/UsersInterface';
import { AlertCircle, ArrowRight, Check, Eye, EyeClosed, Loader2, Lock, Mail, User } from 'lucide-react';

interface PasswordStrengthState {
  strength: number;
  hasLength: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  hasUpperCase: boolean;
}

const CreateUserForm: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthState | null>(null);

  const getPasswordStrength = (): PasswordStrengthState | null => {
    if (!password) return null;
    const hasNumber = /\d/.test(password);
    const hasLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasSpecial = /[^A-Za-z0-9\s]/.test(password);

    const strength = [hasLength, hasNumber, hasSpecial, hasUpperCase].filter(Boolean).length;
    return { hasLength, hasNumber, hasSpecial, hasUpperCase, strength };
  };

  useEffect(() => {
    setPasswordStrength(getPasswordStrength());
  }, [password]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!fullName.trim() || !email.trim() || !password) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas informadas não conferem.');
      return;
    }

    const strength = getPasswordStrength();
    setPasswordStrength(strength);

    if (!strength || strength.strength < 4) {
      toast.error('A senha deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, números e caracteres especiais.');
      return;
    }

    const payload: CreateUserPayload = {
      password,
      email: email.trim(),
      name: fullName.trim(),
    };

    try {
      setLoading(true);
      await createUserApi(payload);
      toast.success('Conta criada com sucesso!');
      navigate('/login');
    } catch (createError: any) {
      toast.error(createError.message || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  const passwordsMismatch = Boolean(confirmPassword && password !== confirmPassword);
  const passwordsMatch = Boolean(confirmPassword && password && password === confirmPassword);

  const requirements = passwordStrength
    ? [
        { label: '8+ caracteres', met: passwordStrength.hasLength },
        { label: 'Letra maiúscula', met: passwordStrength.hasUpperCase },
        { label: 'Número', met: passwordStrength.hasNumber },
        { label: 'Caractere especial', met: passwordStrength.hasSpecial },
      ]
    : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="space-y-1.5">
        <label htmlFor="register-name" className="block text-xs font-medium text-zinc-300">
          Nome completo
        </label>
        <div className="relative group">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            placeholder="Seu nome"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/70 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="register-email" className="block text-xs font-medium text-zinc-300">
          E-mail
        </label>
        <div className="relative group">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/70 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="register-password" className="block text-xs font-medium text-zinc-300">
            Senha
          </label>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-zinc-950/70 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="register-confirm-password" className="block text-xs font-medium text-zinc-300">
            Confirmar senha
          </label>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
            <input
              id="register-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={`w-full pl-10 pr-9 py-2.5 bg-zinc-950/70 border rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-all ${
                passwordsMismatch
                  ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                  : passwordsMatch
                    ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
                    : 'border-white/10 focus:border-blue-500/80 focus:ring-blue-500/20'
              }`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {passwordsMismatch && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>As senhas informadas não coincidem.</span>
        </div>
      )}

      {passwordStrength && (
        <div className="rounded-xl bg-zinc-950/60 border border-white/[0.06] p-3 space-y-2.5">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  level <= passwordStrength.strength
                    ? passwordStrength.strength <= 2
                      ? 'bg-red-500'
                      : passwordStrength.strength === 3
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {requirements.map((requirement) => (
              <div
                key={requirement.label}
                className={`flex items-center gap-1.5 transition-colors ${
                  requirement.met ? 'text-emerald-400' : 'text-zinc-500'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                    requirement.met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span>{requirement.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer group"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Criando conta...</span>
          </>
        ) : (
          <>
            <span>Criar conta</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
    </form>
  );
};

export default CreateUserForm;
