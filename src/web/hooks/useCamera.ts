import { useState, useCallback, useRef, useEffect } from 'react';
import type { FlatPlanet } from '../types';

interface Camera { x: number; y: number; s: number }

const INITIAL_CAM: Camera = { x: 80, y: 20, s: 0.35 };
const ZOOM_IN_FACTOR = 1.12;
const ZOOM_OUT_FACTOR = 0.89;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3.5;
const FOCUS_SCALE = 2;
const FOCUS_Y_OFFSET = -40;

export function useCamera() {
  const ref = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>(INITIAL_CAM);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const camRef = useRef(cam);
  camRef.current = cam;

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const f = e.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
    setCam(c => {
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, c.s * f));
      const wx = (mx - c.x) / c.s;
      const wy = (my - c.y) / c.s;
      return { x: mx - wx * ns, y: my - wy * ns, s: ns };
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-clickable]')) {
      setDrag({ x: e.clientX - camRef.current.x, y: e.clientY - camRef.current.y });
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (d) setCam(c => ({ ...c, x: e.clientX - d.x, y: e.clientY - d.y }));
  }, []);

  const onMouseUp = useCallback(() => setDrag(null), []);

  const zoomTo = useCallback((planet: FlatPlanet) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setCam({
      x: rect.width / 2 - planet.ax * FOCUS_SCALE,
      y: rect.height / 2 - planet.ay * FOCUS_SCALE + FOCUS_Y_OFFSET,
      s: FOCUS_SCALE,
    });
  }, []);

  const zoomOut = useCallback(() => setCam(INITIAL_CAM), []);

  return {
    ref, cam, drag,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
    zoomTo, zoomOut,
  };
}
