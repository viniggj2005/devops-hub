import { ModuleType } from '../../appFrame/AppStore';
import { TALPADB_MODULE } from '../../talpadb-module/moduleInfo';
import { AccentFamily, ConfigurableModule, CustomThemeColors } from '../../../interfaces/GeneralConfigsInterfaces';

export interface AppModuleDefinition {
  id: ModuleType;
  icon: string;
  title: string;
  color: string;
  homePath?: string;
  description: string;
  accentColor: string;
  accentFamily: AccentFamily;
  configName: ConfigurableModule;
  status: 'Ativo' | 'Beta' | 'Inativo';
}

export const appModules: AppModuleDefinition[] = [
  {
    id: 'docker',
    status: 'Ativo',
    accentFamily: 'blue',
    accentColor: '#3b82f6',
    icon: '/docker-manager.svg',
    title: 'Docker Manager',
    homePath: '/docker/home',
    color: 'from-blue-500 to-blue-700',
    configName: 'docker-manager',
    description: 'Gerencie contêineres, imagens, redes e volumes Docker.',
  },
  {
    status: 'Ativo',
    icon: '/term.svg',
    id: 'ferretshell',
    title: 'FerretShell',
    homePath: '/term/home',
    accentFamily: 'purple',
    accentColor: '#a855f7',
    configName: 'ferretshell',
    color: 'from-purple-500 to-purple-700',
    description: 'Acesse e gerencie seus servidores remotos via terminal SSH.',
  },
  {
    id: 'octohub',
    status: 'Ativo',
    title: 'OctoHub',
    configName: 'octohub',
    icon: '/gitoctocat.svg',
    accentColor: '#10b981',
    homePath: '/octohub/home',
    accentFamily: 'emerald',
    color: 'from-emerald-500 to-emerald-700',
    description: 'Configurações de acesso, chaves SSH e certificados TLS.',
  },
  {
    id: 'talpadb',
    status: 'Ativo',
    accentFamily: 'cyan',
    accentColor: '#06b6d4',
    title: TALPADB_MODULE.name,
    color: TALPADB_MODULE.gradient,
    configName: 'talpadb',
    icon: '/talpadb.svg',
    description: TALPADB_MODULE.description,
  },
  {
    id: 'vulpes',
    icon: '/fox.svg',
    title: 'Vulpes',
    status: 'Inativo',
    configName: 'vulpes',
    accentFamily: 'amber',
    accentColor: '#f59e0b',
    color: 'from-amber-500 to-amber-700',
    description: 'Visualize o uso de recursos e logs do sistema em tempo real.',
  },
];

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
