import './index.css';
import React from 'react';
import { router } from './Router';
import 'izitoast/dist/css/iziToast.min.css';
import { Window } from '@wailsio/runtime';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './hooks/use-theme';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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

createRoot(container!).render(
  <React.StrictMode>
    <AuthProvider>
      <DockerClientProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </DockerClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
