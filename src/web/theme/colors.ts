import type { Palette } from '../types';

export const DARK: Palette = {
  bg: '#060810', surface: '#0b0d15', card: '#10131c', cardHov: '#161a26',
  border: '#1c2030', text: '#7b869c', dim: '#3a4258', bright: '#c8d0e0', white: '#e8ecf4',
  green: '#22c55e', red: '#ef4444', orange: '#eab308', blue: '#3b82f6',
  purple: '#a78bfa', cyan: '#06b6d4', pink: '#ec4899', brown: '#a0845c',
  gBg: '0d', gBo: '18', sBg: '08', sBo: '14', lBg: '#0b0d15', sh: 'rgba(0,0,0,0.5)',
  diffAddBg: 'rgba(34,197,94,0.07)', diffDelBg: 'rgba(239,68,68,0.07)',
  diffAddHi: 'rgba(34,197,94,0.25)', diffDelHi: 'rgba(239,68,68,0.25)',
};

export const LIGHT: Palette = {
  bg: '#f4f5f7', surface: '#ffffff', card: '#ffffff', cardHov: '#f0f1f4',
  border: '#dde0e6', text: '#5f6b80', dim: '#a4adc0', bright: '#2c3547', white: '#161b26',
  green: '#16a34a', red: '#dc2626', orange: '#d97706', blue: '#2563eb',
  purple: '#7c3aed', cyan: '#0891b2', pink: '#db2777', brown: '#8b6f47',
  gBg: '0d', gBo: '1c', sBg: '0a', sBo: '18', lBg: '#ffffff', sh: 'rgba(0,0,0,0.06)',
  diffAddBg: 'rgba(34,197,94,0.08)', diffDelBg: 'rgba(239,68,68,0.08)',
  diffAddHi: 'rgba(34,197,94,0.30)', diffDelHi: 'rgba(239,68,68,0.30)',
};

export const MONO = "'JetBrains Mono','Fira Code',monospace";
export const SANS = "'Inter',system-ui,sans-serif";

export function critColor(v: number): string {
  if (v >= 7.5) return 'red';
  if (v >= 5) return 'orange';
  if (v >= 3) return 'blue';
  return 'green';
}

export type PlanetShape = 'circle' | 'square' | 'diamond';

export interface BadgeInfo { i: string; c: string; shape: PlanetShape }

export const BADGE_ICONS: Record<string, BadgeInfo> = {
  controller: { i: 'C', c: 'red', shape: 'circle' },
  service: { i: 'S', c: 'orange', shape: 'diamond' },
  module: { i: 'M', c: 'brown', shape: 'square' },
  component: { i: 'Co', c: 'blue', shape: 'square' },
  model: { i: 'Mo', c: 'cyan', shape: 'circle' },
  guard: { i: 'G', c: 'orange', shape: 'diamond' },
  dto: { i: 'D', c: 'cyan', shape: 'circle' },
  interceptor: { i: 'I', c: 'orange', shape: 'diamond' },
  pipe: { i: 'P', c: 'pink', shape: 'diamond' },
  html: { i: 'H', c: 'orange', shape: 'square' },
  scss: { i: 'Sc', c: 'pink', shape: 'square' },
  css: { i: 'Cs', c: 'pink', shape: 'square' },
};

export const FLAGS = [
  { key: 'ok' as const, icon: '\u2713', label: 'OK', c: 'green' },
  { key: 'bug' as const, icon: '\u2717', label: 'Bug', c: 'red' },
  { key: 'test' as const, icon: '\u25C9', label: 'Test', c: 'orange' },
  { key: 'question' as const, icon: '?', label: 'Question', c: 'purple' },
];
