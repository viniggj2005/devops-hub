import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box, HardDrive, Image, Network } from 'lucide-react';

const ManagementCards: React.FC = () => {
  const navigate = useNavigate();

  const shortcuts = [
    {
      icon: Box,
      title: 'Containers',
      to: '/docker/containers',
      accent: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      description: 'Inicie, pare, inspecione logs, abra terminal interativo e acompanhe métricas em tempo real.',
    },
    {
      icon: Image,
      title: 'Imagens',
      to: '/docker/images',
      accent: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      description: 'Pesquise imagens, construa novas tags via Dockerfile e remova camadas sem uso.',
    },
    {
      icon: HardDrive,
      title: 'Volumes',
      to: '/docker/volumes',
      accent: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      description: 'Gerencie volumes persistentes, pontos de montagem, drivers e opções de armazenamento.',
    },
    {
      icon: Network,
      title: 'Redes',
      to: '/docker/networks',
      accent: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      description: 'Configure redes bridge, overlay ou host e inspecione sub-redes e gateways.',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {shortcuts.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.to}
            onClick={() => navigate(item.to)}
            className="group rounded-2xl bg-white dark:bg-zinc-900/60 border border-gray-200 dark:border-white/[0.07] hover:border-blue-500/40 dark:hover:border-blue-500/40 p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/5"
          >
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.accent}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Gerenciar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ManagementCards;
