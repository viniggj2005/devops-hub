import React, { useMemo } from 'react';
import { ChevronRight, Save } from 'lucide-react';
import HttpRequestEditor from '../http/HttpRequestEditor';
import GrpcRequestEditor from '../grpc/GrpcRequestEditor';
import { buildVariableMap } from '../../functions/Variables';
import { secondaryButtonClass } from '../editors/FormStyles';
import { emptyRuntime, useVulpesStore } from '../../VulpesStore';
import SocketIoRequestEditor from '../realtime/SocketIoRequestEditor';
import WebSocketRequestEditor from '../realtime/WebSocketRequestEditor';
import type { ProtocolEditorProps } from '../request/ProtocolEditorProps';
import type { RequestTab } from '../../../../interfaces/VulpesInterfaces';
import { ancestorsOf, describeInheritedAuth, findItem } from '../../functions/CollectionTree';

const fallbackRuntime = emptyRuntime();

const editors: Record<RequestTab['request']['protocol'], React.FC<ProtocolEditorProps>> = {
  http: HttpRequestEditor,
  grpc: GrpcRequestEditor,
  socketio: SocketIoRequestEditor,
  websocket: WebSocketRequestEditor,
};

interface RequestViewProps {
  tab: RequestTab;
  onSave: () => void;
  paneControls?: React.ReactNode;
}

const RequestView: React.FC<RequestViewProps> = ({ tab, onSave, paneControls }) => {
  const renameTab = useVulpesStore((state) => state.renameTab);
  const runtime = useVulpesStore((state) => state.runtimes[tab.id]) ?? fallbackRuntime;
  const collection = useVulpesStore((state) => state.collections.find((candidate) => candidate.id === tab.collectionId));
  const environment = useVulpesStore((state) => state.environments.find((candidate) => candidate.id === state.activeEnvironmentId));
  const variables = useMemo(() => buildVariableMap(collection, environment), [collection, environment]);

  const item = collection && tab.itemId ? findItem(collection.items, tab.itemId) : null;
  const folders = collection && tab.itemId ? ancestorsOf(collection.items, tab.itemId) ?? [] : [];
  const Editor = editors[tab.request.protocol];

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 pt-3 flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0 text-xs text-gray-400 dark:text-zinc-500">
          <span className="truncate max-w-[180px]">{collection?.name ?? 'Não salva'}</span>
          {folders.map((folder) => (
            <React.Fragment key={folder.id}>
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{folder.name}</span>
            </React.Fragment>
          ))}
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        </div>
        <input
          value={tab.name}
          spellCheck={false}
          aria-label="Nome da requisição"
          onChange={(event) => renameTab(tab.id, event.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm font-bold text-gray-900 dark:text-white rounded-md px-1.5 py-0.5 -ml-1 hover:bg-gray-100 dark:hover:bg-white/5 focus:bg-gray-100 dark:focus:bg-white/5 focus:outline-none"
        />
        <button type="button" onClick={onSave} title="Salvar (Ctrl+S)" className={secondaryButtonClass}>
          <Save className={`w-3.5 h-3.5 ${tab.dirty ? 'text-amber-500' : ''}`} />
          {tab.itemId ? 'Salvar' : 'Salvar em…'}
        </button>
        {paneControls}
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          tab={tab}
          onSave={onSave}
          runtime={runtime}
          variables={variables}
          scripts={item?.scripts ?? []}
          inheritedHint={describeInheritedAuth(collection, tab.itemId)}
        />
      </div>
    </div>
  );
};

export default RequestView;
