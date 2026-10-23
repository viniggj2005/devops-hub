import toast from 'react-hot-toast';
import termIcon from '../../../assets/images/term.svg';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useDismiss } from '../../shared/hooks/useDismiss';
import { useTerminalStore } from '../terminal/TerminalStore';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalShells } from '../terminal/functions/useLocalShells';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';
import { TerminalServices, toSshConn } from '../terminal/services/TerminalServices';
import { LocalShell, LocalShellKind, SshDto } from '../../../interfaces/TerminalInterfaces';
import {
    X,
    Box,
    Home,
    Plus,
    Laptop,
    Search,
    Monitor,
    Terminal,
    GitBranch,
    FolderSync,
    ChevronDown,
    GripVertical,
    SquareTerminal,
} from 'lucide-react';

const navLinks = [
    { to: '/term/home', label: 'Início', icon: Home },
    { to: '/term/sftp', label: 'SFTP', icon: FolderSync },
];

const shellIcons: Record<LocalShellKind, React.ElementType> = {
    wsl: Box,
    cmd: Terminal,
    unix: Laptop,
    gitbash: GitBranch,
    powershell: SquareTerminal,
};

const FerretShellNavbar: React.FC = () => {
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const { shells, openShell } = useLocalShells();
    const [menuFilter, setMenuFilter] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [sshList, setSshList] = useState<SshDto[]>([]);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const {
        tabs,
        closeTab,
        viewMode,
        createTab,
        activeTabId,
        setViewMode,
        setActiveTab,
        setDraggingTabId,
    } = useTerminalStore();
    const isShowingTerminal = viewMode === 'terminal';

    const closeMenu = () => {
        setMenuOpen(false);
        setMenuFilter('');
    };

    useDismiss([triggerRef, menuRef], menuOpen, closeMenu);

    useEffect(() => {
        if (!menuOpen || !token) return;
        TerminalServices.findAllByUser(user ? user.id : 1, token)
            .then((list) => setSshList(list ?? []))
            .catch(() => setSshList([]));
    }, [menuOpen, token, user]);

    const toggleMenu = () => {
        if (menuOpen) {
            closeMenu();
            return;
        }
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) {
            const maxLeft = Math.max(12, window.innerWidth - 300);
            setMenuPos({ top: rect.bottom + 8, left: Math.min(rect.left, maxLeft) });
        }
        setMenuOpen(true);
    };

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        setViewMode('terminal');
    };

    const handlePageClick = () => {
        setViewMode('page');
    };

    const handleSelectShell = (shell: LocalShell) => {
        closeMenu();
        openShell(shell);
    };

    const handleSelectSsh = async (connectionItem: SshDto) => {
        closeMenu();
        if (!token) return;
        try {
            const connection = await TerminalServices.getById(token, connectionItem.id);
            const ssh = toSshConn(connection);
            const hasKey = !!(
                connection.key &&
                (Array.isArray(connection.key)
                    ? connection.key.length
                    : connection.key.toString().length)
            );
            const hasPassword = !!connection.password;
            if (hasKey || hasPassword) {
                createTab({ title: connection.alias || `${ssh.User}@${ssh.Host}`, config: ssh });
            } else {
                toast.error('Nenhum método de autenticação encontrado para esta conexão.');
            }
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const normalizedQuery = menuFilter.trim().toLowerCase();

    const filteredShells = useMemo(
        () =>
            shells.filter(
                (shell) =>
                    !normalizedQuery || shell.name.toLowerCase().includes(normalizedQuery)
            ),
        [shells, normalizedQuery]
    );

    const filteredSsh = useMemo(
        () =>
            sshList.filter(
                (connection) =>
                    !normalizedQuery ||
                    (connection.alias ?? '').toLowerCase().includes(normalizedQuery) ||
                    connection.host.toLowerCase().includes(normalizedQuery) ||
                    connection.systemUser.toLowerCase().includes(normalizedQuery)
            ),
        [sshList, normalizedQuery]
    );

    return (
        <nav className="h-16 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                    className="flex items-center gap-3 cursor-pointer group flex-shrink-0 mr-1"
                    onClick={() => {
                        handlePageClick();
                        navigate('/term/home');
                    }}
                >
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                        <img src={termIcon} alt="FerretShell" className="w-6 h-6 brightness-0 invert" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-500 to-purple-700 bg-clip-text text-transparent hidden sm:inline">
                        FerretShell
                    </span>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/5 flex-shrink-0">
                    {navLinks.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={handlePageClick}
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isActive && viewMode === 'page'
                                        ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                }`
                            }
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">{label}</span>
                        </NavLink>
                    ))}
                </div>

                {tabs.length > 0 && (
                    <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1 flex-shrink-0" />
                )}

                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => {
                        const isOnScreen = isShowingTerminal && activeTabId === tab.id;
                        const canDrag = isShowingTerminal && !isOnScreen;
                        const instanceCount = tab.instances.length;
                        return (
                            <div
                                key={tab.id}
                                draggable={canDrag}
                                onDragEnd={() => setDraggingTabId(null)}
                                onClick={() => handleTabClick(tab.id)}
                                title={
                                    canDrag
                                        ? 'Arraste até o terminal aberto para juntar na mesma tela'
                                        : tab.title
                                }
                                onDragStart={(event) => {
                                    if (!canDrag) {
                                        event.preventDefault();
                                        return;
                                    }
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', tab.id);
                                    setDraggingTabId(tab.id);
                                }}
                                className={`
                                    group flex items-center gap-2 px-3 py-1.5 min-w-[100px] max-w-[200px] rounded-xl transition-all flex-shrink-0
                                    ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                                    ${
                                        isOnScreen
                                            ? 'bg-purple-500/10 dark:bg-zinc-800 text-purple-700 dark:text-white ring-1 ring-purple-500/30 dark:ring-white/10 shadow-sm'
                                            : 'text-gray-500 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800/40 hover:text-gray-800 dark:hover:text-zinc-300'
                                    }
                                `}
                            >
                                {canDrag ? (
                                    <GripVertical className="w-3.5 h-3.5 -ml-1 opacity-40 group-hover:opacity-100" />
                                ) : (
                                    <SquareTerminal
                                        className={`w-3.5 h-3.5 shrink-0 ${
                                            isOnScreen ? 'text-purple-500' : ''
                                        }`}
                                    />
                                )}
                                <span className="text-xs font-semibold truncate flex-1">
                                    {tab.title}
                                </span>
                                {instanceCount > 1 && (
                                    <span
                                        title={`${instanceCount} terminais nesta tela`}
                                        className="rounded-full bg-purple-500/20 px-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-300"
                                    >
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
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}

                    {tabs.length > 0 && (
                        <button
                            ref={triggerRef}
                            onClick={toggleMenu}
                            title="Abrir novo terminal ou servidor SSH"
                            className={`h-8 px-2 rounded-xl flex items-center gap-1 shrink-0 transition-colors ${
                                menuOpen
                                    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                                    : 'text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10'
                            }`}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                    menuOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </button>
                    )}
                </div>
            </div>

            {menuOpen && (
                <div
                    ref={menuRef}
                    style={{ top: menuPos.top, left: menuPos.left }}
                    className="fixed w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150"
                >
                    <div className="p-2.5 border-b border-gray-100 dark:border-white/5">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                autoFocus
                                type="text"
                                value={menuFilter}
                                placeholder="Filtrar terminal ou servidor..."
                                onChange={(event) => setMenuFilter(event.target.value)}
                                className="w-full h-8 pl-8 pr-7 rounded-lg text-xs outline-none border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-800 dark:text-zinc-200 focus:border-purple-500"
                            />
                            {menuFilter && (
                                <button
                                    onClick={() => setMenuFilter('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-1.5 space-y-2">
                        {filteredShells.length > 0 && (
                            <div>
                                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                                    Terminal local
                                </div>
                                {filteredShells.map((shell) => {
                                    const ShellIcon = shellIcons[shell.kind] ?? SquareTerminal;
                                    return (
                                        <button
                                            key={shell.id}
                                            onClick={() => handleSelectShell(shell)}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                                                <ShellIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate flex-1">
                                                {shell.name}
                                            </span>
                                            {shell.isDefault && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                                                    Padrão
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {filteredSsh.length > 0 && (
                            <div>
                                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                                    Meus Servidores
                                </div>
                                {filteredSsh.map((connection) => {
                                    const label =
                                        connection.alias ||
                                        `${connection.systemUser}@${connection.host}`;
                                    const address = `${connection.systemUser}@${connection.host}:${connection.port || 22}`;
                                    return (
                                        <button
                                            key={connection.id}
                                            onClick={() => handleSelectSsh(connection)}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                                <Monitor className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate">
                                                    {label}
                                                </div>
                                                <div className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 truncate">
                                                    {address}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {filteredShells.length === 0 && filteredSsh.length === 0 && (
                            <p className="py-4 text-center text-xs text-gray-400 italic">
                                Nenhum terminal ou servidor encontrado.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 flex-shrink-0 pl-2">
                <ToggleThemeButton />
            </div>
        </nav>
    );
};

export default FerretShellNavbar;
