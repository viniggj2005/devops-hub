import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
        <Route path="/docker/home" element={<DockerHomePage />} />
        <Route path="/docker/containers" element={<ContainersPage />} />
        <Route path="/docker/images" element={<ImagesPage />} />
        <Route path="/docker/volumes" element={<VolumesPage />} />
        <Route path="/docker/networks" element={<NetworksPage />} />
        <Route path="/docker/credentials" element={<DockerCredentialsPage />} />
        <Route path="/docker/docker-credentials" element={<Navigate to="/docker/credentials" replace />} />
        <Route path="/home" element={<Navigate to="/docker/home" replace />} />
        <Route path="/containers" element={<Navigate to="/docker/containers" replace />} />
        <Route path="/images" element={<Navigate to="/docker/images" replace />} />
        <Route path="/volumes" element={<Navigate to="/docker/volumes" replace />} />
        <Route path="/networks" element={<Navigate to="/docker/networks" replace />} />
        <Route path="/docker-credentials" element={<Navigate to="/docker/credentials" replace />} />
        <Route path="*" element={<Navigate to="/docker/home" replace />} />
      </Routes>
    </AppShell>
  );
};

export default DockerModuleWrapper;
