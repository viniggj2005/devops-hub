import './index.css';
import React from 'react';
import { router } from './Router';
import { Window } from '@wailsio/runtime';
import { Toaster } from 'react-hot-toast';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './hooks/use-theme';
import { DockerClientProvider } from './contexts/DockerClientContext';

const container = document.getElementById('root');
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key !== 'F5') return;
  if (event.shiftKey) {
    Window.ForceReload();
  } else {
    Window.Reload();
  }
});

const AppToaster: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3500,
        style: {
          fontSize: '13px',
          fontWeight: 500,
          borderRadius: '12px',
          padding: '10px 14px',
          color: isDark ? '#f4f4f5' : '#18181b',
          background: isDark ? '#18181b' : '#ffffff',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e4e4e7',
          boxShadow: isDark
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.6)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: isDark ? '#18181b' : '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: isDark ? '#18181b' : '#ffffff',
          },
        },
      }}
    />
  );
};

createRoot(container!).render(
  <React.StrictMode>
    <AuthProvider>
      <DockerClientProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
          <AppToaster />
        </ThemeProvider>
      </DockerClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
