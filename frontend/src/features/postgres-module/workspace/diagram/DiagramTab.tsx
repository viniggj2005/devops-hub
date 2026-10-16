import iziToast from 'izitoast';
import { usePostgresStore } from '../../PostgresStore';
import { useAuth } from '../../../../contexts/AuthContext';
import DiagramTableNode from './components/DiagramTableNode';
import { Themes, useTheme } from '../../../../hooks/use-theme';
import { buildDiagramPalette } from './constants/DiagramPalette';
import { errorMessage } from '../../functions/TreatmentFunctions';
import { PostgresServices } from '../../services/PostgresServices';
import ContextMenu, { type ContextMenuItem } from '../components/ContextMenu';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import {
  relationKey,
  edgeGeometry,
  EdgeGeometry,
  followWeights,
  snapToNeighbors,
  anchorFromPointer,
  nearestSegmentIndex,
} from '../../functions/DiagramEdges';
import type {
  WorkspaceTab,
  DatabaseDiagram,
  DiagramLineStyle,
  SavedDiagramLayout,
  DiagramEdgeAnchors,
} from '../../../../interfaces/PostgresInterfaces';
import {
  Plus,
  Minus,
  Slash,
  Wand2,
  Undo2,
  Eraser,
  Search,
  Spline,
  Loader2,
  KeyRound,
  Download,
  Maximize,
  RefreshCw,
  CirclePlus,
  CircleMinus,
  TriangleAlert,
  CornerDownRight,
} from 'lucide-react';
import {
  Point,
  tableKey,
  roundEdges,
  DiagramNode,
  roundAnchors,
  DiagramBadge,
  layoutDiagram,
  roundPositions,
  parseSavedLayout,
  buildDiagramNodes,
  diagramBadgeLabels,
  mergeSavedPositions,
} from '../../functions/DiagramLayout';

interface EdgeFollower {
  edgeKey: string;
  origin: Point[];
  weights: number[];
}

type DragState =
  | { mode: 'pan'; startX: number; startY: number; origin: Point }
  | {
      key: string;
      mode: 'node';
      origin: Point;
      moved: boolean;
      startX: number;
      startY: number;
      followers: EdgeFollower[];
    }
  | { mode: 'waypoint'; index: number; startX: number; startY: number; origin: Point; edgeKey: string; moved: boolean }
  | { mode: 'anchor'; edgeKey: string; end: EdgeEnd; startX: number; startY: number; moved: boolean };

type EdgeEnd = 'source' | 'target';

interface EdgeMenu {
  x: number;
  y: number;
  title: string;
  items: ContextMenuItem[];
}

