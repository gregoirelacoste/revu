import { useState, useMemo } from 'react';
import type { GalaxyData, Palette, FlatPlanet, EdgeData, FocusTarget, ReviewState } from '../types';
import { MONO, SANS } from '../theme/colors';
import { StatBox } from '../ui/StatBox';
import { TabButton } from '../ui/TabButton';
import { critPc, pc, hoverBg } from '../utils/style-helpers';

interface Props {
  galaxy: GalaxyData;
  P: Palette;
  review: ReviewState;
  edges: EdgeData[];
  allPlanets: FlatPlanet[];
  onNavigate: (target: FocusTarget) => void;
}

export function GalaxyDetail({ galaxy: g, P, review, edges, allPlanets, onNavigate }: Props) {
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const c = pc(g.color, P);

  const galaxyPlanets = useMemo(
    () => allPlanets.filter(p => p.galaxy.id === g.id),
    [allPlanets, g.id],
  );

  const activePlanets = useMemo(
    () => galaxyPlanets.filter(p => !review.archivedIds.has(p.id)),
    [galaxyPlanets, review.archivedIds],
  );

  const donePlanets = useMemo(
    () => galaxyPlanets.filter(p => review.archivedIds.has(p.id)),
    [galaxyPlanets, review.archivedIds],
  );

  const stats = useMemo(() => {
    let totalAdd = 0, totalDel = 0, maxCrit = 0, critSum = 0;
    for (const p of galaxyPlanets) {
      totalAdd += p.add; totalDel += p.del;
      if (p.crit > maxCrit) maxCrit = p.crit;
      critSum += p.crit;
    }
    const avgCrit = galaxyPlanets.length ? Math.round(critSum / galaxyPlanets.length * 10) / 10 : 0;
    const crossEdges = edges.filter(e => {
      const from = allPlanets.find(p => p.id === e.from);
      const to = allPlanets.find(p => p.id === e.to);
      return (from?.galaxy.id === g.id) !== (to?.galaxy.id === g.id);
    });
    return { totalAdd, totalDel, maxCrit, avgCrit, crossEdges: crossEdges.length };
  }, [galaxyPlanets, edges, allPlanets, g.id]);

  const visiblePlanets = tab === 'active' ? activePlanets : donePlanets;

  return (
    <div>
      <GalaxyHeader g={g} c={c} P={P} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
        padding: '8px 14px', borderBottom: `1px solid ${P.border}`,
      }}>
        <StatBox label="Files" value={`${galaxyPlanets.length}`} color={c} P={P} />
        <StatBox label="Changes" value={`+${stats.totalAdd} -${stats.totalDel}`} color={P.green} P={P} />
        <StatBox label="Avg Crit" value={stats.avgCrit.toFixed(1)} color={critPc(stats.avgCrit, P)} P={P} />
        <StatBox label="Max Crit" value={stats.maxCrit.toFixed(1)} color={critPc(stats.maxCrit, P)} P={P} />
        <StatBox label="Systems" value={`${g.systems.length}`} color={P.blue} P={P} />
        <StatBox label="Cross links" value={`${stats.crossEdges}`} color={P.cyan} P={P} />
      </div>

      <SystemsList g={g} galaxyPlanets={galaxyPlanets} P={P} onNavigate={onNavigate} />

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

function GalaxyHeader({ g, c, P }: { g: GalaxyData; c: string; P: Palette }) {
  return (
    <div style={{
      padding: '14px 14px 10px', borderBottom: `1px solid ${P.border}`,
      background: `${c}06`,
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: `${c}88`, fontFamily: MONO, letterSpacing: 2, marginBottom: 2 }}>
        GALAXY
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: c, fontFamily: SANS, letterSpacing: 1 }}>
        {g.label}
      </div>
      <div style={{ fontSize: 9, color: P.dim, fontFamily: MONO, marginTop: 2 }}>
        branch: {g.branch}
      </div>
    </div>
  );
}

function SystemsList({ g, galaxyPlanets, P, onNavigate }: {
  g: GalaxyData; galaxyPlanets: FlatPlanet[]; P: Palette;
  onNavigate: (target: FocusTarget) => void;
}) {
  return (
    <div style={{ padding: '8px 14px', borderBottom: `1px solid ${P.border}` }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: P.dim, fontFamily: MONO, marginBottom: 6, letterSpacing: 1 }}>
        SYSTEMS ({g.systems.length})
      </div>
      {g.systems.map(s => {
        const sysPlanets = galaxyPlanets.filter(p => p.system.id === s.id);
        const sysCrit = sysPlanets.length
          ? Math.round(sysPlanets.reduce((sum, p) => sum + p.crit, 0) / sysPlanets.length * 10) / 10
          : 0;
        const sc = critPc(sysCrit, P);
        const sysAdd = sysPlanets.reduce((sum, p) => sum + p.add, 0);
        const sysDel = sysPlanets.reduce((sum, p) => sum + p.del, 0);

        return (
          <div key={s.id}
            onClick={() => onNavigate({ kind: 'system', id: s.id, system: s, galaxy: g })}
            style={{
              padding: '6px 8px', marginBottom: 3, borderRadius: 5,
              cursor: 'pointer', borderLeft: `3px solid ${sc}`,
              background: 'transparent', transition: 'background 0.1s',
            }}
            {...hoverBg(`${P.border}44`)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: P.bright, fontFamily: MONO, flex: 1 }}>
                {s.label}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color: sc, fontFamily: MONO }}>
                {sysCrit.toFixed(1)}
              </span>
            </div>
            <div style={{ fontSize: 8, color: P.dim, fontFamily: MONO, marginTop: 2 }}>
              {sysPlanets.length} files · <span style={{ color: P.green }}>+{sysAdd}</span> <span style={{ color: P.red }}>-{sysDel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlanetsList({ planets, tab, P, onNavigate }: {
  planets: FlatPlanet[]; tab: string; P: Palette;
  onNavigate: (target: FocusTarget) => void;
}) {
  return (
    <div style={{ padding: '8px 14px' }}>
      {[...planets].sort((a, b) => b.crit - a.crit).slice(0, 20).map(p => (
        <div key={p.id}
          onClick={() => onNavigate({ kind: 'planet', id: p.id, planet: p })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 6px', marginBottom: 1, borderRadius: 4,
            cursor: 'pointer', fontSize: 9, fontFamily: MONO,
          }}
          {...hoverBg(`${P.border}44`)}>
          <span style={{ fontWeight: 800, color: critPc(p.crit, P), fontSize: 10, width: 28 }}>
            {p.crit.toFixed(1)}
          </span>
          <span style={{ color: P.bright, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </span>
          <span style={{ color: P.dim, fontSize: 7 }}>{p.type}</span>
        </div>
      ))}
      {planets.length === 0 && (
        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 9, color: P.dim, fontFamily: MONO }}>
          {tab === 'active' ? 'All files reviewed' : 'No reviewed files yet'}
        </div>
      )}
    </div>
  );
}
