import { Box, HardDrive, Key, Network, Server, Image, LayoutDashboard, Home } from 'lucide-react';
export const navItems = [

  {
    label: 'Dashboard',
    description: 'Visão geral dos contêineres',
    to: '/docker/home',
    icon: LayoutDashboard,
  },
  {
    label: 'Networks',
    description: 'Visão das redes do docker',
    to: '/docker/networks',
    icon: Network,
  },
  {
    label: 'Volumes',
    description: 'Gerencie volumes Docker',
    to: '/docker/volumes',
    icon: HardDrive,
  },
  {
    label: 'Containers',
    description: 'Gerencie contêineres locais',
    to: '/docker/containers',
    icon: Box,
  },
  {
    label: 'Imagens Docker',
    description: 'Organize suas imagens',
    to: '/docker/images',
    icon: Image,
  },
  {
    label: 'Credenciais Docker',
    description: 'Gerencie conexões TLS do Docker',
    to: '/docker/docker-credentials',
    icon: Key,
  },
  // {
  //   label: 'Conexões SSH',
  //   description: 'Acesse servidores remotos',
  //   to: '/createConnectionForm',
  //   icon: Server,
  // },
];
