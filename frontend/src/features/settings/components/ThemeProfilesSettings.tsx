import toast from 'react-hot-toast';
import React, { useMemo, useState } from 'react';
import { Themes, useTheme } from '../../../hooks/use-theme';
import { appModules } from '../../shared/constants/AppModules';
import { useConfirmToast } from '../../shared/components/toasts/ConfirmToast';
import { useTranslation } from '../../i18n/useTranslation';
import { isSameThemeConfig, useGeneralConfigsStore } from '../store/GeneralConfigsStore';
import { Check, Moon, Pencil, Plus, RefreshCw, RotateCcw, Sun, SwatchBook, Trash2, X } from 'lucide-react';
import { ThemeProfile, ThemeProfileConfig, ThemeProfileModuleTheme } from '../../../interfaces/GeneralConfigsInterfaces';

const maxNameLength = 60;

const moduleSwatchStyle = (moduleTheme: ThemeProfileModuleTheme): React.CSSProperties => {
  if (moduleTheme.theme === 'custom') {
    const { background, primary } = moduleTheme.customTheme;
    return { background: `linear-gradient(135deg, ${background} 55%, ${primary} 55%)` };
  }
  return { backgroundColor: moduleTheme.theme === 'dark' ? '#18181b' : '#ffffff' };
};

const ProfilePreview: React.FC<{ config: ThemeProfileConfig }> = ({ config }) => {
  const { dictionary, formatMessage } = useTranslation();
  const { common, themeProfiles: profileTexts } = dictionary.preferences;
  const themeLabels = { dark: common.dark, light: common.light, custom: common.custom };
  const GlobalIcon = config.globalTheme === 'dark' ? Moon : Sun;
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={formatMessage(profileTexts.homePreview, { theme: themeLabels[config.globalTheme].toLowerCase() })}
        className="w-6 h-6 rounded-md flex items-center justify-center border border-gray-200 dark:border-white/10 text-gray-500 dark:text-zinc-400"
      >
        <GlobalIcon className="w-3.5 h-3.5" />
      </span>
      {appModules.map(module => (
        <span
          key={module.id}
          style={moduleSwatchStyle(config.modules[module.configName])}
          title={`${module.title}: ${themeLabels[config.modules[module.configName].theme].toLowerCase()}`}
          className="w-6 h-6 rounded-md border border-gray-200 dark:border-white/10"
        />
      ))}
      <span
        title={profileTexts.terminalPreview}
        style={{ backgroundColor: config.terminalTheme.colors.background, color: config.terminalTheme.colors.foreground }}
        className="h-6 px-1.5 rounded-md border border-gray-200 dark:border-white/10 font-mono text-[10px] flex items-center"
      >
        &gt;_
      </span>
      <span
        title={profileTexts.octohubPreview}
        className="h-6 w-6 rounded-md overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col"
      >
        <span className="flex-1" style={{ backgroundColor: config.octohubColors.addition }} />
        <span className="flex-1" style={{ backgroundColor: config.octohubColors.deletion }} />
      </span>
    </div>
  );
};

