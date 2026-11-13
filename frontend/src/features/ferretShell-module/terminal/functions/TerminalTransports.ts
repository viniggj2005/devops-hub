import { TerminalInstance } from '../../../../interfaces/TerminalInterfaces';
import * as SshTerminal from '../../../../../bindings/docker-manager-go/src/ferretshell/handlers/terminalhandlerstruct';
import * as LocalTerminal from '../../../../../bindings/docker-manager-go/src/ferretshell/handlers/localterminalhandlerstruct';

export interface TerminalTransport {
  exitEvent: string;
  dataEvent: string;
  kind: 'ssh' | 'local';
  disconnect: () => void;
  attach: () => Promise<void>;
  send: (data: string) => Promise<void>;
  connect: (cols: number, rows: number) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
}

const buildSshTransport = (instance: TerminalInstance): TerminalTransport => {
  const sessionId = instance.config?.SshSessionId || instance.id;
  return {
    kind: 'ssh',
    exitEvent: `ssh:exit:${sessionId}`,
    dataEvent: `ssh:data:${sessionId}`,
    disconnect: () => SshTerminal.Disconnect(sessionId),
    attach: () => SshTerminal.Attach(sessionId),
    send: (data) => SshTerminal.Send(sessionId, data),
    resize: (cols, rows) => SshTerminal.Resize(sessionId, cols, rows),
    connect: (cols, rows) => SshTerminal.ConnectWith({ ...(instance.config as any), Cols: cols, Rows: rows }),
  };
};

const buildLocalTransport = (instance: TerminalInstance, shellId: string): TerminalTransport => {
  const sessionId = instance.id;
  return {
    kind: 'local',
    exitEvent: `local:exit:${sessionId}`,
    dataEvent: `local:data:${sessionId}`,
    disconnect: () => LocalTerminal.Disconnect(sessionId),
    attach: () => LocalTerminal.Attach(sessionId),
    send: (data) => LocalTerminal.Send(sessionId, data),
    resize: (cols, rows) => LocalTerminal.Resize(sessionId, cols, rows),
    connect: (cols, rows) => LocalTerminal.Start({ cols, rows, shellId, sessionId }),
  };
};

export const resolveTerminalTransport = (instance: TerminalInstance): TerminalTransport =>
  instance.localShell ? buildLocalTransport(instance, instance.localShell.id) : buildSshTransport(instance);
