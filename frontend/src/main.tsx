import './index.css';
import { router } from './Router';
import 'izitoast/dist/css/iziToast.min.css';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './hooks/use-theme';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DockerClientProvider } from './contexts/DockerClientContext';
import { WindowReload, WindowReloadApp } from "../wailsjs/runtime/runtime";
import React from 'react';

const container = document.getElementById('root');
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === "F5") {
    WindowReload()
  } else if (event.shiftKey && event.key === "F5") {
    WindowReloadApp()
  }
});

const root = createRoot(container!);

const renderApp = () => {
  root.render(
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
};

if ((window as any).runtime && (window as any).go) {
  renderApp();
} else {
  let attempts = 0;
  const maxAttempts = 100;
  const interval = setInterval(() => {
    attempts++;
    if (((window as any).runtime && (window as any).go) || attempts >= maxAttempts) {
      clearInterval(interval);
      if (attempts >= maxAttempts) {
        console.warn('Wails runtime not detected after 5 seconds. Rendering anyway...');
      }
      renderApp();
    }
  }, 50);
}
