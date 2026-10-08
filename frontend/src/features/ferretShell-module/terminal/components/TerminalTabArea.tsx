import React from 'react';
import { Radio } from 'lucide-react';
import SplitLayout from './SplitLayout';
import SnapOverlay from './SnapOverlay';
import { maxInstancesPerTab, useTerminalStore } from '../TerminalStore';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';

const TerminalTabArea: React.FC = () => {
    const tabs = useTerminalStore(state => state.tabs);
    const activeTabId = useTerminalStore(state => state.activeTabId);
    const mergeTabInto = useTerminalStore(state => state.mergeTabInto);
    const draggingTabId = useTerminalStore(state => state.draggingTabId);
    const broadcastActive = useTerminalStore(state => state.broadcastActive);
    const setDraggingTabId = useTerminalStore(state => state.setDraggingTabId);
    const setBroadcastActive = useTerminalStore(state => state.setBroadcastActive);
    const terminalBackground = useGeneralConfigsStore(state => state.terminalTheme.colors.background);

    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const draggedTab = tabs.find(tab => tab.id === draggingTabId);

    if (!activeTab) return null;

    const isDraggingOtherTab = Boolean(draggedTab) && draggedTab?.id !== activeTab.id;
    const resultingCount = activeTab.instances.length + (draggedTab?.instances.length ?? 0);

    return (
        <div className="flex flex-col w-full h-full bg-zinc-950 border border-white/5 rounded-xl overflow-hidden shadow-2xl">
            <div style={{ backgroundColor: terminalBackground }} className="flex-1 min-h-0 relative">
                {tabs.map(tab => (
                    <div key={tab.id} className={`absolute inset-0 ${tab.id === activeTab.id ? 'block' : 'hidden'}`}>
                        <SplitLayout tab={tab} />
                    </div>
                ))}

                {activeTab.instances.length > 1 && (
                    <div className="absolute bottom-4 right-4 z-40">
                        <button
                            onClick={() => setBroadcastActive(!broadcastActive)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg ${broadcastActive
                                    ? 'bg-purple-500 text-white ring-2 ring-purple-500/50 shadow-purple-500/20'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-white/10'
                                }`}
                            title="Digitar em todos os terminais desta tela ao mesmo tempo"
                        >
                            <Radio className={`w-4 h-4 ${broadcastActive ? 'animate-pulse' : ''}`} />
                            Broadcast
                        </button>
                    </div>
                )}

                {isDraggingOtherTab && draggedTab && (
                    <SnapOverlay
                        draggedTitle={draggedTab.title}
                        resultingCount={resultingCount}
                        onCancel={() => setDraggingTabId(null)}
                        canDrop={resultingCount <= maxInstancesPerTab}
                        onDrop={dropZone => mergeTabInto(draggedTab.id, activeTab.id, dropZone)}
                    />
                )}
            </div>
        </div>
    );
};

export default TerminalTabArea;
