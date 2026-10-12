import React from 'react';
import { Database } from 'lucide-react';

// Identidade do módulo em um único lugar: troque aqui nome, descrição, ícone e cores.
export const POSTGRES_MODULE = {
  id: 'postgres',
  name: 'Postgres Manager',
  tagline: 'Administração PostgreSQL',
  description: 'Conecte-se a bancos PostgreSQL, explore objetos e execute queries.',
  gradient: 'from-cyan-500 to-cyan-700',
  textGradient: 'from-cyan-600 to-blue-600',
} as const;

export const PostgresModuleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Database className={className} strokeWidth={1.75} />
);
