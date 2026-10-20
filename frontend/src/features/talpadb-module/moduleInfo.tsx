import React from 'react';
import { Database } from 'lucide-react';

// Identidade do módulo em um único lugar: troque aqui nome, descrição, ícone e cores.
export const TALPADB_MODULE = {
  id: 'talpadb',
  name: 'TalpaDB',
  tagline: 'PostgreSQL, SQLite e Oracle',
  description: 'Conecte-se a bancos PostgreSQL, SQLite e Oracle, explore objetos e execute queries.',
  gradient: 'from-cyan-500 to-cyan-700',
  textGradient: 'from-cyan-600 to-blue-600',
} as const;

export const TalpadbModuleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Database className={className} strokeWidth={1.75} />
);
