import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Events } from '@wailsio/runtime';
import { useTerminalStore } from '../TerminalStore';
import { SerializeAddon } from '@xterm/addon-serialize';
import { attachTerminalShortcuts } from './TerminalShortcuts';
import { resolveTerminalTransport } from './TerminalTransports';
import { registerModuleHandoff } from '../../../appFrame/ModuleHandoff';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import { TerminalThemeConfig } from '../../../../interfaces/GeneralConfigsInterfaces';
import { TerminalTab, TerminalInstance } from '../../../../interfaces/TerminalInterfaces';

const ANSI_RED = '31';
const ANSI_DIM = '2';
const ANSI_YELLOW = '33';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface TerminalSnapshot {
  cols: number;
  rows: number;
  content: string;
}

interface TerminalHandoff {
  tabs: TerminalTab[];
  activeTabId: string | null;
  snapshots: Record<string, TerminalSnapshot>;
}

interface TerminalSession {
  release: () => void;
  dispose: () => void;
  snapshot: () => TerminalSnapshot;
  attach: (host: HTMLElement) => () => void;
  applyTheme: (theme: TerminalThemeConfig) => void;
}

const sessions = new Map<string, TerminalSession>();
const adoptedSnapshots = new Map<string, TerminalSnapshot | null>();

let pendingDisposal: number | undefined;

function createTerminalSession(instance: TerminalInstance): TerminalSession {
  const { id } = instance;
  const adopted = adoptedSnapshots.has(id);
  const adoptedSnapshot = adoptedSnapshots.get(id) ?? null;
  adoptedSnapshots.delete(id);

  let appliedTheme = useGeneralConfigsStore.getState().terminalTheme;
  const terminal = new Terminal({
    lineHeight: 1,
    convertEol: true,
    scrollback: 5000,
    cursorBlink: true,
    allowProposedApi: true,
    fontFamily: 'Courier New',
    theme: appliedTheme.colors,
    fontSize: appliedTheme.fontSize,
    ...(adoptedSnapshot ? { cols: adoptedSnapshot.cols, rows: adoptedSnapshot.rows } : {}),
  });
  const fit = new FitAddon();
  const serializer = new SerializeAddon();
  terminal.loadAddon(fit);
  terminal.loadAddon(serializer);
  if (adoptedSnapshot) terminal.write(adoptedSnapshot.content);

  const element = document.createElement('div');
  element.style.width = '100%';
  element.style.height = '100%';

  const transport = resolveTerminalTransport(instance);

  let opened = false;
  let isDisposed = false;
  let connectionStatus: ConnectionStatus = 'connecting';

  const writeNotice = (color: string, label: string, message: string) => {
    if (isDisposed) return;
    terminal.write(`\r\n\x1b[${color}m[${label}]\x1b[0m ${message}\r\n`);
  };

  const markDisconnected = () => {
    connectionStatus = 'disconnected';
    writeNotice(ANSI_DIM, 'ferret', `pressione Enter para ${transport.restartAction}`);
  };

  const fitToHost = () => {
    if (isDisposed) return;
    fit.fit();
    if (connectionStatus !== 'connected') return;
    transport.resize(terminal.cols, terminal.rows).catch(() => undefined);
  };

  const connect = () => {
    connectionStatus = 'connecting';
    transport.connect(terminal.cols, terminal.rows)
      .then(() => {
        connectionStatus = 'connected';
        fitToHost();
      })
      .catch((connectError: unknown) => {
        if (isDisposed) return;
        writeNotice(ANSI_RED, 'erro', String(connectError));
        markDisconnected();
      });
  };

  const resumeAdopted = () => {
    transport.attach()
      .then(() => {
        connectionStatus = 'connected';
        fitToHost();
      })
      .catch(() => {
        if (isDisposed) return;
        writeNotice(ANSI_RED, transport.exitLabel, 'a sessão terminou durante a troca de janela');
        markDisconnected();
      });
  };

  const reconnect = () => {
    writeNotice(ANSI_YELLOW, 'ferret', `${transport.restartAction}...`);
    connect();
  };

  const handleData = (data: string) => {
    if (connectionStatus === 'disconnected') {
      if (data.includes('\r')) reconnect();
      return;
    }
    if (connectionStatus === 'connecting') return;

    const state = useTerminalStore.getState();
    const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
    const isActiveTab = activeTab?.instances.some(tabInstance => tabInstance.id === id);

    if (state.broadcastActive && isActiveTab && activeTab) {
      activeTab.instances
        .filter(tabInstance => !tabInstance.containerId)
        .forEach(tabInstance => resolveTerminalTransport(tabInstance).send(data).catch(() => undefined));
    } else {
      transport.send(data).catch(() => undefined);
    }
  };

  terminal.onData(handleData);
  const detachShortcuts = attachTerminalShortcuts(terminal, element);
  const offData = Events.On(transport.dataEvent, ({ data: chunk }) => terminal.write(chunk));
  const offExit = Events.On(transport.exitEvent, ({ data: reason }) => {
    if (connectionStatus === 'disconnected') return;
    writeNotice(ANSI_RED, transport.exitLabel, reason || 'sessão finalizada');
    markDisconnected();
  });

  const openInto = (host: HTMLElement) => {
    host.appendChild(element);
    if (opened) {
      fitToHost();
      terminal.refresh(0, terminal.rows - 1);
      return;
    }
    opened = true;
    terminal.open(element);
    fit.fit();
    terminal.focus();
    if (adopted) resumeAdopted();
    else connect();
  };

  const release = () => {
    isDisposed = true;
    offData();
    offExit();
    detachShortcuts();
    terminal.dispose();
    element.remove();
  };

  return {
    release,
    attach: (host) => {
      openInto(host);
      const resizeObserver = new ResizeObserver(fitToHost);
      resizeObserver.observe(host);
      return () => {
        resizeObserver.disconnect();
        if (element.parentElement === host) host.removeChild(element);
      };
    },
    snapshot: () => ({ cols: terminal.cols, rows: terminal.rows, content: serializer.serialize() }),
    applyTheme: (theme) => {
      if (isDisposed || appliedTheme === theme) return;
      appliedTheme = theme;
      terminal.options.theme = theme.colors;
      terminal.options.fontSize = theme.fontSize;
      fitToHost();
    },
    dispose: () => {
      transport.disconnect();
      release();
    },
  };
}

