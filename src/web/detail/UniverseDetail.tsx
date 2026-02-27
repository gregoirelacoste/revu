import { useMemo } from 'react';
import type { GalaxyData, EdgeData, FlatPlanet, Palette, FocusTarget, ReviewState } from '../types';
import { MONO, SANS } from '../theme/colors';
import { StatBox } from '../ui/StatBox';
import { critPc, pc, hoverBg } from '../utils/style-helpers';

interface Props {
  galaxies: GalaxyData[];
  edges: EdgeData[];
  allPlanets: FlatPlanet[];
  P: Palette;
  review: ReviewState;
  onNavigate: (target: FocusTarget) => void;
}

export function UniverseDetail({ galaxies, edges, allPlanets, P, review, onNavigate }: Props) {
  const stats = useMemo(() => {
    let totalAdd = 0, totalDel = 0, maxCrit = 0, critSum = 0, untested = 0;
    for (const p of allPlanets) {
      totalAdd += p.add; totalDel += p.del;
      if (p.crit > maxCrit) maxCrit = p.crit;
      critSum += p.crit;
      if (!p.tested) untested++;
    }
    const avgCrit = allPlanets.length ? Math.round(critSum / allPlanets.length * 10) / 10 : 0;
    const crossEdges = edges.filter(e => e.cross).length;
    return { totalAdd, totalDel, maxCrit, avgCrit, crossEdges, untested };
  }, [allPlanets, edges]);

  const reviewed = useMemo(
    () => allPlanets.filter(p => p.reviewed || review.archivedIds.has(p.id)).length,
    [allPlanets, review.archivedIds],
  );

  const topCritical = useMemo(
    () => [...allPlanets].sort((a, b) => b.crit - a.crit).slice(0, 5),
    [allPlanets],
  );

  const pct = allPlanets.length ? Math.round(reviewed / allPlanets.length * 100) : 0;
  const modules = galaxies.reduce((sum, g) => sum + g.systems.length, 0);

  return (
    <div>
      {/* Header */}
      <div style={{
        padding: '14px 14px 10px', borderBottom: `1px solid ${P.border}`,
        background: `${P.cyan}06`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: `${P.cyan}88`, fontFamily: MONO, letterSpacing: 2, marginBottom: 2 }}>
          UNIVERSE
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: P.cyan, fontFamily: SANS, letterSpacing: 1 }}>
          Review Overview
        </div>
        <div style={{ fontSize: 11, color: P.dim, fontFamily: MONO, marginTop: 2 }}>
          {galaxies.length} repos · {modules} modules · {allPlanets.length} files
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
        padding: '8px 14px', borderBottom: `1px solid ${P.border}`,
      }}>
        <StatBox label="Files" value={`${allPlanets.length}`} color={P.blue} P={P} />
        <StatBox label="Changes" value={`+${stats.totalAdd} -${stats.totalDel}`} color={P.green} P={P} />
        <StatBox label="Avg Crit" value={stats.avgCrit.toFixed(1)} color={critPc(stats.avgCrit, P)} P={P} />
        <StatBox label="Max Crit" value={stats.maxCrit.toFixed(1)} color={critPc(stats.maxCrit, P)} P={P} />
        <StatBox label="Cross links" value={`${stats.crossEdges}`} color={P.cyan} P={P} />
        <StatBox label="Untested" value={`${stats.untested}`} color={stats.untested > 0 ? P.red : P.green} P={P} />
      </div>

      {/* Review progress */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${P.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: P.dim, fontFamily: MONO, letterSpacing: 1 }}>
            REVIEW PROGRESS
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: P.bright, fontFamily: MONO }}>
            {reviewed}/{allPlanets.length} ({pct}%)
          </span>
        </div>
        <div style={{
          height: 6, borderRadius: 3, background: P.border, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3, width: `${pct}%`,
            background: pct === 100 ? P.green : P.cyan,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Top critical */}
      {topCritical.length > 0 && (
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: P.dim, fontFamily: MONO, marginBottom: 6, letterSpacing: 1 }}>
            TOP CRITICAL
          </div>
          {topCritical.map(p => (
            <div key={p.id}
              onClick={() => onNavigate({ kind: 'planet', id: p.id, planet: p })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 6px', marginBottom: 2, borderRadius: 4,
                cursor: 'pointer', fontSize: 11, fontFamily: MONO,
              }}
              {...hoverBg(`${P.border}55`)}>
              <span style={{ fontWeight: 800, color: critPc(p.crit, P), fontSize: 12, width: 28 }}>
                {p.crit.toFixed(1)}
              </span>
              <span style={{ color: P.bright, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              <span style={{ color: P.dim, fontSize: 9 }}>{p.galaxy.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Galaxies list */}
      <div style={{ padding: '8px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: P.dim, fontFamily: MONO, marginBottom: 6, letterSpacing: 1 }}>
          GALAXIES ({galaxies.length})
        </div>
        {galaxies.map(g => {
          const gPlanets = allPlanets.filter(p => p.galaxy.id === g.id);
          const avgCrit = gPlanets.length
            ? Math.round(gPlanets.reduce((s, p) => s + p.crit, 0) / gPlanets.length * 10) / 10
            : 0;
          const c = pc(g.color, P);

          return (
            <div key={g.id}
              onClick={() => onNavigate({ kind: 'galaxy', id: g.id, galaxy: g })}
              style={{
                padding: '6px 8px', marginBottom: 3, borderRadius: 5,
                cursor: 'pointer', borderLeft: `3px solid ${c}`,
                background: 'transparent', transition: 'background 0.1s',
              }}
              {...hoverBg(`${P.border}44`)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: P.bright, fontFamily: MONO, flex: 1 }}>
                  {g.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: critPc(avgCrit, P), fontFamily: MONO }}>
                  {avgCrit.toFixed(1)}
                </span>
              </div>
              <div style={{ fontSize: 10, color: P.dim, fontFamily: MONO, marginTop: 2 }}>
                {gPlanets.length} files · {g.systems.length} modules · {g.branch}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
