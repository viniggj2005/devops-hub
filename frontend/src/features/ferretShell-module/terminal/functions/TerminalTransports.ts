import { TerminalInstance } from '../../../../interfaces/TerminalInterfaces';
import * as SshTerminal from '../../../../../bindings/docker-manager-go/src/ferretshell/handlers/terminalhandlerstruct';
import * as LocalTerminal from '../../../../../bindings/docker-manager-go/src/ferretshell/handlers/localterminalhandlerstruct';

export interface TerminalTransport {
  exitLabel: string;
  exitEvent: string;
  dataEvent: string;
  restartAction: string;
  disconnect: () => void;
  send: (data: string) => Promise<void>;
  connect: (cols: number, rows: number) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
}

const buildSshTransport = (instance: TerminalInstance): TerminalTransport => {
  const sessionId = instance.config?.SshSessionId || instance.id;
  return {
    restartAction: 'reconectar',
    exitLabel: 'conexão encerrada',
    exitEvent: `ssh:exit:${sessionId}`,
    dataEvent: `ssh:data:${sessionId}`,
    disconnect: () => SshTerminal.Disconnect(sessionId),
    send: (data) => SshTerminal.Send(sessionId, data),
    resize: (cols, rows) => SshTerminal.Resize(sessionId, cols, rows),
    connect: (cols, rows) => SshTerminal.ConnectWith({ ...(instance.config as any), Cols: cols, Rows: rows }),
  };
};

const buildLocalTransport = (instance: TerminalInstance, shellId: string): TerminalTransport => {
  const sessionId = instance.id;
  return {
    restartAction: 'reiniciar',
    exitLabel: 'terminal encerrado',
    exitEvent: `local:exit:${sessionId}`,
    dataEvent: `local:data:${sessionId}`,
    disconnect: () => LocalTerminal.Disconnect(sessionId),
    send: (data) => LocalTerminal.Send(sessionId, data),
    resize: (cols, rows) => LocalTerminal.Resize(sessionId, cols, rows),
    connect: (cols, rows) => LocalTerminal.Start({ cols, rows, shellId, sessionId }),
  };
};

export const resolveTerminalTransport = (instance: TerminalInstance): TerminalTransport =>
  instance.localShell ? buildLocalTransport(instance, instance.localShell.id) : buildSshTransport(instance);
