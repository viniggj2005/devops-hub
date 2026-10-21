import React from 'react';
import BranchSelector from './BranchSelector';
import RepositorySelector from './RepositorySelector';
import OpenInEditorButton from './OpenInEditorButton';
import { NavLink, useNavigate } from 'react-router-dom';
import { GitCommitHorizontal, House } from 'lucide-react';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';

interface OctohubNavbarProps {
    isLoggedIn: boolean | null;
    accountSwitcher?: React.ReactNode;
}

const navLinks = [
    { to: '/octohub/home', label: 'Início', icon: House },
    { to: '/octohub/history', label: 'Alterações', icon: GitCommitHorizontal },
];

const OctohubNavbar: React.FC<OctohubNavbarProps> = ({ isLoggedIn, accountSwitcher }) => {
    const navigate = useNavigate();

    return (
        <nav className="h-16 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    title="Início do OctoHub"
                    onClick={() => navigate('/octohub/home')}
                    className="flex items-center gap-3 shrink-0 group mr-1"
                >
                    <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
                        <img
                            alt="OctoHub"
                            src="/gitoctocat.svg"
                            className="w-6 h-6 brightness-0 dark:invert"
                        />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-emerald-700 bg-clip-text text-transparent hidden xl:inline">
                        OctoHub
                    </span>
                </button>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100/80 dark:bg-white/5 border border-zinc-200/70 dark:border-white/5 shrink-0">
                    {navLinks.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            title={label}
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isActive
                                        ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                }`
                            }
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">{label}</span>
                        </NavLink>
                    ))}
                </div>

                <div className="h-6 w-px bg-zinc-200 dark:bg-white/10 mx-1 shrink-0" />

                <div className="flex items-center gap-2 min-w-0">
                    <RepositorySelector />
                    <BranchSelector />
                    <OpenInEditorButton />
                </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                {isLoggedIn ? (
                    accountSwitcher
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-500/10 text-gray-500 rounded-full text-xs font-bold">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        Desconectado
                    </div>
                )}
                <ToggleThemeButton />
            </div>
        </nav>
    );
};

export default OctohubNavbar;
