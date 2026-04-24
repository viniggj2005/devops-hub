import React from 'react';
import { classState } from '../../../../../features/shared/functions/TreatmentFunction';

const StatusBadge: React.FC<{ state: string; title?: string }> = ({ state, title }) => (
  <span
    className={`px-2 py-0.5 rounded text-xs ${classState(state)}`}
    title={title || state}
  >
    {state}
  </span>
);

export default StatusBadge;
