import { create } from 'zustand';
import { TerminalStateProps } from '../../../interfaces/TerminalInterfaces';

export const useTerminalStore = create<TerminalStateProps>((set) => ({
  open: false,
  minimized: false,
  error: null,
  config: null,
  containerId: null,
  containerName: null,
  askPassword: false,

  minimize: (value) => set({ minimized: value }),

  openWith: (config) => {
    set((state) => {
      const isSame =
        state.open &&
        state.config &&
        state.config.Host === config.Host &&
        state.config.Port === config.Port &&
        state.config.User === config.User;

      if (isSame) {
        return { minimized: false };
      }
      return { config: config, containerId: null, containerName: null, open: true, askPassword: false, minimized: false };
    });
  },
  openForContainer: (id, name) => {
    set((state) => {
      if (state.open && state.containerId === id) {
        return { minimized: false };
      }
      return { config: null, containerId: id, containerName: name, open: true, askPassword: false, minimized: false };
    });
  },
  requirePassword: (config) => set({ config: config, containerId: null, containerName: null, askPassword: true, open: false }),
  submitPassword: (password) =>
    set((storeState) =>
      storeState.config
        ? { config: { ...storeState.config, Password: password }, askPassword: false, open: true, minimized: false }
        : {}
    ),
  close: () =>
    set({
      open: false,
      minimized: false,
      askPassword: false,
      config: null,
      containerId: null,
      containerName: null,
    }),
  setError: (event) => set({ error: event }),
}));
