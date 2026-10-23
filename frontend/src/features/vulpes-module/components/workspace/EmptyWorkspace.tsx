import React from 'react';
import { useVulpesStore } from '../../VulpesStore';
import { VULPES_MODULE, VulpesModuleIcon } from '../../moduleInfo';
import { PROTOCOLS, protocolLabels } from '../../functions/RequestDefaults';

const shortcuts = [
  ['Ctrl+S', 'Salvar a requisição'],
  ['Botão do meio', 'Fechar uma aba'],
  ['Ctrl+Enter', 'Enviar, invocar ou emitir'],
  ['{{variavel}}', 'Usar variáveis do ambiente'],
  ['Botão direito', 'Ações de coleções e pastas'],
  ['Arrastar', 'Reorganizar itens na barra lateral'],
];

const EmptyWorkspace: React.FC = () => {
  const openScratch = useVulpesStore((state) => state.openScratch);

  return (
    <div className="h-full overflow-auto flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br ${VULPES_MODULE.gradient} flex items-center justify-center shadow-lg shadow-amber-500/20`}>
          <VulpesModuleIcon className="w-9 h-9 text-white" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhuma requisição aberta</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Abra uma requisição pela barra lateral, importe uma coleção do Postman ou comece uma nova:
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {PROTOCOLS.map((protocol) => (
            <button
              key={protocol}
              type="button"
              onClick={() => openScratch(protocol)}
              className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm font-semibold hover:bg-amber-500/20 transition-colors"
            >
              {protocolLabels[protocol]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {shortcuts.map(([keys, description]) => (
            <div key={keys} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/5 px-3 py-2 text-xs">
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
