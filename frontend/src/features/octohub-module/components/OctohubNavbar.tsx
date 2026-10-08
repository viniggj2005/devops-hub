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
            <div className="flex items-center gap-4 min-w-0">
                <button
                    onClick={() => navigate('/octohub/home')}
                    title="Início do OctoHub"
                    className="flex items-center gap-3 shrink-0 group"
                >
                    <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
                        <img src="/gitoctocat.svg" className="w-6 h-6 brightness-0 dark:invert" alt="OctoHub" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-emerald-700 bg-clip-text text-transparent hidden xl:inline">OctoHub</span>
                </button>

                <div className="flex items-center gap-1 border-r border-gray-200 dark:border-white/5 pr-4 shrink-0">
                    {navLinks.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            title={label}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/5'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden lg:inline">{label}</span>
                        </NavLink>
                    ))}
                </div>

                <RepositorySelector />
                <BranchSelector />
                <OpenInEditorButton />
            </div>

            <div className="flex items-center gap-3 shrink-0">
                {isLoggedIn ? (
                    accountSwitcher
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-500/10 text-gray-500 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        Desconectado
                    </div>
                )}
                <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                    <ToggleThemeButton />
                </div>
            </div>
        </nav>
    );
};

export default OctohubNavbar;
