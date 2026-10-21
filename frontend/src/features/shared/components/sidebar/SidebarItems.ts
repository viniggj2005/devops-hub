import { Box, HardDrive, Image, Key, LayoutDashboard, Network } from 'lucide-react';

export const navItems = [
  {
    to: '/docker/home',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Visão geral do daemon',
  },
  {
    icon: Box,
    label: 'Containers',
    to: '/docker/containers',
    description: 'Gerencie contêineres',
  },
  {
    icon: Image,
    label: 'Imagens',
    to: '/docker/images',
    description: 'Organize suas imagens',
  },
  {
    label: 'Volumes',
    icon: HardDrive,
    to: '/docker/volumes',
    description: 'Gerencie volumes Docker',
  },
  {
    icon: Network,
    label: 'Redes',
    to: '/docker/networks',
    description: 'Redes do ambiente',
  },
  {
    icon: Key,
    label: 'Credenciais',
    to: '/docker/credentials',
    description: 'Conexões TLS',
  },
];