const ThemeProfilesSettings: React.FC = () => {
  const confirmToast = useConfirmToast();
  const { dictionary, formatMessage } = useTranslation();
  const profileTexts = dictionary.preferences.themeProfiles;
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editingName, setEditingName] = useState('');
  const { globalTheme, setGlobalTheme } = useTheme();
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const modules = useGeneralConfigsStore(state => state.modules);
  const profiles = useGeneralConfigsStore(state => state.themeProfiles);
  const octohubColors = useGeneralConfigsStore(state => state.octohubColors);
  const terminalTheme = useGeneralConfigsStore(state => state.terminalTheme);
  const applyThemeProfile = useGeneralConfigsStore(state => state.applyThemeProfile);
  const restoreDefaultThemes = useGeneralConfigsStore(state => state.restoreDefaultThemes);
  const buildThemeSnapshot = useGeneralConfigsStore(state => state.buildThemeSnapshot);
  const createThemeProfile = useGeneralConfigsStore(state => state.createThemeProfile);
  const deleteThemeProfile = useGeneralConfigsStore(state => state.deleteThemeProfile);
  const renameThemeProfile = useGeneralConfigsStore(state => state.renameThemeProfile);
  const overwriteThemeProfile = useGeneralConfigsStore(state => state.overwriteThemeProfile);

  const currentSnapshot = useMemo(
    () => buildThemeSnapshot(globalTheme),
    [buildThemeSnapshot, globalTheme, modules, octohubColors, terminalTheme],
  );
  const activeProfile = profiles.find(profile => isSameThemeConfig(profile.config, currentSnapshot));

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    if (await createThemeProfile(name, globalTheme)) {
      setNewName('');
      toast.success(formatMessage(profileTexts.saved, { name }));
    }
    setSaving(false);
  };

  const handleApply = async (profile: ThemeProfile) => {
    setApplyingId(profile.id);
    if (await applyThemeProfile(profile)) {
      setGlobalTheme(profile.config.globalTheme as Themes);
      toast.success(formatMessage(profileTexts.applied, { name: profile.name }));
    }
    setApplyingId(null);
  };

  const startRename = (profile: ThemeProfile) => {
    setEditingId(profile.id);
    setEditingName(profile.name);
  };

  const handleRename = async (profile: ThemeProfile) => {
    const name = editingName.trim();
    if (!name || name === profile.name) {
      setEditingId(null);
      return;
    }
    if (await renameThemeProfile(profile, name)) setEditingId(null);
  };

  const handleOverwrite = (profile: ThemeProfile) => {
    confirmToast({
      id: 'theme-profile-overwrite',
      title: formatMessage(profileTexts.overwritten, { name: profile.name }),
      message: formatMessage(profileTexts.overwriteConfirm, { name: profile.name }),
      onConfirm: () => overwriteThemeProfile(profile, globalTheme),
    });
  };

  const handleRestoreDefaults = () => {
    confirmToast({
      id: 'theme-profile-restore-defaults',
      title: profileTexts.restored,
      message: profileTexts.restoreConfirm,
      onConfirm: async () => {
        setRestoring(true);
        const defaultGlobalTheme = await restoreDefaultThemes();
        if (defaultGlobalTheme) setGlobalTheme(defaultGlobalTheme as Themes);
        setRestoring(false);
      },
    });
  };

  const handleDelete = (profile: ThemeProfile) => {
    confirmToast({
      id: 'theme-profile-delete',
      title: formatMessage(profileTexts.deleted, { name: profile.name }),
      message: formatMessage(profileTexts.deleteConfirm, { name: profile.name }),
      onConfirm: () => deleteThemeProfile(profile),
    });
  };

  const iconButtonClass = 'p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[16rem]">
          <h2 className="text-2xl font-bold">{profileTexts.title}</h2>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">
            {profileTexts.description}
          </p>
        </div>
        <button
          type="button"
          disabled={restoring}
          onClick={handleRestoreDefaults}
          title={profileTexts.restoreAllHint}
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" />
          {restoring ? profileTexts.restoring : profileTexts.restoreAll}
        </button>
      </header>

      <form
        onSubmit={handleCreate}
        className="flex flex-col sm:flex-row gap-3 rounded-2xl bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-white/5 p-5"
      >
        <div className="flex-1 min-w-0">
          <label htmlFor="theme-profile-name" className="text-sm font-semibold">{profileTexts.saveCurrent}</label>
          <input
            id="theme-profile-name"
            type="text"
            value={newName}
            maxLength={maxNameLength}
            placeholder={profileTexts.namePlaceholder}
            onChange={event => setNewName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <button
          type="submit"
          disabled={!newName.trim() || saving}
          className="self-end flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {profileTexts.saveProfile}
        </button>
      </form>

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-10 text-center text-gray-500 dark:text-zinc-400">
          <SwatchBook className="w-10 h-10 opacity-40" />
          <p className="text-sm">{profileTexts.empty}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {profiles.map(profile => {
            const isActive = profile.id === activeProfile?.id;
            const isEditing = profile.id === editingId;
            return (
              <li
                key={profile.id}
                className={`flex flex-col lg:flex-row lg:items-center gap-4 rounded-2xl border p-4 transition-colors ${isActive
                  ? 'bg-blue-500/5 border-blue-500/40'
                  : 'bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-white/5'}`}
              >
                <div className="flex-1 min-w-0 space-y-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editingName}
                        maxLength={maxNameLength}
                        onChange={event => setEditingName(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') handleRename(profile);
                          if (event.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800/50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button type="button" title={profileTexts.saveName} onClick={() => handleRename(profile)} className={iconButtonClass}>
                        <Check className="w-4 h-4" />
                      </button>
                      <button type="button" title={dictionary.app.common.cancel} onClick={() => setEditingId(null)} className={iconButtonClass}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-semibold truncate">{profile.name}</h3>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{profileTexts.inUse}</span>
                      )}
                    </div>
                  )}
                  <ProfilePreview config={profile.config} />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isActive || applyingId !== null}
                    onClick={() => handleApply(profile)}
                    className="mr-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {applyingId === profile.id ? profileTexts.applying : profileTexts.apply}
                  </button>
                  <button
                    type="button"
                    disabled={isActive}
                    className={iconButtonClass}
                    onClick={() => handleOverwrite(profile)}
                    title={profileTexts.overwrite}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button type="button" title={profileTexts.rename} onClick={() => startRename(profile)} className={iconButtonClass}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title={profileTexts.delete}
                    onClick={() => handleDelete(profile)}
                    className={`${iconButtonClass} hover:!text-rose-500 hover:!bg-rose-500/10`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default ThemeProfilesSettings;
