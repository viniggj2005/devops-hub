import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Terminal, Home, LogOut, Plus, SquareTerminal, X } from 'lucide-react';
import termIcon from '../../../assets/images/term.svg';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';
import { useTerminalStore } from '../terminal/TerminalStore';

const FerretShellNavbar: React.FC = () => {
    const navigate = useNavigate();
    const { tabs, activeTabId, setActiveTab, closeTab, setViewMode, viewMode } = useTerminalStore();

    const navLinks = [
        { to: '/term/home', label: 'Início', icon: Home }
    ];

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        setViewMode('terminal');
    };

    const handlePageClick = () => {
        setViewMode('page');
    };



    return (
        <nav className="h-16 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
            <div className="flex items-center gap-8 flex-1 min-w-0">
                <div
                    className="flex items-center gap-3 cursor-pointer group flex-shrink-0"
                    onClick={() => {
                        handlePageClick();
                        navigate('/term/home');
                    }}
                >
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                        <img src={termIcon} alt="FerretShell" className="w-6 h-6 brightness-0 invert" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent hidden sm:inline">
                        FerretShell
                    </span>
                </div>

                <div className="hidden lg:flex items-center gap-1 border-r border-white/5 pr-4 flex-shrink-0">
                    {navLinks.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={handlePageClick}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive && viewMode === 'page'
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


                <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('tabId', tab.id);
                            }}
                            onClick={() => handleTabClick(tab.id)}
                            className={`
                                group flex items-center gap-2 px-3 py-1.5 min-w-[100px] max-w-[180px] rounded-lg cursor-pointer transition-all flex-shrink-0
                                ${activeTabId === tab.id && viewMode === 'terminal'
                                    ? 'bg-zinc-800 text-white ring-1 ring-white/10 shadow-lg'
                                    : 'text-zinc-500 hover:bg-zinc-800/30 hover:text-zinc-300'}
                            `}
                        >
                            <SquareTerminal className={`w-3.5 h-3.5 ${activeTabId === tab.id && viewMode === 'terminal' ? 'text-purple-500' : ''}`} />
                            <span className="text-xs font-medium truncate flex-1">{tab.title}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-zinc-700 transition-opacity"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                <ToggleThemeButton />

                <button
                    onClick={() => navigate('/home')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all group"
                    title="Voltar ao Console"
                >
                    <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="hidden xl:inline">Voltar</span>
                </button>
            </div>
        </nav>
    );
};

export default FerretShellNavbar;
