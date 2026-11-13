import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { CheckCircle2, CircleAlert, Info, PlugZap, TriangleAlert } from 'lucide-react';
import { formatDuration, formatNumber } from '../../../functions/TreatmentFunctions';
import type { QueryExecution, QueryMessage } from '../../../../../interfaces/TalpadbInterfaces';

interface MessagesPanelProps {
  execution: QueryExecution | null;
  runError: string | null;
  errorLocation: { line: number; column: number } | null;
}

const severityStyle = (severity: string) => {
  if (severity === 'WARNING')
    return { icon: TriangleAlert, className: 'text-amber-600 dark:text-amber-400' };
  return { icon: Info, className: 'text-sky-600 dark:text-sky-400' };
};

const ErrorBlock: React.FC<{
  error: QueryMessage;
  location: { line: number; column: number } | null;
}> = ({ error, location }) => {
  const { dictionary, formatMessage } = useTranslation();
  const messageTexts = dictionary.talpadb.messages;

  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-1.5">
      <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300 font-semibold">
        <CircleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="break-words">
          {error.severity && `${error.severity}: `}
          {error.message}
        </span>
      </div>
      <div className="pl-6 space-y-1 text-xs text-rose-700/90 dark:text-rose-300/90 font-mono">
        {error.code && <div>SQLSTATE: {error.code}</div>}
        {location && (
          <div>{formatMessage(messageTexts.lineColumn, { line: location.line, column: location.column })}</div>
        )}
        {error.detail && <div className="whitespace-pre-wrap">{formatMessage(messageTexts.detail, { value: error.detail })}</div>}
        {error.hint && <div className="whitespace-pre-wrap">{formatMessage(messageTexts.hint, { value: error.hint })}</div>}
        {error.where && <div className="whitespace-pre-wrap">{formatMessage(messageTexts.context, { value: error.where })}</div>}
      </div>
    </div>
  );
};

const MessagesPanel: React.FC<MessagesPanelProps> = ({ execution, runError, errorLocation }) => {
  const { dictionary, formatMessage } = useTranslation();
  const messageTexts = dictionary.talpadb.messages;

  if (!execution && !runError) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
        {messageTexts.empty}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-3 text-sm">
      {runError && (
        <ErrorBlock
          error={{
            severity: messageTexts.errorSeverity,
            code: '',
            message: runError,
            detail: '',
            hint: '',
            where: '',
            position: 0,
          }}
          location={null}
        />
      )}

      {execution?.reconnected && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <PlugZap className="w-4 h-4" />
          {messageTexts.reconnected}
        </div>
      )}

      {execution?.resultSets.map((resultSet, resultSetIndex) => (
        <div
          key={resultSetIndex}
          className="flex items-center gap-2 font-mono text-xs text-gray-700 dark:text-zinc-300"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>{resultSet.commandTag || 'OK'}</span>
          {resultSet.truncated && (
            <span className="text-amber-600 dark:text-amber-400">
              {formatMessage(messageTexts.truncated, {
                shown: formatNumber(resultSet.rows.length),
                total: formatNumber(resultSet.rowCount),
              })}
            </span>
          )}
        </div>
      ))}

      {execution?.notices.map((notice, noticeIndex) => {
        const style = severityStyle(notice.severity);
        return (
          <div
            key={`notice-${noticeIndex}`}
            className={`flex items-start gap-2 text-xs font-mono ${style.className}`}
          >
            <style.icon className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-pre-wrap break-words">
              {notice.severity}: {notice.message}
              {notice.detail && `\n${notice.detail}`}
            </span>
          </div>
        );
      })}

      {execution?.error && <ErrorBlock error={execution.error} location={errorLocation} />}

      {execution && !execution.error && execution.resultSets.length === 0 && (
        <div className="text-gray-500 dark:text-zinc-400">
          {messageTexts.noCommands}
        </div>
      )}

      {execution && (
        <div className="pt-2 text-xs text-gray-500 dark:text-zinc-400">
          {formatMessage(execution.error ? messageTexts.interruptedIn : messageTexts.succeededIn, {
            duration: formatDuration(execution.durationMs),
          })}
        </div>
      )}
    </div>
  );
};

export default MessagesPanel;
