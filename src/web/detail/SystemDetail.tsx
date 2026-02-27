import { useState, useMemo } from 'react';
import type { SystemData, GalaxyData, Palette, FlatPlanet, EdgeData, FocusTarget, ReviewState } from '../types';
import { MONO, SANS } from '../theme/colors';
import { StatBox } from '../ui/StatBox';
import { TabButton } from '../ui/TabButton';
import { critPc, pc, getBadgeIcon, hoverBg } from '../utils/style-helpers';

interface Props {
  system: SystemData;
  galaxy: GalaxyData;
  P: Palette;
  review: ReviewState;
  edges: EdgeData[];
  allPlanets: FlatPlanet[];
  onNavigate: (target: FocusTarget) => void;
}

export function SystemDetail({ system: s, galaxy: g, P, review, edges, allPlanets, onNavigate }: Props) {
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const c = pc(g.color, P);

  const sysPlanets = useMemo(
    () => allPlanets.filter(p => p.system.id === s.id && p.galaxy.id === g.id),
    [allPlanets, s.id, g.id],
  );

  const activePlanets = useMemo(
    () => sysPlanets.filter(p => !review.archivedIds.has(p.id)),
    [sysPlanets, review.archivedIds],
  );

  const donePlanets = useMemo(
    () => sysPlanets.filter(p => review.archivedIds.has(p.id)),
    [sysPlanets, review.archivedIds],
  );

  const stats = useMemo(() => {
    let totalAdd = 0, totalDel = 0, maxCrit = 0, critSum = 0;
    const untestedCount = sysPlanets.filter(p => !p.tested).length;
    for (const p of sysPlanets) {
      totalAdd += p.add; totalDel += p.del;
      if (p.crit > maxCrit) maxCrit = p.crit;
      critSum += p.crit;
    }
    const avgCrit = sysPlanets.length ? Math.round(critSum / sysPlanets.length * 10) / 10 : 0;
    const sysIds = new Set(sysPlanets.map(p => p.id));
    const extEdges = edges.filter(e =>
      (sysIds.has(e.from) && !sysIds.has(e.to)) ||
      (sysIds.has(e.to) && !sysIds.has(e.from)),
    );
    return { totalAdd, totalDel, maxCrit, avgCrit, untestedCount, extEdges: extEdges.length };
  }, [sysPlanets, edges]);

  const visiblePlanets = tab === 'active' ? activePlanets : donePlanets;

  return (
    <div>
      <SystemHeader s={s} g={g} c={c} P={P} onNavigate={onNavigate} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
        padding: '8px 14px', borderBottom: `1px solid ${P.border}`,
      }}>
        <StatBox label="Files" value={`${sysPlanets.length}`} color={c} P={P} />
        <StatBox label="Changes" value={`+${stats.totalAdd} -${stats.totalDel}`} color={P.green} P={P} />
        <StatBox label="Avg Crit" value={stats.avgCrit.toFixed(1)} color={critPc(stats.avgCrit, P)} P={P} />
        <StatBox label="Max Crit" value={stats.maxCrit.toFixed(1)} color={critPc(stats.maxCrit, P)} P={P} />
        <StatBox label="Untested" value={`${stats.untestedCount}`} color={stats.untestedCount > 0 ? P.red : P.green} P={P} />
        <StatBox label="Ext links" value={`${stats.extEdges}`} color={P.cyan} P={P} />
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${P.border}` }}>
        <TabButton label="Active" count={activePlanets.length} active={tab === 'active'}
          onClick={() => setTab('active')} P={P} />
        <TabButton label="Done" count={donePlanets.length} active={tab === 'done'}
          onClick={() => setTab('done')} P={P} />
      </div>

      <PlanetsList planets={visiblePlanets} tab={tab} P={P} onNavigate={onNavigate} />
    </div>
  );
}

function SystemHeader({ s, g, c, P, onNavigate }: {
  s: SystemData; g: GalaxyData; c: string; P: Palette;
  onNavigate: (target: FocusTarget) => void;
}) {
  return (
    <div style={{
      padding: '14px 14px 10px', borderBottom: `1px solid ${P.border}`,
      background: `${c}06`,
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: `${c}88`, fontFamily: MONO, letterSpacing: 2, marginBottom: 2 }}>
        SYSTEM
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: P.white, fontFamily: MONO }}>
        {s.label}
      </div>
      <div onClick={() => onNavigate({ kind: 'galaxy', id: g.id, galaxy: g })}
        style={{
          fontSize: 9, color: c, fontFamily: MONO, marginTop: 2,
          cursor: 'pointer', textDecoration: 'underline',
        }}>
        &#8592; {g.label}
      </div>
    </div>
  );
}

function PlanetsList({ planets, tab, P, onNavigate }: {
  planets: FlatPlanet[]; tab: string; P: Palette;
  onNavigate: (target: FocusTarget) => void;
}) {
  return (
    <div style={{ padding: '8px 14px' }}>
      {[...planets].sort((a, b) => b.crit - a.crit).map(p => {
        const pCrit = critPc(p.crit, P);
        const pIc = getBadgeIcon(p.type);
        const pIconC = pc(pIc.c, P);

        return (
          <div key={p.id}
            onClick={() => onNavigate({ kind: 'planet', id: p.id, planet: p })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 6px', marginBottom: 2, borderRadius: 5,
              cursor: 'pointer', borderLeft: `3px solid ${pCrit}`,
              transition: 'background 0.1s',
            }}
            {...hoverBg(`${P.border}44`)}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              background: `${pIconC}15`, border: `1px solid ${pIconC}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 6, fontWeight: 800, color: pIconC, fontFamily: MONO,
            }}>{pIc.i}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: P.bright, fontFamily: MONO,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.name}<span style={{ color: P.dim, fontWeight: 400 }}>{p.ext}</span>
              </div>
              <div style={{ fontSize: 7.5, color: P.dim, fontFamily: MONO, marginTop: 1 }}>
                <span style={{ color: P.green }}>+{p.add}</span>{' '}
                <span style={{ color: P.red }}>-{p.del}</span>
                {!p.tested && <span style={{ color: P.red, marginLeft: 4 }}>untested</span>}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: pCrit, fontFamily: MONO }}>
              {p.crit.toFixed(1)}
            </span>
          </div>
        );
      })}
      {planets.length === 0 && (
        <div style={{
          padding: '16px 0', textAlign: 'center',
          fontSize: 9, color: P.dim, fontFamily: MONO,
        }}>
          {tab === 'active' ? 'All files reviewed' : 'No reviewed files yet'}
        </div>
      )}
    </div>
  );
}
