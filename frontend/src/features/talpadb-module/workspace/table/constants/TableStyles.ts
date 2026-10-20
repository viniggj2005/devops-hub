export const headerCell = 'text-left font-semibold px-3 py-2 whitespace-nowrap';

export const bodyCell = 'px-3 py-2 align-top border-t border-gray-100 dark:border-white/5';

export const editCell = 'px-2 py-1.5 align-middle border-t border-gray-100 dark:border-white/5';

export const tableHead = 'bg-gray-50 dark:bg-white/[0.03] text-[11px] uppercase tracking-wider text-gray-400';

export const fieldClass =
  'h-8 w-full px-2 rounded-lg text-xs outline-none border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed';

export const iconButton =
  'h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

export const addButton =
  'flex items-center gap-1.5 m-2 h-8 px-3 rounded-lg text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 transition-colors';

export const rowStatusClass = {
  unchanged: '',
  new: 'bg-emerald-500/[0.07]',
  modified: 'bg-amber-500/[0.08]',
  dropped: 'bg-rose-500/[0.07] opacity-60',
};

export type RowStatus = keyof typeof rowStatusClass;
