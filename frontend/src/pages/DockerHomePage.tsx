import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';
import { dtos } from '../../wailsjs/go/models';
import React, { useEffect, useState } from 'react';
import { useDockerClient } from '../contexts/DockerClientContext';
import StatsGrid from '../features/docker-module/dashboard/components/cards/StatsGrid';
import { GetInfo } from '../../wailsjs/go/handlers/DockerSdkHandlerStruct';
import RecentActivity from '../features/docker-module/dashboard/components/cards/RecentActivity';
import ManagementCards from '../features/docker-module/dashboard/components/cards/ManagementCards';
import ConnectServerCard from '../features/docker-module/dashboard/components/cards/ConnectServerCard';

const HomePage: React.FC = () => {
  const { selectedCredentialId, dockerClientId } = useDockerClient();
  const [info, setInfo] = useState<dtos.SystemInfoDto | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!dockerClientId || dockerClientId !== selectedCredentialId) return;

      try {
        const data = await GetInfo(dockerClientId);
        setInfo(data);
      } catch (error) {
        console.error("Failed to fetch info:", error);
        iziToast.error({
          title: 'Erro',
          message: `Falha ao buscar informações do sistema: ${error}`,
          position: 'topRight'
        });
      }
    };
    fetchInfo();
  }, [dockerClientId, selectedCredentialId]);

  return (
    <div className="max-w-6xl w-full mx-auto p-6 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Bem-vindo ao painel Docker Manager</h1>
        {info && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{info.Name}</h2>}
        <p className="text-gray-600 dark:text-white/70">
          Acompanhe o status do seu sistema Docker em um só lugar.
        </p>
        {info && (
          <div className="mt-2 text-xs text-gray-500 font-mono">
            {info.OperatingSystem} - {info.ServerVersion} ({info.Architecture})
          </div>
        )}
      </div>

      <StatsGrid info={info} />
      <ManagementCards />
      <RecentActivity info={info} />
      <ConnectServerCard />
    </div>
  );
};

export default HomePage;
