import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Terminal, Home, LogOut, Settings, Plus } from 'lucide-react';
import termIcon from '../../../assets/images/term.svg';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';

const FerretShellNavbar: React.FC = () => {
    const navigate = useNavigate();

    const navLinks = [
        { to: '/term/home', label: 'Início', icon: Home },
        { to: '/term/createConnectionForm', label: 'Nova Conexão', icon: Plus },
    ];

    return (
        <nav className="h-16 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
            <div className="flex items-center gap-8">
                <div 
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => navigate('/term/home')}
                >
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                        <img src={termIcon} alt="FerretShell" className="w-6 h-6 brightness-0 invert" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        FerretShell
                    </span>
                </div>

                <div className="hidden md:flex items-center gap-1">
                    {navLinks.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                        : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/5'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </NavLink>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="h-8 w-[1px] bg-gray-200 dark:bg-white/10 hidden sm:block" />
                
                <ToggleThemeButton />
                
                <button
                    onClick={() => navigate('/home')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all group"
                    title="Voltar ao Console"
                >
                    <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="hidden sm:inline">Voltar ao Console</span>
                </button>
            </div>
        </nav>
    );
};

export default FerretShellNavbar;
