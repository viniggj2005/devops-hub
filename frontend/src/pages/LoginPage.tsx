import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import appIcon from '../assets/images/hub.svg';
import LoginForm from '../features/login/LoginForm';
import CloudRestorePanel from '../features/login/CloudRestorePanel';
import { AuthWindowBar } from '../features/appFrame/WindowControls';
import { appModules } from '../features/shared/constants/AppModules';

const activeModules = appModules.filter((moduleItem) => moduleItem.status === 'Ativo');

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      onContextMenu={(event) => event.preventDefault()}
      className="h-screen w-full relative overflow-hidden bg-[#09090b] text-zinc-100 flex flex-col select-none"
    >
      <AuthWindowBar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl rounded-2xl bg-zinc-900/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 bg-zinc-950/60 border-r border-white/[0.06]">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <img src={appIcon} alt="DevOps Hub" className="w-6 h-6 brightness-0 invert" />
                </div>
                <div>
                  <span className="text-base font-bold tracking-tight text-white block leading-none">
                    DevOps Hub
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    DeployOps Console
                  </span>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-zinc-100 leading-snug mb-2">
                Toda a sua operação em um único workspace.
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Gerencie contêineres, terminais SSH, repositórios Git e bancos de dados sem alternar entre ferramentas.
              </p>

              <div className="space-y-2.5">
                {activeModules.map((moduleItem) => (
                  <div
                    key={moduleItem.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${moduleItem.color} flex items-center justify-center shrink-0`}>
                      <img src={moduleItem.icon} alt={moduleItem.title} className="w-4 h-4 brightness-0 invert" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">
                        {moduleItem.title}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {moduleItem.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Ambiente local seguro para suas credenciais</span>
            </div>
          </div>

          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
            <div className="flex lg:hidden items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <img src={appIcon} alt="DevOps Hub" className="w-5 h-5 brightness-0 invert" />
              </div>
              <span className="text-base font-bold tracking-tight text-white">
                DevOps Hub
              </span>
            </div>

            <div className="mb-6">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Bem-vindo de volta
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Informe suas credenciais para acessar seus ambientes.
              </p>
            </div>

            <LoginForm />

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                ou
              </span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <div className="text-center">
              <p className="text-xs text-zinc-400">
                Ainda não possui uma conta?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/create-account')}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors underline-offset-4 hover:underline cursor-pointer"
                >
                  Criar nova conta
                </button>
              </p>
            </div>

            <div className="mt-6">
              <CloudRestorePanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
