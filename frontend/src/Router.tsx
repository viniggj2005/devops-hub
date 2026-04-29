import App from './App';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './ProtectedRoute';
import { createBrowserRouter } from 'react-router-dom';
import CreateAccountPage from './pages/CreateAccountPage';

export const router = createBrowserRouter(
  [
    {
      path: '/*',
      element: <ProtectedRoute />,
      children: [
        { path: '*', element: <App /> },
      ],
    },
    { path: '/login', element: <LoginPage /> },
    { path: '/create-account', element: <CreateAccountPage /> },
  ],
  { basename: '/' }
);
