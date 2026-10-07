import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '../../shared/components/sidebar/AppShell';
import ImagesPage from '../../../pages/dockerManager/ImagesPage';
import VolumesPage from '../../../pages/dockerManager/VolumesPage';
import NetworksPage from '../../../pages/dockerManager/NetworksPage';
import DockerHomePage from '../../../pages/dockerManager/DockerHomePage';
import ContainersPage from '../../../pages/dockerManager/ContainersPage';
import DockerCredentialsPage from '../../../pages/dockerManager/DockerCredentialsPage';

const DockerModuleWrapper: React.FC = () => {
  return (
    <AppShell>
      <Routes>
        <Route path="/images" element={<ImagesPage />} />
        <Route path="/home" element={<DockerHomePage />} />
        <Route path="/volumes" element={<VolumesPage />} />
        <Route path="/networks" element={<NetworksPage />} />
        <Route path="/containers" element={<ContainersPage />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/docker-credentials" element={<DockerCredentialsPage />} />
      </Routes>
    </AppShell>
  );
};

export default DockerModuleWrapper;
