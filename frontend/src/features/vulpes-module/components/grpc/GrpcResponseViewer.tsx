import { Copy } from 'lucide-react';
import React, { useState } from 'react';
import CodeEditor from '../editors/CodeEditor';
import SectionTabs from '../editors/SectionTabs';
import { iconButtonClass } from '../editors/FormStyles';
import { formatDuration } from '../../functions/Formatters';
import { copyToClipboard } from '../../../shared/functions/clipboard';
import type { TabRuntime } from '../../../../interfaces/VulpesInterfaces';
import { HeadersTable, ResponseEmpty, ResponseError, ResponseLoading } from '../response/ResponseStates';

type GrpcResponseSection = 'message' | 'headers' | 'trailers';

const GrpcResponseViewer: React.FC<{ runtime: TabRuntime; onCancel: () => void }> = ({ runtime, onCancel }) => {
  const [section, setSection] = useState<GrpcResponseSection>('message');
  const response = runtime.grpcResponse;

  if (runtime.running) return <ResponseLoading label="Aguardando o servidor gRPC…" onCancel={onCancel} />;
  if (runtime.error) return <ResponseError message={runtime.error} />;
  if (!response) return <ResponseEmpty hint="Selecione um método e invoque (Ctrl+Enter) para ver a resposta." />;

  const succeeded = response.statusCode === 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
        <span
          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
            succeeded ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          }`}
        >
          {response.statusCode} {response.code}
        </span>
        <span className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{formatDuration(response.durationMs)}</span>
        {succeeded && (
          <button type="button" title="Copiar resposta" onClick={() => copyToClipboard(response.message)} className={`ml-auto ${iconButtonClass}`}>
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <SectionTabs
        active={section}
        onChange={setSection}
        tabs={[
          { key: 'message', label: 'Resposta' },
          { key: 'headers', label: 'Metadata', count: response.headers.length },
          { key: 'trailers', label: 'Trailers', count: response.trailers.length },
        ]}
      />
      {section === 'message' &&
        (succeeded ? (
          <div className="flex-1 min-h-0">
            <CodeEditor readOnly lineWrapping language="json" value={response.message} />
          </div>
        ) : (
          <ResponseError message={response.statusMessage || response.code} />
        ))}
      {section === 'headers' && (
        <div className="flex-1 overflow-auto">
          <HeadersTable headers={response.headers} emptyLabel="Nenhuma metadata recebida." />
        </div>
      )}
      {section === 'trailers' && (
        <div className="flex-1 overflow-auto">
          <HeadersTable headers={response.trailers} emptyLabel="Nenhum trailer recebido." />
        </div>
      )}
    </div>
  );
};

export default GrpcResponseViewer;
