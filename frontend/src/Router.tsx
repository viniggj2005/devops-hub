import App from './App';
import MainHomePage from './pages/MainHomePage';
import DockerHomePage from './pages/DockerHomePage';
import LoginPage from './pages/LoginPage';
import ImagesPage from './pages/ImagesPage';
import ProtectedRoute from './ProtectedRoute';
import NetworksPage from './pages/NetworksPage';
import VolumesPage from './pages/VolumesPage';
import ContainersPage from './pages/ContainersPage';
import TerminalFormPage from './pages/TerminalFormPage';
import CreateAccountPage from './pages/CreateAccountPage';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import DockerCredentialsPage from './pages/DockerCredentialsPage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <Navigate to="/home" replace /> },

        {
          element: <ProtectedRoute />,
          children: [
            { path: 'home', element: <MainHomePage /> },
            { path: 'docker', children: [
              { path: 'home', element: <DockerHomePage /> },
              { path: 'images', element: <ImagesPage /> },
              { path: 'containers', element: <ContainersPage /> },
              { path: 'docker-credentials', element: <DockerCredentialsPage /> },
              { path: 'networks', element: <NetworksPage /> },
              { path: 'volumes', element: <VolumesPage /> },
            ]},
            { path: 'createConnectionForm', element: <TerminalFormPage /> },
          ],
        },

        { path: 'login', element: <LoginPage /> },
        { path: 'create-account', element: <CreateAccountPage /> },
      ],
    },

  ],
  { basename: '/' }
);
