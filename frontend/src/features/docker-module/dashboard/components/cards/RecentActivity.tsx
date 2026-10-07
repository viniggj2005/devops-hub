import React from 'react';
import { dockerDtos } from '../../../../../../wailsjs/go/models';

interface RecentActivityProps {
    info: dockerDtos.SystemInfoDto | null;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ info }) => {
    return (
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-white dark:bg-white/10 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/20 shadow-sm" />
            <div className="relative p-6">
                <h2 className="text-gray-900 dark:text-white mb-4 font-bold text-lg">Status do Sistema</h2>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                        <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50"></div>
                        <span className="text-sm text-gray-700 dark:text-white/90">Docker Daemon está <span className="font-mono text-green-600 dark:text-green-400 font-bold">ATIVO</span></span>
                    </div>
                    {info && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                            <div className="w-2 h-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"></div>
                            <span className="text-sm text-gray-700 dark:text-white/90">ID do Sistema: <span className="font-mono text-blue-600 dark:text-blue-300">{info.ID}</span></span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecentActivity;
