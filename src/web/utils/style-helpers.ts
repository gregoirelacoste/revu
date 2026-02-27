import type { Palette } from '../types';
import { critColor, BADGE_ICONS } from '../theme/colors';

/** Resolve a palette key to a CSS color string */
export function pc(key: string, P: Palette): string {
  return P[key as keyof Palette] as string;
}

/** Shorthand: critColor → resolved palette color */
export function critPc(crit: number, P: Palette): string {
  return pc(critColor(crit), P);
}

/** Get badge icon with fallback */
export function getBadgeIcon(type: string) {
  return BADGE_ICONS[type] ?? { i: '?', c: 'dim' };
}

/** Inline hover handlers for background color */
export function hoverBg(color: string) {
  return {
    onMouseEnter: (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = color; },
    onMouseLeave: (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; },
  };
}