const lineStyleOptions: { style: DiagramLineStyle; label: string; icon: React.ElementType }[] = [
  { style: 'curved', label: 'Linhas curvas', icon: Spline },
  { style: 'straight', label: 'Linhas retas', icon: Slash },
  { style: 'orthogonal', label: 'Linhas em ângulo reto', icon: CornerDownRight },
];

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
  const pendingFitRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const openTab = usePostgresStore((state) => state.openTab);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);
  const attachCanvas = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    setCanvasElement(element);
  }, []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [keysOnly, setKeysOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenu | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<DatabaseDiagram | null>(null);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [lineStyle, setLineStyle] = useState<DiagramLineStyle>('curved');
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [edgeWaypoints, setEdgeWaypoints] = useState<Record<string, Point[]>>({});
  const [edgeAnchors, setEdgeAnchors] = useState<Record<string, DiagramEdgeAnchors>>({});
  const keysOnlyRef = useRef(keysOnly);
  const viewportRef = useRef(viewport);
  const lineStyleRef = useRef(lineStyle);
  const positionsRef = useRef(positions);
  const edgeAnchorsRef = useRef(edgeAnchors);
  const edgeWaypointsRef = useRef(edgeWaypoints);
  const saveTimerRef = useRef<number | null>(null);
  const relationKeysRef = useRef<Set<string>>(new Set());
  const geometryRef = useRef<Record<string, EdgeGeometry>>({});
  const savedLayoutRef = useRef<SavedDiagramLayout | null>(null);
  const initializedDiagramRef = useRef<DatabaseDiagram | null>(null);
  keysOnlyRef.current = keysOnly;
  viewportRef.current = viewport;
  lineStyleRef.current = lineStyle;
  positionsRef.current = positions;
  edgeAnchorsRef.current = edgeAnchors;
  edgeWaypointsRef.current = edgeWaypoints;

  const moduleConfig = useGeneralConfigsStore((state) => state.modules['postgres-manager']);
  const customTheme = moduleConfig.theme === 'custom' ? moduleConfig.customTheme : null;
  const palette = useMemo(() => buildDiagramPalette(theme === Themes.DARK, customTheme), [theme, customTheme]);
  const markerId = `diagram-arrow-${tab.id}`;
  const highlightMarkerId = `${markerId}-highlight`;
  const patternId = `diagram-dots-${tab.id}`;

  const persistLayout = useCallback(() => {
    saveTimerRef.current = null;
    if (!token) return;
    const layout: SavedDiagramLayout = {
      keysOnly: keysOnlyRef.current,
      lineStyle: lineStyleRef.current,
      positions: roundPositions(positionsRef.current),
      edges: roundEdges(edgeWaypointsRef.current, relationKeysRef.current),
      anchors: roundAnchors(edgeAnchorsRef.current, relationKeysRef.current),
    };
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
        const parsed = parseSavedLayout(savedLayout);
        savedLayoutRef.current = parsed;
        if (parsed) {
          setKeysOnly(parsed.keysOnly);
          setLineStyle(parsed.lineStyle);
          setEdgeWaypoints(parsed.edges);
          setEdgeAnchors(parsed.anchors);
        }
      } else {
        savedLayoutRef.current = {
          keysOnly: keysOnlyRef.current,
          lineStyle: lineStyleRef.current,
          positions: positionsRef.current,
          edges: edgeWaypointsRef.current,
          anchors: edgeAnchorsRef.current,
        };
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
        .filter((item): item is typeof item & { source: DiagramNode; target: DiagramNode } => Boolean(item.source && item.target))
        .map((item) => ({ ...item, key: relationKey(item.relation) })),
    [diagram, nodes]
  );
  relationKeysRef.current = new Set(relations.map((item) => item.key));
  const relationsByKeyRef = useRef<Record<string, (typeof relations)[number]>>({});
  relationsByKeyRef.current = Object.fromEntries(relations.map((item) => [item.key, item]));

  useEffect(() => {
    if (!diagram || initializedDiagramRef.current === diagram) return;
    initializedDiagramRef.current = diagram;
    pendingFitRef.current = true;
    setPositions(mergeSavedPositions(layoutDiagram(diagram, nodes), savedLayoutRef.current?.positions ?? {}, nodes));
  }, [diagram, nodes]);

  const reorganize = () => {
    if (!diagram) return;
    pendingFitRef.current = true;
    setEdgeAnchors({});
    setEdgeWaypoints({});
    setSelectedEdge(null);
    setPositions(layoutDiagram(diagram, nodes));
    scheduleSave();
  };

  const changeLineStyle = (style: DiagramLineStyle) => {
    setLineStyle(style);
    scheduleSave();
  };

  const restoreAllEdges = () => {
    setEdgeAnchors({});
    setEdgeWaypoints({});
    scheduleSave();
  };

  const updateAnchor = (edgeKey: string, end: EdgeEnd, anchor: DiagramEdgeAnchors[EdgeEnd]) =>
    setEdgeAnchors((current) => {
      const { [edgeKey]: previous = {}, ...others } = current;
      const next: DiagramEdgeAnchors = { ...previous, [end]: anchor };
      if (!anchor) delete next[end];
      return next.source || next.target ? { ...others, [edgeKey]: next } : others;
    });

  const handleAnchorMouseDown = (event: React.MouseEvent, edgeKey: string, end: EdgeEnd) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    startDragging({ mode: 'anchor', edgeKey, end, moved: false, startX: event.clientX, startY: event.clientY });
  };

  const resetAnchor = (edgeKey: string, end: EdgeEnd) => {
    updateAnchor(edgeKey, end, undefined);
    scheduleSave();
  };

  const updateEdge = (edgeKey: string, change: (points: Point[]) => Point[]) =>
    setEdgeWaypoints((current) => {
      const points = change(current[edgeKey] ?? []);
      const { [edgeKey]: _previous, ...others } = current;
      return points.length ? { ...others, [edgeKey]: points } : others;
    });

  const toDiagramPoint = (clientX: number, clientY: number): Point => {
    const bounds = containerRef.current?.getBoundingClientRect();
    const { x, y, scale } = viewportRef.current;
    return { x: (clientX - (bounds?.left ?? 0) - x) / scale, y: (clientY - (bounds?.top ?? 0) - y) / scale };
  };

  const handleEdgeMouseDown = (event: React.MouseEvent, edgeKey: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedEdge(edgeKey);
  };

  const handleWaypointMouseDown = (event: React.MouseEvent, edgeKey: string, index: number) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    startDragging({
      mode: 'waypoint',
      index,
      edgeKey,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      origin: edgeWaypointsRef.current[edgeKey][index],
    });
  };

  const addWaypoint = (edgeKey: string, point: Point) => {
    const controlPoints = geometryRef.current[edgeKey]?.controlPoints;
    if (!controlPoints) return;
    const insertAt = nearestSegmentIndex(controlPoints, point);
    updateEdge(edgeKey, (points) => [...points.slice(0, insertAt), point, ...points.slice(insertAt)]);
    scheduleSave();
  };

  const removeWaypoint = (edgeKey: string, index: number) => {
    updateEdge(edgeKey, (points) => points.filter((_point, pointIndex) => pointIndex !== index));
    scheduleSave();
  };

  const straightenEdge = (edgeKey: string) => {
    updateEdge(edgeKey, () => []);
    scheduleSave();
  };

  const restoreEdgeAnchors = (edgeKey: string) => {
    setEdgeAnchors(({ [edgeKey]: _removed, ...others }) => others);
    scheduleSave();
  };

  const openEdgeMenu = (event: React.MouseEvent, edgeKey: string) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedEdge(edgeKey);
    const point = toDiagramPoint(event.clientX, event.clientY);
    const item = relationsByKeyRef.current[edgeKey];
    setEdgeMenu({
      x: event.clientX,
      y: event.clientY,
      title: item ? `${item.source.title} → ${item.target.title}` : 'Linha',
      items: [
        { label: 'Adicionar ponto aqui', icon: CirclePlus, onClick: () => addWaypoint(edgeKey, point) },
        { separator: true },
        {
          label: 'Endireitar linha',
          icon: Eraser,
          disabled: !edgeWaypointsRef.current[edgeKey]?.length,
          onClick: () => straightenEdge(edgeKey),
        },
        {
          label: 'Restaurar setas',
          icon: Undo2,
          disabled: !edgeAnchorsRef.current[edgeKey],
          onClick: () => restoreEdgeAnchors(edgeKey),
        },
      ],
    });
  };

  const openWaypointMenu = (event: React.MouseEvent, edgeKey: string, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    setEdgeMenu({
      x: event.clientX,
      y: event.clientY,
      title: 'Ponto da linha',
      items: [{ label: 'Remover ponto', icon: CircleMinus, danger: true, onClick: () => removeWaypoint(edgeKey, index) }],
    });
  };

  const openAnchorMenu = (event: React.MouseEvent, edgeKey: string, end: EdgeEnd) => {
    event.preventDefault();
    event.stopPropagation();
    setEdgeMenu({
      x: event.clientX,
      y: event.clientY,
      title: end === 'source' ? 'Saída da linha' : 'Seta',
      items: [
        {
          label: 'Voltar para a posição automática',
          icon: Undo2,
          disabled: !edgeAnchorsRef.current[edgeKey]?.[end],
          onClick: () => resetAnchor(edgeKey, end),
        },
      ],
    });
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
    const container = canvasElement;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (pendingFitRef.current && fitView()) pendingFitRef.current = false;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitView, canvasElement]);

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
    const container = canvasElement;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
        return;
      }
      const lineScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      const horizontal = event.shiftKey ? event.deltaY || event.deltaX : event.deltaX;
      const vertical = event.shiftKey ? 0 : event.deltaY;
      setViewport((current) => ({
        ...current,
        x: current.x - horizontal * lineScale,
        y: current.y - vertical * lineScale,
      }));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomAt, canvasElement]);

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
      if (drag.mode === 'anchor') {
        if (!drag.moved && Math.abs(deltaX) + Math.abs(deltaY) <= 3) return;
        drag.moved = true;
        const item = relationsByKeyRef.current[drag.edgeKey];
        const node = drag.end === 'source' ? item?.source : item?.target;
        const position = node && positionsRef.current[node.key];
        if (!item || !node || !position) return;
        const column = drag.end === 'source' ? item.relation.sourceColumns[0] : item.relation.targetColumns[0];
        const pointer = toDiagramPoint(event.clientX, event.clientY);
        updateAnchor(drag.edgeKey, drag.end, anchorFromPointer(node, position, pointer, column, viewportRef.current.scale));
        return;
      }
      if (drag.mode === 'waypoint') {
        if (!drag.moved && Math.abs(deltaX) + Math.abs(deltaY) <= 3) return;
        drag.moved = true;
        const { scale } = viewportRef.current;
        const point = { x: drag.origin.x + deltaX / scale, y: drag.origin.y + deltaY / scale };
        const controlPoints = geometryRef.current[drag.edgeKey]?.controlPoints ?? [];
        const neighbors = [controlPoints[drag.index], controlPoints[drag.index + 2]].filter(Boolean);
        const snapped = snapToNeighbors(point, neighbors, scale);
        updateEdge(drag.edgeKey, (points) => points.map((existing, index) => (index === drag.index ? snapped : existing)));
        return;
      }
      if (!drag.moved && Math.abs(deltaX) + Math.abs(deltaY) > 3) {
        drag.moved = true;
        setDraggingKey(drag.key);
      }
      const { scale } = viewportRef.current;
      const moveX = deltaX / scale;
      const moveY = deltaY / scale;
      setPositions((previous) => ({ ...previous, [drag.key]: { x: drag.origin.x + moveX, y: drag.origin.y + moveY } }));
      if (!drag.followers.length) return;
      setEdgeWaypoints((current) => {
        const next = { ...current };
        for (const follower of drag.followers) {
          next[follower.edgeKey] = follower.origin.map((point, index) => ({
            x: point.x + moveX * follower.weights[index],
            y: point.y + moveY * follower.weights[index],
          }));
        }
        return next;
      });
    };
    const handleUp = () => {
      const drag = dragRef.current;
      if (drag && drag.mode !== 'pan' && drag.moved) scheduleSaveRef.current();
      setDraggingKey(null);
      dragRef.current = null;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    document.body.style.cursor = state.mode === 'pan' ? 'grabbing' : state.mode === 'waypoint' ? 'crosshair' : 'move';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleNodeDragStart = useCallback((event: React.MouseEvent, key: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const origin = positionsRef.current[key];
    const followers: EdgeFollower[] = Object.values(relationsByKeyRef.current)
      .filter((item) => (item.source.key === key || item.target.key === key) && edgeWaypointsRef.current[item.key]?.length)
      .map((item) => {
        const movedEnd = item.source.key === item.target.key ? 'both' : item.source.key === key ? 'source' : 'target';
        const controlPoints = geometryRef.current[item.key]?.controlPoints ?? [];
        return { edgeKey: item.key, origin: edgeWaypointsRef.current[item.key], weights: followWeights(controlPoints, movedEnd) };
      })
      .filter((follower) => follower.weights.length === follower.origin.length);
    startDragging({ mode: 'node', key, origin, followers, moved: false, startX: event.clientX, startY: event.clientY });
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
    clone.querySelectorAll('[data-export-ignore]').forEach((element) => element.remove());
    clone.querySelectorAll('[data-edge-path]').forEach((element) => {
      element.setAttribute('stroke', palette.edge);
      element.setAttribute('stroke-width', '1.4');
      element.setAttribute('marker-end', `url(#${markerId})`);
    });
    try {
      const fileName = `${tab.title.replace(/[\\/:*?"<>|]+/g, '_')}.svg`;
      const path = await PostgresServices.saveTextFile(token, fileName, new XMLSerializer().serializeToString(clone));
      if (path) iziToast.success({ title: 'Diagrama exportado', message: path, position: 'bottomRight' });
    } catch (exportError) {
      iziToast.error({ title: 'Erro ao exportar', message: errorMessage(exportError), position: 'bottomRight' });
    }
  };

  const geometries = useMemo(() => {
    const computed: Record<string, EdgeGeometry> = {};
    for (const { key, relation, source, target } of relations) {
      const sourcePosition = positions[source.key];
      const targetPosition = positions[target.key];
      if (!sourcePosition || !targetPosition) continue;
      computed[key] = edgeGeometry({
        source,
        target,
        sourcePosition,
        targetPosition,
        style: lineStyle,
        waypoints: edgeWaypoints[key] ?? [],
        anchors: edgeAnchors[key],
        sourceColumn: relation.sourceColumns[0],
        targetColumn: relation.targetColumns[0],
      });
    }
    return computed;
  }, [relations, positions, edgeWaypoints, edgeAnchors, lineStyle]);
  geometryRef.current = geometries;

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
        <div className="flex items-center gap-0.5 ml-1 p-0.5 rounded-lg bg-gray-100 dark:bg-white/5">
          {lineStyleOptions.map(({ style, label, icon: Icon }) => (
            <button
              key={style}
              title={label}
              onClick={() => changeLineStyle(style)}
              className={`h-7 w-8 flex items-center justify-center rounded-md transition-colors ${
                lineStyle === style
                  ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
        <button
          onClick={restoreAllEdges}
          disabled={!Object.keys(edgeWaypoints).length && !Object.keys(edgeAnchors).length}
          title="Remover as dobras e devolver as setas à posição automática em todas as linhas"
          className={toolButton}
        >
          <Eraser className="w-3.5 h-3.5" /> Restaurar linhas
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

      <div ref={attachCanvas} className="flex-1 min-h-0 relative overflow-hidden select-none">
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
              setSelectedEdge(null);
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
              {relations.map(({ key, relation, source, target }) => {
                const geometry = geometries[key];
                if (!geometry) return null;
                const selected = selectedEdge === key;
                const related = Boolean(
                  highlighted && (source.key === highlighted.focusKey || target.key === highlighted.focusKey)
                );
                const active = selected || related;
                return (
                  <g key={key}>
                    <path
                      data-edge-path
                      d={geometry.path}
                      fill="none"
                      stroke={active ? palette.accent : palette.edge}
                      strokeWidth={selected ? 2.5 : related ? 2.25 : 1.4}
                      opacity={highlighted && !active ? 0.15 : active ? 1 : 0.7}
                      markerEnd={`url(#${active ? highlightMarkerId : markerId})`}
                    />
                    <path
                      data-export-ignore
                      d={geometry.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14 / viewport.scale}
                      style={{ cursor: 'pointer' }}
                      onMouseDown={(event) => handleEdgeMouseDown(event, key)}
                      onContextMenu={(event) => openEdgeMenu(event, key)}
                    >
                      <title>
                        {`${relation.name}\n${source.title} (${relation.sourceColumns.join(', ')}) → ${target.title} (${relation.targetColumns.join(', ')})\nBotão direito para adicionar ponto ou endireitar`}
                      </title>
                    </path>
                  </g>
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

              {selectedEdge &&
                (edgeWaypoints[selectedEdge] ?? []).map((point, index) => (
                  <circle
                    data-export-ignore
                    key={`${selectedEdge}:${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={5.5 / viewport.scale}
                    fill={palette.accent}
                    stroke={palette.node}
                    strokeWidth={2 / viewport.scale}
                    style={{ cursor: 'move' }}
                    onMouseDown={(event) => handleWaypointMouseDown(event, selectedEdge, index)}
                    onContextMenu={(event) => openWaypointMenu(event, selectedEdge, index)}
                  >
                    <title>Arraste para mover o ponto · botão direito para remover</title>
                  </circle>
                ))}

              {selectedEdge &&
                geometries[selectedEdge] &&
                (['source', 'target'] as EdgeEnd[]).map((end) => {
                  const controlPoints = geometries[selectedEdge].controlPoints;
                  const point = end === 'source' ? controlPoints[0] : controlPoints[controlPoints.length - 1];
                  const size = 10 / viewport.scale;
                  const custom = Boolean(edgeAnchors[selectedEdge]?.[end]);
                  return (
                    <rect
                      data-export-ignore
                      key={`${selectedEdge}:${end}`}
                      x={point.x - size / 2}
                      y={point.y - size / 2}
                      width={size}
                      height={size}
                      rx={2 / viewport.scale}
                      fill={custom ? palette.accent : palette.node}
                      stroke={palette.accent}
                      strokeWidth={2 / viewport.scale}
                      style={{ cursor: 'move' }}
                      onMouseDown={(event) => handleAnchorMouseDown(event, selectedEdge, end)}
                      onContextMenu={(event) => openAnchorMenu(event, selectedEdge, end)}
                    >
                      <title>
                        {`Arraste para mover a ${end === 'source' ? 'saída' : 'seta'} pela borda da tabela${custom ? ' · botão direito volta para o automático' : ''}`}
                      </title>
                    </rect>
                  );
                })}
            </g>
          </svg>
        )}
        {edgeMenu && (
          <ContextMenu
            x={edgeMenu.x}
            y={edgeMenu.y}
            title={edgeMenu.title}
            items={edgeMenu.items}
            onClose={() => setEdgeMenu(null)}
          />
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-gray-400 dark:text-zinc-500">
          {selectedEdge
            ? 'Botão direito na linha para adicionar um ponto · arraste os pontos e os quadradinhos das pontas para ajustar · botão direito num ponto para remover'
            : 'Botão direito numa linha para adicionar pontos · arraste uma tabela para ver as relações dela · roda rola, Ctrl+roda dá zoom · duplo clique abre as propriedades'}
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
