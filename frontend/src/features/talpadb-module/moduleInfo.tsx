import React from 'react';
import { Database } from 'lucide-react';

export const TALPADB_MODULE = {
  id: 'talpadb',
  name: 'TalpaDB',
  tagline: 'PostgreSQL, SQLite e Oracle',
  gradient: 'from-cyan-500 to-cyan-700',
  textGradient: 'from-cyan-500 to-cyan-700',
  description: 'Conecte-se a bancos PostgreSQL, SQLite e Oracle, explore objetos e execute queries.',
} as const;

export const TalpadbModuleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Database className={className} strokeWidth={1.75} />
);