export function attachTerminalSession(instance: TerminalInstance, host: HTMLElement) {
  let session = sessions.get(instance.id);
  if (!session) {
    session = createTerminalSession(instance);
    sessions.set(instance.id, session);
  }
  return session.attach(host);
}

function disposeAllTerminalSessions() {
  sessions.forEach(session => session.dispose());
  sessions.clear();
}

export function retainTerminalSessions() {
  window.clearTimeout(pendingDisposal);
  return () => {
    pendingDisposal = window.setTimeout(disposeAllTerminalSessions);
  };
}

function captureTerminalHandoff() {
  const { tabs, activeTabId } = useTerminalStore.getState();
  if (tabs.length === 0) return '';
  const snapshots: Record<string, TerminalSnapshot> = {};
  sessions.forEach((session, instanceId) => {
    snapshots[instanceId] = session.snapshot();
  });
  const handoff: TerminalHandoff = { tabs, activeTabId, snapshots };
  return JSON.stringify(handoff);
}

function releaseTerminalSessions() {
  sessions.forEach(session => session.release());
  sessions.clear();
  useTerminalStore.getState().close();
}

function adoptTerminalHandoff(payload: string) {
  const handoff = JSON.parse(payload) as TerminalHandoff;
  handoff.tabs.forEach(tab =>
    tab.instances.forEach(instance => adoptedSnapshots.set(instance.id, handoff.snapshots[instance.id] ?? null)),
  );
  useTerminalStore.getState().adoptTabs(handoff.tabs, handoff.activeTabId);
}

registerModuleHandoff('ferretshell', {
  adopt: adoptTerminalHandoff,
  capture: captureTerminalHandoff,
  release: releaseTerminalSessions,
});

useTerminalStore.subscribe((state) => {
  const liveInstanceIds = new Set(state.tabs.flatMap(tab => tab.instances.map(instance => instance.id)));
  sessions.forEach((session, instanceId) => {
    if (liveInstanceIds.has(instanceId)) return;
    session.dispose();
    sessions.delete(instanceId);
  });
});

useGeneralConfigsStore.subscribe((state, previousState) => {
  if (state.terminalTheme === previousState.terminalTheme) return;
  sessions.forEach(session => session.applyTheme(state.terminalTheme));
});
