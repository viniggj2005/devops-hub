import React from 'react';
import ImagesPage from '../../../pages/ImagesPage';
import VolumesPage from '../../../pages/VolumesPage';
import NetworksPage from '../../../pages/NetworksPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import DockerHomePage from '../../../pages/DockerHomePage';
import ContainersPage from '../../../pages/ContainersPage';
import AppShell from '../../shared/components/sidebar/AppShell';
import DockerCredentialsPage from '../../../pages/DockerCredentialsPage';

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
