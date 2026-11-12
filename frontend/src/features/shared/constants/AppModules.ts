import { ModuleType } from '../../appFrame/AppStore';
import { VULPES_MODULE } from '../../vulpes-module/moduleInfo';
import { TALPADB_MODULE } from '../../talpadb-module/moduleInfo';
import { AccentFamily, ConfigurableModule, CustomThemeColors } from '../../../interfaces/GeneralConfigsInterfaces';

export type AppModuleStatus = 'active' | 'beta' | 'inactive';

export interface AppModuleDefinition {
  id: ModuleType;
  icon: string;
  title: string;
  color: string;
  homePath?: string;
  accentColor: string;
  status: AppModuleStatus;
  accentFamily: AccentFamily;
  configName: ConfigurableModule;
}

export const appModules: AppModuleDefinition[] = [
  {
    id: 'docker',
    status: 'active',
    accentFamily: 'blue',
    accentColor: '#3b82f6',
    icon: '/docker-manager.svg',
    title: 'Docker Manager',
    homePath: '/docker/home',
    color: 'from-blue-500 to-blue-700',
    configName: 'docker-manager',
  },
  {
    status: 'active',
    icon: '/term.svg',
    id: 'ferretshell',
    title: 'FerretShell',
    homePath: '/term/home',
    accentFamily: 'purple',
    accentColor: '#a855f7',
    configName: 'ferretshell',
    color: 'from-purple-500 to-purple-700',
  },
  {
    id: 'octohub',
    status: 'active',
    title: 'OctoHub',
    configName: 'octohub',
    icon: '/gitoctocat.svg',
    accentColor: '#10b981',
    homePath: '/octohub/home',
    accentFamily: 'emerald',
    color: 'from-emerald-500 to-emerald-700',
  },
  {
    id: 'talpadb',
    status: 'active',
    accentFamily: 'cyan',
    accentColor: '#06b6d4',
    title: TALPADB_MODULE.name,
    color: TALPADB_MODULE.gradient,
    configName: 'talpadb',
    icon: '/talpadb.svg',
  },
  {
    id: 'vulpes',
    icon: '/fox.svg',
    status: 'active',
    configName: 'vulpes',
    accentFamily: 'amber',
    accentColor: '#f59e0b',
    title: VULPES_MODULE.name,
    color: VULPES_MODULE.gradient,
  },
];

export const activeAppModules = appModules.filter(module => module.status === 'active');

export const moduleByConfigName = Object.fromEntries(
  appModules.map(module => [module.configName, module]),
) as Record<ConfigurableModule, AppModuleDefinition>;

export const configNameByModuleType: Partial<Record<ModuleType, ConfigurableModule>> = Object.fromEntries(
  appModules.map(module => [module.id, module.configName]),
);

export const defaultCustomTheme = (moduleName: ConfigurableModule): CustomThemeColors => ({
  base: 'dark',
  text: '#fafafa',
  background: '#09090b',
  primary: moduleByConfigName[moduleName].accentColor,
});
