import { Moon, Sun } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../../hooks/use-theme';

const ToggleThemeButton: React.FC = () => {
  const theme = useTheme();
  const [delayedTheme, setDelayedTheme] = useState(theme.theme);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDelayedTheme(theme.theme);
    }, 300);

    return () => clearTimeout(timeout);
  }, [theme.theme]);

  return (
    <button
      onClick={theme.toggleTheme}
      title={delayedTheme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      className="h-9 w-9 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100/80 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-all duration-200"
    >
      {delayedTheme === 'dark' ? (
        <Moon className="h-4 w-4 text-zinc-200" fill="currentColor" strokeWidth={1.2} />
      ) : (
        <Sun className="h-4 w-4 text-amber-500" fill="currentColor" strokeWidth={1.5} />
      )}
    </button>
  );
};

export default ToggleThemeButton;
