import React from 'react';
import { dockerDtos } from '../../../../../../wailsjs/go/models';
import { Activity, Image, MemoryStick, Cpu } from 'lucide-react';

interface StatsGridProps {
    info: dockerDtos.SystemInfoDto | null;
}

const StatsGrid: React.FC<StatsGridProps> = ({ info }) => {
    const stats = [
        { label: 'Containers Ativos', value: info?.ContainersRunning ?? '0', icon: Activity, color: 'from-green-400 to-emerald-600' },
        { label: 'Imagens', value: info?.Images ?? '0', icon: Image, color: 'from-blue-400 to-blue-600' },
        { label: 'CPUs', value: info?.NCPU ?? '0', icon: Cpu, color: 'from-orange-400 to-orange-600' },
        { label: 'Memória (GB)', value: info?.MemTotal ? (info.MemTotal / (1024 * 1024 * 1024)).toFixed(2) : '0', icon: MemoryStick, color: 'from-purple-400 to-purple-600' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                    <div key={stat.label} className="relative group">
                        <div className="absolute inset-0 bg-white dark:bg-white/10 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/20 shadow-sm transition-all" />
                        <div className="relative p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <p className="text-gray-600 dark:text-white/70 text-sm mb-1">{stat.label}</p>
                            <p className="text-gray-900 dark:text-white text-3xl font-bold">{stat.value}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default StatsGrid;
