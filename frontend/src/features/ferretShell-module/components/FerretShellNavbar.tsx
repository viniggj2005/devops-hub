import React from 'react';
import termIcon from '../../../assets/images/term.svg';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTerminalStore } from '../terminal/TerminalStore';
import { Home, SquareTerminal, X, FolderSync, GripVertical } from 'lucide-react';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';

const FerretShellNavbar: React.FC = () => {
    const navigate = useNavigate();
    const { tabs, activeTabId, setActiveTab, closeTab, setViewMode, viewMode, setDraggingTabId } = useTerminalStore();
    const isShowingTerminal = viewMode === 'terminal';

    const navLinks = [
        { to: '/term/home', label: 'Início', icon: Home },
        { to: '/term/sftp', label: 'SFTP', icon: FolderSync }
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
                    {tabs.map(tab => {
                        const isOnScreen = isShowingTerminal && activeTabId === tab.id;
                        const canDrag = isShowingTerminal && !isOnScreen;
                        const instanceCount = tab.instances.length;
                        return (
                            <div
                                key={tab.id}
                                draggable={canDrag}
                                title={canDrag ? 'Arraste até o terminal aberto para juntar na mesma tela' : tab.title}
                                onDragStart={(event) => {
                                    if (!canDrag) {
                                        event.preventDefault();
                                        return;
                                    }
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', tab.id);
                                    setDraggingTabId(tab.id);
                                }}
                                onDragEnd={() => setDraggingTabId(null)}
                                onClick={() => handleTabClick(tab.id)}
                                className={`
                                    group flex items-center gap-2 px-3 py-1.5 min-w-[100px] max-w-[200px] rounded-lg transition-all flex-shrink-0
                                    ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                                    ${isOnScreen
                                        ? 'bg-zinc-800 text-white ring-1 ring-white/10 shadow-lg'
                                        : 'text-zinc-500 hover:bg-zinc-800/30 hover:text-zinc-300'}
                                `}
                            >
                                {canDrag
                                    ? <GripVertical className="w-3.5 h-3.5 -ml-1 opacity-40 group-hover:opacity-100" />
                                    : <SquareTerminal className={`w-3.5 h-3.5 ${isOnScreen ? 'text-purple-500' : ''}`} />}
                                <span className="text-xs font-medium truncate flex-1">{tab.title}</span>
                                {instanceCount > 1 && (
                                    <span title={`${instanceCount} terminais nesta tela`} className="rounded bg-purple-500/20 px-1.5 text-[10px] font-bold text-purple-300">
                                        {instanceCount}
                                    </span>
                                )}
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        const isLastTab = tabs.length === 1;
                                        closeTab(tab.id);
                                        if (isLastTab) {
                                            setViewMode('page');
                                            navigate('/term/home');
                                        }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-zinc-700 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                <ToggleThemeButton />
            </div>
        </nav>
    );
};

export default FerretShellNavbar;
