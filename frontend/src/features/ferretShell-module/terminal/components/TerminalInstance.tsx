import React, { useEffect, useRef } from 'react';
import { attachTerminalSession } from '../functions/TerminalSessions';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import { TerminalInstance as ITerminalInstance } from '../../../../interfaces/TerminalInterfaces';

interface Props {
  instance: ITerminalInstance;
}

const TerminalInstance: React.FC<Props> = ({ instance }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalBackground = useGeneralConfigsStore(state => state.terminalTheme.colors.background);

  useEffect(() => attachTerminalSession(instance, hostRef.current!), [instance]);

  return (
    <div style={{ backgroundColor: terminalBackground }} className="w-full h-full p-2 overflow-hidden">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
};

export default TerminalInstance;
