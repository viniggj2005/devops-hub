import type { Dictionary } from '../../../i18n/Languages';
import { Box, HardDrive, Image, Key, LayoutDashboard, LucideIcon, Network } from 'lucide-react';

type NavigationLabelKey = keyof Dictionary['docker']['navigation'];

export const navItems: { to: string; icon: LucideIcon; labelKey: NavigationLabelKey }[] = [
  { to: '/docker/home', icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/docker/containers', icon: Box, labelKey: 'containers' },
  { to: '/docker/images', icon: Image, labelKey: 'images' },
  { to: '/docker/volumes', icon: HardDrive, labelKey: 'volumes' },
  { to: '/docker/networks', icon: Network, labelKey: 'networks' },
  { to: '/docker/credentials', icon: Key, labelKey: 'credentials' },
];
