import iziToast from 'izitoast';
import QueryToolbar from './components/QueryToolbar';
import { usePostgresStore } from '../../PostgresStore';
import type { SQLNamespace } from '@codemirror/lang-sql';
import React, { useEffect, useRef, useState } from 'react';
import { startDrag } from '../../functions/DragFunctions';
import { CheckCircle2, CircleX, Loader2 } from 'lucide-react';
import SqlEditor, { type SqlEditorHandle } from './components/SqlEditor';
import { getToken, useAuth } from '../../../../contexts/AuthContext';
import ResultsPanel, { type ResultsPanelTab } from './components/ResultsPanel';
import { PostgresServices, SESSION_NOT_FOUND_MESSAGE } from '../../services/PostgresServices';
import {
  generateId,
  resultToCsv,
  resultToJson,
  errorMessage,
  formatNumber,
  formatDuration,
  summarizeExecution,
  buildCompletionNamespace,
  errorLocation as locateError,
} from '../../functions/TreatmentFunctions';
import type {
  RunMode,
  TxStatus,
  TableChanges,
  WorkspaceTab,
  TableSaveResult,
  QuerySession,
  QueryExecution,
  QueryHistoryEntry,
} from '../../../../interfaces/PostgresInterfaces';

const safeFileName = (title: string) =>
  title
    .replace(/\.sql$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim() || 'query';

const summarizeSave = (result: TableSaveResult) =>
  [
    result.inserted && `${result.inserted} inserida(s)`,
    result.updated && `${result.updated} atualizada(s)`,
    result.deleted && `${result.deleted} excluída(s)`,
  ]
    .filter(Boolean)
    .join(', ');

const QueryTab: React.FC<{ tab: WorkspaceTab; active: boolean }> = ({ tab, active }) => {
  const { token } = useAuth();
  const renameTab = usePostgresStore((state) => state.renameTab);
  const setTabTxStatus = usePostgresStore((state) => state.setTabTxStatus);

  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const autoRunRef = useRef(false);
  const splitRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const editorRef = useRef<SqlEditorHandle>(null);
  const openingRef = useRef<Promise<string> | null>(null);
  const lastRunRef = useRef<{ mode: RunMode; text: string } | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const [maxRows, setMaxRows] = useState(1000);
  const [running, setRunning] = useState(false);
  const [resultIndex, setResultIndex] = useState(0);
  const [editorRatio, setEditorRatio] = useState(0.35);
  const [runError, setRunError] = useState<string | null>(null);
  const [panel, setPanel] = useState<ResultsPanelTab>('results');
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [session, setSession] = useState<QuerySession | null>(null);
  const [completion, setCompletion] = useState<SQLNamespace | undefined>();
  const [execution, setExecution] = useState<QueryExecution | null>(null);
  const [errorPlace, setErrorPlace] = useState<{ line: number; column: number } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const sessionId = sessionRef.current;
      const currentToken = getToken();
      sessionRef.current = null;
      if (sessionId && currentToken)
        PostgresServices.closeQuerySession(currentToken, sessionId).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    PostgresServices.getCompletionSchema(token, tab.connectionId, tab.database)
      .then((tables) => {
        if (!cancelled) setCompletion(buildCompletionNamespace(tables));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, tab.connectionId, tab.database]);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (txStatus) setTabTxStatus(tab.id, txStatus);
  }, [txStatus, tab.id, setTabTxStatus]);

  useEffect(() => {
    if (active) editorRef.current?.focus();
  }, [active]);

  const ensureSession = (): Promise<string> => {
    if (sessionRef.current) return Promise.resolve(sessionRef.current);
    if (!openingRef.current) {
      openingRef.current = PostgresServices.openQuerySession(
        token ?? '',
        tab.connectionId,
        tab.database
      )
        .then((opened) => {
          if (!mountedRef.current) {
            PostgresServices.closeQuerySession(token ?? '', opened.sessionId).catch(
              () => undefined
            );
            throw new Error('A aba foi fechada');
          }
          sessionRef.current = opened.sessionId;
          setSession(opened);
          return opened.sessionId;
        })
        .finally(() => {
          openingRef.current = null;
        });
    }
    return openingRef.current;
  };

  const addHistory = (sql: string, success: boolean, durationMs: number, summary: string) =>
    setHistory((entries) =>
      [
        { id: generateId(), sql, success, durationMs, summary, executedAt: Date.now() },
        ...entries,
      ].slice(0, 50)
    );

  const run = async (mode: RunMode = 'run', rerunText?: string) => {
    const editor = editorRef.current;
    if (!editor || !token || runningRef.current) return;

    const selection = editor.getSelection();
    const useSelection = rerunText === undefined && selection.text.trim().length > 0;
    const text = rerunText ?? (useSelection ? selection.text : editor.getValue());
    if (!text.trim()) {
      iziToast.warning({
        title: 'Atenção',
        message: 'Digite uma consulta para executar.',
        position: 'bottomRight',
      });
      return;
    }
    const prefix =
      mode === 'explain'
        ? 'EXPLAIN '
        : mode === 'explain-analyze'
          ? 'EXPLAIN (ANALYZE, BUFFERS) '
          : '';
    const offset = useSelection ? selection.from : 0;
    const markable = rerunText === undefined;
    lastRunRef.current = { mode, text };

    editor.markError(null);
    runningRef.current = true;
    setRunning(true);
    setRunError(null);
    setErrorPlace(null);
    const startedAt = Date.now();
    const execute = async () =>
      PostgresServices.executeQuery(token, await ensureSession(), prefix + text, maxRows);

    try {
      let result: QueryExecution;
      try {
        result = await execute();
      } catch (error) {
        // A sessão some quando a conexão é editada/desconectada: abre outra e tenta de novo.
        if (!errorMessage(error).includes(SESSION_NOT_FOUND_MESSAGE)) throw error;
        sessionRef.current = null;
        result = await execute();
      }
      if (!mountedRef.current) return;

      setExecution(result);
      setResultIndex(0);
      setTxStatus(result.txStatus);
      if (result.error) {
        setPanel('messages');
        const position = result.error.position - 1 - prefix.length;
        if (markable && result.error.position > 0 && position >= 0) {
          editor.markError(offset + position, result.error.message);
          setErrorPlace(locateError(editor.getValue(), offset + position + 1));
        }
      } else {
        setPanel(
          result.resultSets.some((resultSet) => resultSet.columns.length > 0)
            ? 'results'
            : 'messages'
        );
      }
      addHistory(text, !result.error, result.durationMs, summarizeExecution(result));
    } catch (error) {
      if (!mountedRef.current) return;
      const message = errorMessage(error);
      setExecution(null);
      setRunError(message);
      setPanel('messages');
      addHistory(text, false, Date.now() - startedAt, message);
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setRunning(false);
    }
  };

  useEffect(() => {
    if (tab.autoRun && !autoRunRef.current) {
      autoRunRef.current = true;
      run('run');
    }
    // Executa uma única vez ao abrir a aba ("Ver dados").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async () => {
    const sessionId = sessionRef.current;
    if (!sessionId || !token) return;
    try {
      await PostgresServices.cancelQuery(token, sessionId);
    } catch (error) {
      iziToast.error({ title: 'Erro', message: errorMessage(error), position: 'bottomRight' });
    }
  };

  const openFile = async () => {
    if (!token) return;
    try {
      const file = await PostgresServices.openSqlFile(token);
      if (!file) return;
      editorRef.current?.setValue(file.content);
      renameTab(tab.id, file.name);
    } catch (error) {
      iziToast.error({
        title: 'Erro ao abrir arquivo',
        message: errorMessage(error),
        position: 'bottomRight',
      });
    }
  };

  const saveFile = async () => {
    if (!token) return;
    try {
      const path = await PostgresServices.saveTextFile(
        token,
        `${safeFileName(tab.title)}.sql`,
        editorRef.current?.getValue() ?? ''
      );
      if (path)
        iziToast.success({ title: 'Arquivo salvo', message: path, position: 'bottomRight' });
    } catch (error) {
      iziToast.error({
        title: 'Erro ao salvar',
        message: errorMessage(error),
        position: 'bottomRight',
      });
    }
  };

  const exportResult = async (format: 'csv' | 'json', index: number) => {
    const resultSet = execution?.resultSets.filter((item) => item.columns.length > 0)[index];
    if (!resultSet || !token) return;
    try {
      const content = format === 'csv' ? resultToCsv(resultSet) : resultToJson(resultSet);
      const path = await PostgresServices.saveTextFile(
        token,
        `${safeFileName(tab.title)}.${format}`,
        content
      );
      if (!path) return;
      if (resultSet.truncated) {
        iziToast.warning({
          title: 'Exportação parcial',
          message: `Foram exportadas ${formatNumber(resultSet.rows.length)} de ${formatNumber(resultSet.rowCount)} linhas (aumente o limite para exportar mais).`,
          position: 'bottomRight',
        });
      } else {
        iziToast.success({ title: 'Exportado', message: path, position: 'bottomRight' });
      }
    } catch (error) {
      iziToast.error({
        title: 'Erro ao exportar',
        message: errorMessage(error),
        position: 'bottomRight',
      });
    }
  };

  const saveChanges = async (changes: TableChanges) => {
    const sessionId = sessionRef.current;
    if (!token || !sessionId) return false;
    try {
      const result = await PostgresServices.saveTableChanges(token, sessionId, changes);
      setTxStatus(result.txStatus);
      iziToast.success({
        title: result.committed ? 'Alterações salvas' : 'Alterações na transação',
        message: result.committed
          ? summarizeSave(result)
          : `${summarizeSave(result)}. Execute COMMIT para confirmar ou ROLLBACK para desfazer.`,
        position: 'bottomRight',
      });
      const lastRun = lastRunRef.current;
      if (lastRun) run(lastRun.mode, lastRun.text);
      return true;
    } catch (error) {
      iziToast.error({ title: 'Erro ao salvar', message: errorMessage(error), position: 'bottomRight' });
      return false;
    }
  };

  const startSplit = (event: React.MouseEvent) => {
    const container = splitRef.current;
    if (!container) return;
    const height = container.clientHeight;
    const startRatio = editorRatio;
    startDrag(event, 'row-resize', (_deltaX, deltaY) =>
      setEditorRatio(Math.min(0.85, Math.max(0.12, startRatio + deltaY / height)))
    );
  };

  const hasError = Boolean(runError || execution?.error);

  return (
    <div className="flex flex-col h-full min-h-0">
      <QueryToolbar
        running={running}
        maxRows={maxRows}
        txStatus={txStatus}
        onRun={() => run('run')}
        onCancel={cancel}
        onExplain={(analyze) => run(analyze ? 'explain-analyze' : 'explain')}
        onOpenFile={openFile}
        onSave={saveFile}
        onMaxRowsChange={setMaxRows}
      />

      <div ref={splitRef} className="flex-1 min-h-0 flex flex-col">
        <div style={{ height: `${editorRatio * 100}%` }} className="min-h-[80px] flex-shrink-0">
          <SqlEditor
            ref={editorRef}
            initialValue={tab.initialSql ?? ''}
            placeholder="-- Escreva sua consulta. Ctrl+Enter ou F5 executa; com um trecho selecionado, executa só ele."
            schema={completion}
            onRun={() => run('run')}
            onExplain={(analyze) => run(analyze ? 'explain-analyze' : 'explain')}
            onSave={saveFile}
          />
        </div>
        <div
          onMouseDown={startSplit}
          className="h-2 flex-shrink-0 cursor-row-resize group flex items-center justify-center border-y border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-zinc-900"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/10 group-hover:bg-cyan-500/60 transition-colors" />
        </div>
        <div className="flex-1 min-h-0">
          <ResultsPanel
            panel={panel}
            running={running}
            runError={runError}
            resultIndex={resultIndex}
            history={history}
            execution={execution}
            errorLocation={errorPlace}
            onPanelChange={setPanel}
            onResultIndexChange={setResultIndex}
            onLoadHistory={(sql) => {
              editorRef.current?.setValue(sql);
              editorRef.current?.focus();
            }}
            onExport={exportResult}
            onSaveChanges={saveChanges}
          />
        </div>
      </div>

      <div className="h-7 flex-shrink-0 flex items-center gap-3 px-3 border-t border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-950/40 text-[11px] text-gray-500 dark:text-zinc-400">
        {running ? (
          <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Executando… {formatDuration(elapsed)}
          </span>
        ) : hasError ? (
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <CircleX className="w-3.5 h-3.5" />
            Erro na execução
          </span>
        ) : execution ? (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {summarizeExecution(execution)} · {formatDuration(execution.durationMs)}
          </span>
        ) : (
          <span>Pronto</span>
        )}
        <span className="ml-auto truncate">
          {tab.database} @ {tab.connectionName}
        </span>
        {session && (
          <span className="whitespace-nowrap">
            PostgreSQL {session.serverVersion} · PID {session.backendPid}
          </span>
        )}
      </div>
    </div>
  );
};

export default QueryTab;
