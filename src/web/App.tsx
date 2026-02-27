import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ScanResponse, FocusTarget } from './types';
import { DARK, LIGHT, SANS } from './theme/colors';
import { useReview } from './hooks/useReview';
import { useFocusHistory } from './interactions/useFocusHistory';
import { useMethodHighlight } from './interactions/useMethodHighlight';
import { Header } from './ui/Header';
import { Canvas } from './canvas/Canvas';
import { SidePanel } from './detail/SidePanel';
import { flattenPlanets } from './utils/geometry';

export default function App() {
  const [dark, setDark] = useState(true);
  const P = dark ? DARK : LIGHT;
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { focus, setFocus, back, forward, canGoBack, canGoForward } = useFocusHistory();
  const [baseBranch, setBaseBranch] = useState('develop');
  const [panelWidth, setPanelWidth] = useState(400);
  const zoomOutRef = useRef<(() => void) | null>(null);
  const zoomToRef = useRef<((target: FocusTarget) => void) | null>(null);
  const review = useReview();
  const [highlightMethod, setHighlightMethod] = useState<{ planetId: string; methodName: string } | null>(null);
  const { highlightedPlanets, highlightedEdges } = useMethodHighlight(
    data?.edges ?? [], highlightMethod,
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(`/api/scan?base=${encodeURIComponent(baseBranch)}`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => {
        if (e.name !== 'AbortError') { setError(e.message); setLoading(false); }
      });
    return () => ctrl.abort();
  }, [baseBranch]);

  const allPlanets = useMemo(
    () => data ? flattenPlanets(data.galaxies) : [],
    [data],
  );

  const reviewed = useMemo(
    () => allPlanets.filter(p => p.reviewed || review.flags[p.id] === 'ok').length,
    [allPlanets, review.flags],
  );

  // Zoom whenever focus changes (click, panel nav, history back/forward)
  useEffect(() => {
    if (focus) zoomToRef.current?.(focus);
  }, [focus]);

  const handleNavigate = useCallback((target: FocusTarget | null) => {
    setHighlightMethod(null);
    setFocus(target);
  }, [setFocus]);

  const handleZoomOut = useCallback(() => {
    zoomOutRef.current?.();
    handleNavigate(null);
  }, [handleNavigate]);

  const handleCanvasClick = useCallback(() => {
    handleNavigate(null);
  }, [handleNavigate]);

  const setZoomOutFn = useCallback((fn: () => void) => {
    zoomOutRef.current = fn;
  }, []);

  const setZoomToFn = useCallback((fn: (target: FocusTarget) => void) => {
    zoomToRef.current = fn;
  }, []);

  if (loading) {
    return (
      <div style={{
        background: P.bg, color: P.cyan, fontFamily: SANS,
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 14, letterSpacing: 2 }}>&#9670; REVU — scanning repos...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        background: P.bg, color: P.red, fontFamily: SANS,
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8,
      }}>
        <span style={{ fontSize: 14, letterSpacing: 2 }}>&#9670; REVU — error</span>
        <span style={{ fontSize: 11, color: P.dim }}>{error || 'No data'}</span>
      </div>
    );
  }

  if (data.galaxies.length === 0) {
    return (
      <div style={{
        background: P.bg, color: P.dim, fontFamily: SANS,
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8,
      }}>
        <span style={{ fontSize: 14, letterSpacing: 2, color: P.cyan }}>&#9670; REVU</span>
        <span style={{ fontSize: 11 }}>No repos with active branches found.</span>
        <span style={{ fontSize: 9 }}>Make sure you have repos on feature branches.</span>
      </div>
    );
  }

  return (
    <div style={{
      background: P.bg, color: P.text, fontFamily: SANS,
      height: '100vh', display: 'flex', flexDirection: 'column',
    }}>
      <Header P={P} dark={dark} setDark={setDark}
        focus={focus} zoomOut={handleZoomOut}
        reviewed={reviewed} total={allPlanets.length}
        baseBranch={baseBranch} setBaseBranch={setBaseBranch}
        canGoBack={canGoBack} canGoForward={canGoForward}
        onBack={back} onForward={forward} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Canvas
          galaxies={data.galaxies} edges={data.edges} P={P}
          focus={focus} setFocus={handleNavigate}
          onCanvasClick={handleCanvasClick}
          setZoomOutFn={setZoomOutFn}
          setZoomToFn={setZoomToFn}
          archivedIds={review.archivedIds}
          highlightedPlanets={highlightedPlanets}
          highlightedEdges={highlightedEdges} />
        <SidePanel
          focus={focus} P={P}
          edges={data.edges} allPlanets={allPlanets}
          galaxies={data.galaxies}
          width={panelWidth} setWidth={setPanelWidth}
          review={review}
          onNavigate={handleNavigate}
          onMethodHighlight={setHighlightMethod} />
      </div>
    </div>
  );
}
