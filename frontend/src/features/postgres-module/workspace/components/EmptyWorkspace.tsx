import React from 'react';
import { FileCode2 } from 'lucide-react';
import { usePostgresStore } from '../../PostgresStore';
import { PostgresModuleIcon, POSTGRES_MODULE } from '../../moduleInfo';
import { connectionLabel } from '../../functions/TreatmentFunctions';

const shortcuts = [
  ['F5 / Ctrl+Enter', 'Executar (ou só a seleção)'],
  ['F7 / Shift+F7', 'Explain / Explain Analyze'],
  ['Ctrl+Espaço', 'Autocompletar tabelas e colunas'],
  ['Ctrl+S', 'Salvar a query em arquivo'],
  ['Duplo clique', 'Ver dados de tabelas e views'],
  ['Botão direito', 'Ações do objeto no explorador'],
];

const EmptyWorkspace: React.FC = () => {
  const { connections, openQueryTab } = usePostgresStore();

  return (
    <div className="absolute inset-0 overflow-auto flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center space-y-6">
        <div
          className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br ${POSTGRES_MODULE.gradient} flex items-center justify-center shadow-lg shadow-cyan-500/20`}
        >
          <PostgresModuleIcon className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhuma aba aberta</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Expanda um servidor no explorador e use o botão direito nos objetos para ver dados,
            propriedades e scripts — ou abra uma query direto:
          </p>
        </div>

        {connections.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {connections.slice(0, 4).map((connection) => (
              <button
                key={connection.id}
                onClick={() => openQueryTab({ connectionId: connection.id })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-sm font-semibold hover:bg-cyan-500/20 transition-colors"
              >
                <FileCode2 className="w-4 h-4" />
                Nova query em {connectionLabel(connection)}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {shortcuts.map(([keys, description]) => (
            <div
              key={keys}
              className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/5 px-3 py-2 text-xs"
            >
              <kbd className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 font-mono text-[11px] text-gray-700 dark:text-zinc-200 whitespace-nowrap">
                {keys}
              </kbd>
              <span className="text-gray-500 dark:text-zinc-400">{description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmptyWorkspace;
