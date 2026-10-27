import React, { useEffect, useState } from 'react';
import { Cookie as CookieIcon, Loader2 } from 'lucide-react';
import Select from '../../../shared/components/forms/Select';
import { Modal } from '../../../shared/components/modals/Modal';
import type { Cookie, CookieSameSite } from '../../../../interfaces/VulpesInterfaces';
import { fieldInputClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';
import { cookieValidationError, fromDateTimeLocal, normalizeCookieDraft, toDateTimeLocal } from '../../functions/Cookies';

interface CookieEditorModalProps {
  cookie: Cookie | null;
  creating: boolean;
  onClose: () => void;
  onSave: (cookie: Cookie) => Promise<void>;
}

const sameSiteOptions: { value: CookieSameSite; label: string }[] = [
  { value: '', label: 'Não informado' },
  { value: 'Lax', label: 'Lax' },
  { value: 'Strict', label: 'Strict' },
  { value: 'None', label: 'None' },
];

const flagOptions: { key: 'hostOnly' | 'httpOnly' | 'secure'; label: string; hint: string }[] = [
  { key: 'hostOnly', label: 'Somente este host', hint: 'Não envia para subdomínios' },
  { key: 'secure', label: 'Secure', hint: 'Enviado só em HTTPS/WSS' },
  { key: 'httpOnly', label: 'HttpOnly', hint: 'Informativo; o Vulpes sempre envia' },
];

const CookieEditorModal: React.FC<CookieEditorModalProps> = ({ cookie, creating, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Cookie | null>(cookie);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(cookie);
    setError(null);
  }, [cookie]);

  if (!draft) return null;

  const update = (patch: Partial<Cookie>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    const validationError = cookieValidationError(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await onSave(normalizeCookieDraft(draft));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="md"
      isOpen
      onClose={onClose}
      title={creating ? 'Novo cookie' : 'Editar cookie'}
      description={creating ? 'Enviado nas requisições desta coleção que combinarem com domínio e path' : `${cookie?.name} · ${cookie?.domain}`}
      icon={<CookieIcon className="w-4 h-4 text-amber-500" />}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButtonClass}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar cookie
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={fieldLabelClass}>Nome</label>
            <input autoFocus spellCheck={false} value={draft.name} placeholder="session" onChange={(event) => update({ name: event.target.value })} className={`${fieldInputClass} font-mono`} />
          </div>
          <div>
            <label className={fieldLabelClass}>Domínio</label>
            <input spellCheck={false} value={draft.domain} placeholder="api.exemplo.com" onChange={(event) => update({ domain: event.target.value })} className={`${fieldInputClass} font-mono`} />
          </div>
        </div>
        <div>
          <label className={fieldLabelClass}>Valor</label>
          <textarea
            rows={3}
            spellCheck={false}
            value={draft.value}
            onChange={(event) => update({ value: event.target.value })}
            className={`${fieldInputClass} font-mono resize-y break-all`}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={fieldLabelClass}>Path</label>
            <input spellCheck={false} value={draft.path} placeholder="/" onChange={(event) => update({ path: event.target.value })} className={`${fieldInputClass} font-mono`} />
          </div>
          <div>
            <label className={fieldLabelClass}>Expira em</label>
            <input
              type="datetime-local"
              value={toDateTimeLocal(draft.expires)}
              onChange={(event) => update({ expires: fromDateTimeLocal(event.target.value) })}
              className={fieldInputClass}
            />
            <p className="mt-1 text-[10px] text-gray-400 dark:text-zinc-500">Vazio = cookie de sessão (não expira)</p>
          </div>
          <div>
            <label className={fieldLabelClass}>SameSite</label>
            <Select
              aria-label="SameSite"
              options={sameSiteOptions}
              value={draft.sameSite}
              onChange={(value) => update({ sameSite: value as CookieSameSite })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {flagOptions.map((flag) => (
            <label
              key={flag.key}
              className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 cursor-pointer hover:border-amber-500/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={draft[flag.key]}
                onChange={(event) => update({ [flag.key]: event.target.checked })}
                className="mt-0.5 accent-amber-500 cursor-pointer"
              />
              <span className="leading-tight">
                <span className="block text-xs font-semibold text-gray-800 dark:text-zinc-200">{flag.label}</span>
                <span className="block text-[10px] text-gray-400 dark:text-zinc-500">{flag.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
};

export default CookieEditorModal;
