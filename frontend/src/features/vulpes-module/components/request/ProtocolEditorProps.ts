import type { VariableMap } from '../../functions/Variables';
import type { RequestTab, Script, TabRuntime } from '../../../../interfaces/VulpesInterfaces';

export interface ProtocolEditorProps {
  tab: RequestTab;
  scripts: Script[];
  runtime: TabRuntime;
  onSave: () => void;
  variables: VariableMap;
  inheritedHint: string;
}
