import { SplitDropZone, SplitLayout } from '../../../interfaces/SplitInterfaces';

export const maxSplitPanes = 4;

export const splitDropZoneLayouts: Record<SplitDropZone, { layout: SplitLayout; insertAtStart: boolean }> = {
  center: { layout: 'grid', insertAtStart: false },
  left: { layout: 'vertical', insertAtStart: true },
  top: { layout: 'horizontal', insertAtStart: true },
  right: { layout: 'vertical', insertAtStart: false },
  bottom: { layout: 'horizontal', insertAtStart: false },
};
