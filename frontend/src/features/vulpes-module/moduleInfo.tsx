import React from 'react';

export const VULPES_MODULE = {
  id: 'vulpes',
  name: 'Vulpes',
  tagline: 'HTTP, gRPC, WebSocket e Socket.IO',
  gradient: 'from-amber-500 to-amber-700',
  textGradient: 'from-amber-500 to-amber-700',
  description: 'Cliente de APIs no estilo Postman: coleções, ambientes e requisições HTTP, gRPC, WebSocket e Socket.IO.',
} as const;

const foxMaskStyle: React.CSSProperties = {
  maskSize: 'contain',
  maskPosition: 'center',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
  maskImage: 'url(/fox.svg)',
  WebkitMaskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskImage: 'url(/fox.svg)',
};

export const VulpesModuleIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span aria-hidden="true" style={foxMaskStyle} className={`inline-block shrink-0 bg-current ${className}`} />
);
