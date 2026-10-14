import iziToast from 'izitoast';
import { usePostgresStore } from '../../PostgresStore';
import { Themes, useTheme } from '../../../../hooks/use-theme';
import { diagramPalettes } from './constants/DiagramPalette';
import { useAuth } from '../../../../contexts/AuthContext';
import DiagramTableNode from './components/DiagramTableNode';
import { PostgresServices } from '../../services/PostgresServices';
import { errorMessage } from '../../functions/TreatmentFunctions';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceTab, DatabaseDiagram, SavedDiagramLayout } from '../../../../interfaces/PostgresInterfaces';
import { Download, KeyRound, Loader2, Maximize, Minus, Plus, RefreshCw, Search, TriangleAlert, Wand2 } from 'lucide-react';
import {
  Point,
  tableKey,
  DiagramNode,
  DiagramBadge,
  relationPath,
  layoutDiagram,
  roundPositions,
  parseSavedLayout,
  buildDiagramNodes,
  diagramBadgeLabels,
  mergeSavedPositions,
} from '../../functions/DiagramLayout';

type DragState =
  | { mode: 'pan'; startX: number; startY: number; origin: Point }
  | { mode: 'node'; key: string; startX: number; startY: number; origin: Point; moved: boolean };

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 2.5;
const FIT_PADDING = 60;
const EXPORT_PADDING = 40;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const DiagramTab: React.FC<{ tab: WorkspaceTab }> = ({ tab }) => {
  const { token } = useAuth();
  const { theme } = useTheme();
  const openTab = usePostgresStore((state) => state.openTab);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingFitRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [keysOnly, setKeysOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<DatabaseDiagram | null>(null);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const keysOnlyRef = useRef(keysOnly);
  const viewportRef = useRef(viewport);
  const positionsRef = useRef(positions);
  const saveTimerRef = useRef<number | null>(null);
  const savedLayoutRef = useRef<SavedDiagramLayout | null>(null);
  const initializedDiagramRef = useRef<DatabaseDiagram | null>(null);
  keysOnlyRef.current = keysOnly;
  viewportRef.current = viewport;
  positionsRef.current = positions;

  const palette = diagramPalettes[theme === Themes.DARK ? 'dark' : 'light'];
  const markerId = `diagram-arrow-${tab.id}`;
  const highlightMarkerId = `${markerId}-highlight`;
  const patternId = `diagram-dots-${tab.id}`;

  const persistLayout = useCallback(() => {
    saveTimerRef.current = null;
    if (!token) return;
    const layout = { keysOnly: keysOnlyRef.current, positions: roundPositions(positionsRef.current) };
    savedLayoutRef.current = layout;
    PostgresServices.saveDiagramLayout(token, tab.connectionId, tab.database, tab.schema ?? '', layout).catch(
      (saveError) =>
        iziToast.error({ title: 'Layout não salvo', message: errorMessage(saveError), position: 'bottomRight' })
    );
  }, [token, tab.connectionId, tab.database, tab.schema]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(persistLayout, 600);
  }, [persistLayout]);

  const scheduleSaveRef = useRef(scheduleSave);
  scheduleSaveRef.current = scheduleSave;

  useEffect(
    () => () => {
      if (!saveTimerRef.current) return;
      window.clearTimeout(saveTimerRef.current);
      persistLayout();
    },
    [persistLayout]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const isFirstLoad = !initializedDiagramRef.current;
      const [loadedDiagram, savedLayout] = await Promise.all([
        PostgresServices.getDatabaseDiagram(token, tab.connectionId, tab.database, tab.schema ?? ''),
        isFirstLoad
          ? PostgresServices.getDiagramLayout(token, tab.connectionId, tab.database, tab.schema ?? '').catch(() => '')
          : Promise.resolve(''),
      ]);
      if (isFirstLoad) {
        savedLayoutRef.current = parseSavedLayout(savedLayout);
        if (savedLayoutRef.current) setKeysOnly(savedLayoutRef.current.keysOnly);
      } else {
        savedLayoutRef.current = { keysOnly: keysOnlyRef.current, positions: positionsRef.current };
      }
      setDiagram(loadedDiagram);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [token, tab.connectionId, tab.database, tab.schema]);

  useEffect(() => {
    load();
  }, [load]);

  const nodes = useMemo(() => (diagram ? buildDiagramNodes(diagram, keysOnly) : {}), [diagram, keysOnly]);

  const relations = useMemo(
    () =>
      (diagram?.relations ?? [])
        .map((relation) => ({
          relation,
          source: nodes[tableKey(relation.sourceSchema, relation.sourceTable)],
          target: nodes[tableKey(relation.targetSchema, relation.targetTable)],
        }))
        .filter((item): item is typeof item & { source: DiagramNode; target: DiagramNode } => Boolean(item.source && item.target)),
    [diagram, nodes]
  );

  useEffect(() => {
    if (!diagram || initializedDiagramRef.current === diagram) return;
    initializedDiagramRef.current = diagram;
    pendingFitRef.current = true;
    setPositions(mergeSavedPositions(layoutDiagram(diagram, nodes), savedLayoutRef.current?.positions ?? {}, nodes));
  }, [diagram, nodes]);

  const reorganize = () => {
    if (!diagram) return;
    pendingFitRef.current = true;
    setPositions(layoutDiagram(diagram, nodes));
    scheduleSave();
  };

  const toggleKeysOnly = () => {
    setKeysOnly((current) => !current);
    scheduleSave();
  };

  const contentBounds = useCallback(() => {
    const keys = Object.keys(nodes).filter((key) => positions[key]);
    if (!keys.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const key of keys) {
      const { x, y } = positions[key];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nodes[key].width);
      maxY = Math.max(maxY, y + nodes[key].height);
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [nodes, positions]);

  const fitView = useCallback(() => {
    const container = containerRef.current;
    const bounds = contentBounds();
    if (!container || !bounds || !container.clientWidth || !container.clientHeight) return false;
    const scale = clampScale(
      Math.min(
        (container.clientWidth - FIT_PADDING * 2) / bounds.width,
        (container.clientHeight - FIT_PADDING * 2) / bounds.height,
        1
      )
    );
    setViewport({
      scale,
      x: (container.clientWidth - bounds.width * scale) / 2 - bounds.minX * scale,
      y: (container.clientHeight - bounds.height * scale) / 2 - bounds.minY * scale,
    });
    return true;
  }, [contentBounds]);

  useEffect(() => {
    if (pendingFitRef.current && fitView()) pendingFitRef.current = false;
  }, [positions, fitView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (pendingFitRef.current && fitView()) pendingFitRef.current = false;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitView]);

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const pointX = (clientX ?? bounds.left + bounds.width / 2) - bounds.left;
    const pointY = (clientY ?? bounds.top + bounds.height / 2) - bounds.top;
    setViewport((current) => {
      const scale = clampScale(current.scale * factor);
      const ratio = scale / current.scale;
      return { scale, x: pointX - (pointX - current.x) * ratio, y: pointY - (pointY - current.y) * ratio };
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomAt]);

  const startDragging = (state: DragState) => {
    dragRef.current = state;
    const handleMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (drag.mode === 'pan') {
        setViewport((current) => ({ ...current, x: drag.origin.x + deltaX, y: drag.origin.y + deltaY }));
        return;
      }
      if (!drag.moved && Math.abs(deltaX) + Math.abs(deltaY) > 3) {
        drag.moved = true;
        setDraggingKey(drag.key);
      }
      const { scale } = viewportRef.current;
      setPositions((previous) => ({
        ...previous,
        [drag.key]: { x: drag.origin.x + deltaX / scale, y: drag.origin.y + deltaY / scale },
      }));
    };
    const handleUp = () => {
      const drag = dragRef.current;
      if (drag?.mode === 'node' && drag.moved) scheduleSaveRef.current();
      setDraggingKey(null);
      dragRef.current = null;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    document.body.style.cursor = state.mode === 'pan' ? 'grabbing' : 'move';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleNodeDragStart = useCallback((event: React.MouseEvent, key: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const origin = positionsRef.current[key];
    startDragging({ mode: 'node', key, startX: event.clientX, startY: event.clientY, origin, moved: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProperties = useCallback(
    (node: DiagramNode) =>
      openTab({
        key: `table:${tab.connectionId}:${tab.database}:${node.table.schema}:${node.table.name}`,
        type: 'table',
        title: node.table.name,
        connectionId: tab.connectionId,
        connectionName: tab.connectionName,
        database: tab.database,
        schema: node.table.schema,
        objectName: node.table.name,
      }),
    [openTab, tab.connectionId, tab.connectionName, tab.database]
  );

  const centerOn = (key: string) => {
    const container = containerRef.current;
    const position = positions[key];
    if (!container || !position) return;
    const node = nodes[key];
    const scale = Math.max(viewport.scale, 0.8);
    setSelectedKey(key);
    setViewport({
      scale,
      x: container.clientWidth / 2 - (position.x + node.width / 2) * scale,
      y: container.clientHeight / 2 - (position.y + node.height / 2) * scale,
    });
  };

  const findTable = () => {
    const query = search.trim().toLowerCase();
    if (!query) return;
    const match =
      Object.keys(nodes).find((key) => nodes[key].table.name.toLowerCase() === query) ??
      Object.keys(nodes).find((key) => key.toLowerCase().includes(query));
    if (match) centerOn(match);
    else iziToast.info({ title: 'Diagrama', message: `Nenhuma tabela com "${search.trim()}".`, position: 'bottomRight' });
  };

  const exportSvg = async () => {
    const svg = svgRef.current;
    const bounds = contentBounds();
    if (!svg || !bounds || !token) return;
    const width = Math.ceil(bounds.width + EXPORT_PADDING * 2);
    const height = Math.ceil(bounds.height + EXPORT_PADDING * 2);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    clone.removeAttribute('class');
    clone.querySelector('[data-background]')?.setAttribute('fill', palette.canvas);
    clone
      .querySelector('[data-viewport]')
      ?.setAttribute('transform', `translate(${EXPORT_PADDING - bounds.minX} ${EXPORT_PADDING - bounds.minY})`);
    clone.querySelectorAll('[opacity]').forEach((element) => element.removeAttribute('opacity'));
    try {
      const fileName = `${tab.title.replace(/[\\/:*?"<>|]+/g, '_')}.svg`;
      const path = await PostgresServices.saveTextFile(token, fileName, new XMLSerializer().serializeToString(clone));
      if (path) iziToast.success({ title: 'Diagrama exportado', message: path, position: 'bottomRight' });
    } catch (exportError) {
      iziToast.error({ title: 'Erro ao exportar', message: errorMessage(exportError), position: 'bottomRight' });
    }
  };

  const highlighted = useMemo(() => {
    const focusKey = draggingKey;
    if (!focusKey) return null;
    const keys = new Set([focusKey]);
    for (const { source, target } of relations) {
      if (source.key === focusKey) keys.add(target.key);
      if (target.key === focusKey) keys.add(source.key);
    }
    return { focusKey, keys };
  }, [draggingKey, relations]);

  const toolButton =
    'h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40';

  if (loading && !diagram) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Lendo tabelas e relacionamentos…
      </div>
    );
  }

  if (error && !diagram) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400 max-w-lg break-words">{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-sm font-semibold">
          Tentar novamente
        </button>
      </div>
    );
  }

  const tableCount = diagram?.tables.length ?? 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-white/5 bg-gray-50/80 dark:bg-zinc-950/40 flex-shrink-0">
        <span className="px-2 text-xs text-gray-500 dark:text-zinc-400">
          {tableCount} {tableCount === 1 ? 'tabela' : 'tabelas'} · {relations.length}{' '}
          {relations.length === 1 ? 'relacionamento' : 'relacionamentos'}
        </span>
        {diagram?.truncated && (
          <span
            title="O diagrama mostra no máximo 400 tabelas. Abra o diagrama de um schema específico para ver o restante."
            className="flex items-center gap-1 px-2 text-xs text-amber-600 dark:text-amber-400"
          >
            <TriangleAlert className="w-3.5 h-3.5" /> limitado a 400
          </span>
        )}
        <div className="relative ml-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && findTable()}
            placeholder="Localizar tabela…"
            className="h-8 w-48 pl-8 pr-2 rounded-lg text-xs outline-none border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:border-cyan-500"
          />
        </div>
        <button
          onClick={toggleKeysOnly}
          title="Mostrar só as colunas de chave primária, estrangeira e únicas"
          className={`${toolButton} ${keysOnly ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : ''}`}
        >
          <KeyRound className="w-3.5 h-3.5" /> Só chaves
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={reorganize} className={toolButton} title="Descartar a organização salva e reorganizar automaticamente">
            <Wand2 className="w-3.5 h-3.5" /> Reorganizar
          </button>
          <button onClick={() => zoomAt(1 / 1.2)} className={toolButton} title="Diminuir zoom">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-gray-500 dark:text-zinc-400">
            {Math.round(viewport.scale * 100)}%
          </span>
          <button onClick={() => zoomAt(1.2)} className={toolButton} title="Aumentar zoom">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={fitView} className={toolButton} title="Ajustar à tela">
            <Maximize className="w-3.5 h-3.5" /> Ajustar
          </button>
          <button onClick={exportSvg} disabled={!tableCount} className={toolButton} title="Exportar como SVG">
            <Download className="w-3.5 h-3.5" /> SVG
          </button>
          <button onClick={load} disabled={loading} className={toolButton} title="Ler o banco de novo">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden select-none">
        {tableCount === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
            Nenhuma tabela encontrada {tab.schema ? `no schema ${tab.schema}` : 'neste banco'}.
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="w-full h-full"
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              setSelectedKey(null);
              startDragging({ mode: 'pan', startX: event.clientX, startY: event.clientY, origin: { x: viewport.x, y: viewport.y } });
            }}
            style={{ cursor: 'grab' }}
          >
            <defs>
              <pattern
                id={patternId}
                width={24 * viewport.scale}
                height={24 * viewport.scale}
                patternUnits="userSpaceOnUse"
                x={viewport.x}
                y={viewport.y}
              >
                <circle cx={1} cy={1} r={1} fill={palette.dot} />
              </pattern>
              {[
                { id: markerId, color: palette.edge },
                { id: highlightMarkerId, color: palette.accent },
              ].map((marker) => (
                <marker
                  key={marker.id}
                  id={marker.id}
                  viewBox="0 0 10 10"
                  refX={9}
                  refY={5}
                  markerWidth={7}
                  markerHeight={7}
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={marker.color} />
                </marker>
              ))}
            </defs>
            <rect data-background width="100%" height="100%" fill={`url(#${patternId})`} />

            <g data-viewport transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
              {relations.map(({ relation, source, target }) => {
                const sourcePosition = positions[source.key];
                const targetPosition = positions[target.key];
                if (!sourcePosition || !targetPosition) return null;
                const { path } = relationPath(
                  source,
                  sourcePosition,
                  relation.sourceColumns[0],
                  target,
                  targetPosition,
                  relation.targetColumns[0]
                );
                const active = Boolean(
                  highlighted && (source.key === highlighted.focusKey || target.key === highlighted.focusKey)
                );
                return (
                  <path
                    key={`${source.key}:${relation.name}`}
                    d={path}
                    fill="none"
                    stroke={active ? palette.accent : palette.edge}
                    strokeWidth={active ? 2.25 : 1.4}
                    opacity={highlighted && !active ? 0.15 : active ? 1 : 0.7}
                    markerEnd={`url(#${active ? highlightMarkerId : markerId})`}
                  >
                    <title>
                      {`${relation.name}\n${source.title} (${relation.sourceColumns.join(', ')}) → ${target.title} (${relation.targetColumns.join(', ')})`}
                    </title>
                  </path>
                );
              })}

              {Object.values(nodes).map((node) =>
                positions[node.key] ? (
                  <DiagramTableNode
                    key={node.key}
                    node={node}
                    palette={palette}
                    position={positions[node.key]}
                    selected={selectedKey === node.key}
                    dimmed={Boolean(highlighted && !highlighted.keys.has(node.key))}
                    onOpen={openProperties}
                    onDragStart={handleNodeDragStart}
                  />
                ) : null
              )}
            </g>
          </svg>
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-gray-400 dark:text-zinc-500">
          Arraste uma tabela para ver as relações dela · arraste o fundo para mover · roda do mouse para zoom · duplo clique abre as propriedades
        </p>
        {tableCount > 0 && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 px-3 py-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
            {(Object.keys(diagramBadgeLabels) as DiagramBadge[]).map((badge) => (
              <span key={badge} className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: palette.badges[badge].fill, color: palette.badges[badge].text }}
                  className="w-5 h-3.5 rounded-[3px] text-[9px] font-bold flex items-center justify-center"
                >
                  {badge}
                </span>
                {diagramBadgeLabels[badge]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagramTab;
