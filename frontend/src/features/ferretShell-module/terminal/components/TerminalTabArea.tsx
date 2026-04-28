import React from 'react';
import { Radio } from 'lucide-react';
import SplitLayout from './SplitLayout';
import SnapOverlay from './SnapOverlay';
import { useTerminalStore } from '../TerminalStore';

const TerminalTabArea: React.FC = () => {
    const { tabs, activeTabId, addInstanceToTab, removeInstance, broadcastActive, setBroadcastActive } = useTerminalStore();
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    const activeTab = tabs.find(t => t.id === activeTabId);

    if (tabs.length === 0 || !activeTab) return null;

    const handleSnapDrop = (layout: 'left' | 'right' | 'top' | 'bottom' | 'grid', e: React.DragEvent) => {
        const droppedTabId = e.dataTransfer.getData('tabId');
        if (!droppedTabId || droppedTabId === activeTabId) return;

        const droppedTab = tabs.find(t => t.id === droppedTabId);
        if (!droppedTab || activeTab.instances.length >= 4) return;

        const instance = droppedTab.instances[0];

        let index = activeTab.instances.length;
        let preferredLayout: 'vertical' | 'horizontal' | 'grid' = 'vertical';

        if (layout === 'left') {
            index = 0;
            preferredLayout = 'vertical';
        } else if (layout === 'right') {
            preferredLayout = 'vertical';
        } else if (layout === 'top') {
            index = 0;
            preferredLayout = 'horizontal';
        } else if (layout === 'bottom') {
            preferredLayout = 'horizontal';
        } else if (layout === 'grid') {
            preferredLayout = 'grid';
        }

        addInstanceToTab(activeTabId as string, {
            title: instance.title,
            config: instance.config,
            containerId: instance.containerId,
            containerName: instance.containerName
        }, index, preferredLayout);

        removeInstance(droppedTabId, instance.id);
        setIsDraggingOver(false);
    };

    return (
        <div
            className={`flex flex-col w-full h-full bg-zinc-950 border border-white/5 rounded-xl overflow-hidden shadow-2xl transition-all ${isDraggingOver ? 'ring-2 ring-purple-500/50' : ''}`}
            onDragEnter={() => setIsDraggingOver(true)}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (
                    e.clientX <= rect.left ||
                    e.clientX >= rect.right ||
                    e.clientY <= rect.top ||
                    e.clientY >= rect.bottom
                ) {
                    setIsDraggingOver(false);
                }
            }}
        >
            <div className="flex-1 min-h-0 bg-[#0e172a] relative">
                <SplitLayout instances={activeTab.instances} tabId={activeTab.id} />

                {activeTab.instances.length > 1 && (
                    <div className="absolute top-4 right-4 z-50">
                        <button
                            onClick={() => setBroadcastActive(!broadcastActive)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg ${broadcastActive
                                    ? 'bg-purple-500 text-white ring-2 ring-purple-500/50 shadow-purple-500/20'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-white/10'
                                }`}
                            title="Ativar/Desativar Broadcast de digitação"
                        >
                            <Radio className={`w-4 h-4 ${broadcastActive ? 'animate-pulse' : ''}`} />
                            Broadcast
                        </button>
                    </div>
                )}

                {isDraggingOver && (
                    <SnapOverlay onDrop={handleSnapDrop} />
                )}
            </div>
        </div>
    );
};

export default TerminalTabArea;
