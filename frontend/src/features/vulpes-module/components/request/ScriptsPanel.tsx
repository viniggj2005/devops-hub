import React from 'react';
import { Info } from 'lucide-react';
import { fieldLabelClass } from '../editors/FormStyles';
import type { Script } from '../../../../interfaces/VulpesInterfaces';

const scriptLabels: Record<string, string> = {
  test: 'Testes (pós-resposta)',
  prerequest: 'Pré-requisição',
};

const ScriptsPanel: React.FC<{ scripts: Script[] }> = ({ scripts }) => (
  <div className="space-y-4 max-w-3xl">
    <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      Scripts importados do Postman são preservados e voltam na exportação, mas o Vulpes não os executa.
    </p>
    {scripts.map((script, index) => (
      <div key={`${script.listen}-${index}`}>
        <h4 className={fieldLabelClass}>{scriptLabels[script.listen] ?? script.listen}</h4>
        <pre className="rounded-lg bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-white/10 p-3 text-xs font-mono text-gray-700 dark:text-zinc-300 overflow-auto max-h-72 select-text">
          {script.source}
        </pre>
      </div>
    ))}
  </div>
);

export default ScriptsPanel;
