import { Box, HardDrive, Key, Network, Server, Image, LayoutDashboard, Home } from 'lucide-react';
export const navItems = [
  {
    label: 'Início Console',
    description: 'Voltar para seleção de módulos',
    to: '/home',
    icon: Home,
  },
  {
    label: 'Dashboard',
    description: 'Visão geral dos contêineres',
    to: '/docker/home',
    icon: LayoutDashboard,
  },
  {
    label: 'Networks',
    description: 'Visão das redes do docker',
    to: '/networks',
    icon: Network,
  },
  {
    label: 'Volumes',
    description: 'Gerencie volumes Docker',
    to: '/volumes',
    icon: HardDrive,
  },
  {
    label: 'Containers',
    description: 'Gerencie contêineres locais',
    to: '/containers',
    icon: Box,
  },
  {
    label: 'Imagens Docker',
    description: 'Organize suas imagens',
    to: '/images',
    icon: Image,
  },
  {
    label: 'Credenciais Docker',
    description: 'Gerencie conexões TLS do Docker',
    to: '/docker-credentials',
    icon: Key,
  },
  {
    label: 'Conexões SSH',
    description: 'Acesse servidores remotos',
    to: '/createConnectionForm',
    icon: Server,
  },
];
