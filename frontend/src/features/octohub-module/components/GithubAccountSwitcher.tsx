import React, { useRef, useState } from 'react';
import { useDismiss } from '../../shared/hooks/useDismiss';
import * as octohubDtos from '../../../../bindings/docker-manager-go/src/octohub/dtos/models';
import { Check, ChevronDown, Plus, Trash2, User } from 'lucide-react';

interface GithubAccountSwitcherProps {
    accounts: octohubDtos.GithubAccountDto[];
    onAdd: () => void;
    onSwitch: (accountId: number) => void;
    onRemove: (account: octohubDtos.GithubAccountDto) => void;
}

const Avatar: React.FC<{ account: octohubDtos.GithubAccountDto; size: string }> = ({ account, size }) =>
    account.avatarUrl ? (
        <img src={account.avatarUrl} alt={account.login} className={`${size} rounded-full object-cover`} />
    ) : (
        <div className={`${size} rounded-full bg-emerald-500/10 flex items-center justify-center`}>
            <User className="w-3 h-3" />
        </div>
    );

const GithubAccountSwitcher: React.FC<GithubAccountSwitcherProps> = ({ accounts, onAdd, onSwitch, onRemove }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeAccount = accounts.find((account) => account.isActive);

    useDismiss(containerRef, open, () => setOpen(false));

    return (
        <div ref={containerRef} className="relative">
            <button
                onClick={() => setOpen((previous) => !previous)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium hover:bg-emerald-500/20 transition-colors"
            >
                {activeAccount ? <Avatar account={activeAccount} size="w-6 h-6" /> : <User className="w-4 h-4" />}
                <span className="max-w-[140px] truncate">{activeAccount ? `@${activeAccount.login}` : 'Selecionar conta'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-30">
                    <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                        Contas do GitHub
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                onClick={() => {
                                    if (!account.isActive) onSwitch(account.id);
                                    setOpen(false);
                                }}
                                className="group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                            >
                                <Avatar account={account} size="w-8 h-8" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold truncate">{account.name || account.login}</div>
                                    <div className="text-xs text-gray-500 dark:text-zinc-400 truncate">@{account.login}</div>
                                </div>
                                {account.isActive && <Check className="w-4 h-4 text-emerald-500" />}
                                <button
                                    title="Remover conta"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setOpen(false);
                                        onRemove(account);
                                    }}
                                    className="p-1 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            setOpen(false);
                            onAdd();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar outra conta
                    </button>
                </div>
            )}
        </div>
    );
};

export default GithubAccountSwitcher;
