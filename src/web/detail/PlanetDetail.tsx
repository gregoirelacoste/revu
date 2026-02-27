import { useState, useMemo, useCallback } from 'react';
import type { FlatPlanet, Palette, EdgeData, FocusTarget, ReviewState, MethodData } from '../types';
import { MONO, SANS, FLAGS } from '../theme/colors';
import { TabButton } from '../ui/TabButton';
import { critPc, pc, getBadgeIcon, hoverBg } from '../utils/style-helpers';
import { MethodRow } from './MethodRow';

interface Props {
  planet: FlatPlanet;
  P: Palette;
  review: ReviewState;
  edges: EdgeData[];
  allPlanets: FlatPlanet[];
  onNavigate: (target: FocusTarget) => void;
  onMethodHighlight?: (h: { planetId: string; methodName: string } | null) => void;
}

export function PlanetDetail({ planet, P, review, edges, allPlanets, onNavigate, onMethodHighlight }: Props) {
  const [expM, setExpM] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const ic = getBadgeIcon(planet.type);
  const color = critPc(planet.crit, P);
  const iconC = pc(ic.c, P);
  const flag = review.flags[planet.id] ?? null;

  const allItems = useMemo(() =>
    [...(planet.methods ?? []), ...(planet.constants ?? [])]
      .sort((a, b) => b.crit - a.crit),
    [planet.methods, planet.constants],
  );

  const changedItems = useMemo(() =>
    allItems.filter(m => m.status !== 'unch' || m.impacted),
    [allItems],
  );

  const unchangedItems = useMemo(() =>
    allItems.filter(m => m.status === 'unch' && !m.impacted),
    [allItems],
  );

  const activeItems = useMemo(() =>
    changedItems.filter(m => review.flags[`${planet.id}:${m.name}`] == null),
    [changedItems, planet.id, review.flags],
  );

  const doneItems = useMemo(() =>
    changedItems.filter(m => review.flags[`${planet.id}:${m.name}`] != null),
    [changedItems, planet.id, review.flags],
  );

  const maxU = Math.max(...allItems.map(m => m.usages || 1), 1);
  const newFn = changedItems.filter(m => m.status === 'new' && !m.isType).length;
  const modFn = changedItems.filter(m => m.status === 'mod').length;
  const sigC = changedItems.filter(m => m.sigChanged).length;

  const linked = useMemo(() => {
    const ids = new Set<string>();
    for (const e of edges) {
      if (e.from === planet.id) ids.add(e.to);
      if (e.to === planet.id) ids.add(e.from);
    }
    return allPlanets.filter(p => ids.has(p.id));
  }, [edges, planet.id, allPlanets]);

  const handleMethodClick = useCallback((name: string) => {
    onMethodHighlight?.(name ? { planetId: planet.id, methodName: name } : null);
  }, [planet.id, onMethodHighlight]);

  const visibleItems = tab === 'active' ? activeItems : doneItems;

  return (
    <div>
      <PlanetHeader planet={planet} ic={ic} iconC={iconC} color={color} P={P}
        newFn={newFn} modFn={modFn} sigC={sigC} />

      <div style={{ display: 'flex', borderBottom: `1px solid ${P.border}` }}>
        <TabButton label="Active" count={activeItems.length} active={tab === 'active'}
          onClick={() => setTab('active')} P={P} />
        <TabButton label="Done" count={doneItems.length} active={tab === 'done'}
          onClick={() => setTab('done')} P={P} />
      </div>

      <div>
        {visibleItems.map(item => {
          const mId = `${planet.id}:${item.name}`;
          return (
            <MethodRow key={item.name} item={item}
              isMethod={planet.methods?.some(m => m.name === item.name) ?? false}
              planetId={planet.id} maxUsages={maxU} P={P}
              isExpanded={expM === mId}
              onToggle={() => setExpM(expM === mId ? null : mId)}
              onMethodClick={handleMethodClick}
              flags={review.flags} comments={review.comments} actions={review.actions}
              toggleFlag={review.toggleFlag} addComment={review.addComment}
              addAction={review.addAction} toggleAction={review.toggleAction} />
          );
        })}
        {visibleItems.length === 0 && changedItems.length === 0 && (
          <div style={{
            padding: '14px 14px', textAlign: 'center',
            fontSize: 11, color: P.dim, fontFamily: MONO,
          }}>
            No method changes &mdash; diff is in imports, comments or structure
            {(planet.add > 0 || planet.del > 0) && (
              <div style={{ marginTop: 4, fontSize: 10 }}>
                <span style={{ color: P.green }}>+{planet.add}</span>{' '}
                <span style={{ color: P.red }}>-{planet.del}</span> lines
              </div>
            )}
          </div>
        )}
        {visibleItems.length === 0 && changedItems.length > 0 && (
          <div style={{
            padding: '20px 14px', textAlign: 'center',
            fontSize: 11, color: P.dim, fontFamily: MONO,
          }}>
            {tab === 'active' ? 'All items reviewed' : 'No reviewed items yet'}
          </div>
        )}
      </div>

      {unchangedItems.length > 0 && (
        <UnchangedSection items={unchangedItems} planetId={planet.id}
          maxUsages={maxU} P={P} onMethodClick={handleMethodClick} />
      )}

      <FlagBar planet={planet} flag={flag} P={P} toggleFlag={review.toggleFlag} />
      {linked.length > 0 && <LinkedFiles linked={linked} P={P} onNavigate={onNavigate} />}
    </div>
  );
}

function PlanetHeader({ planet, ic, iconC, color, P, newFn, modFn, sigC }: {
  planet: FlatPlanet; ic: { i: string; c: string }; iconC: string;
  color: string; P: Palette; newFn: number; modFn: number; sigC: number;
}) {
  return (
    <div style={{
      padding: '12px 14px', borderBottom: `1px solid ${P.border}`,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: `${iconC}15`, border: `1px solid ${iconC}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800, color: iconC, fontFamily: MONO,
      }}>{ic.i}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: P.white, fontFamily: SANS }}>
          {planet.name}<span style={{ color: P.dim, fontWeight: 400 }}>{planet.ext}</span>
        </div>
        <div style={{ fontSize: 11, color: P.dim, fontFamily: MONO, marginTop: 1 }}>
          {planet.galaxy.label} / {planet.system.label}
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
          {newFn > 0 && <Tag text={`+${newFn} fn`} color={P.green} />}
          {modFn > 0 && <Tag text={`~${modFn} mod`} color={P.orange} />}
          {sigC > 0 && <Tag text={`\u26A0 ${sigC} sig`} color={P.red} />}
          {!planet.tested && <Tag text="untested" color={P.red} />}
        </div>
      </div>
      <span style={{ fontSize: 20, fontWeight: 900, color, fontFamily: MONO }}>
        {planet.crit.toFixed(1)}
      </span>
    </div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, fontFamily: MONO, color,
      background: `${color}10`, padding: '1px 4px', borderRadius: 3,
    }}>{text}</span>
  );
}

function FlagBar({ planet, flag, P, toggleFlag }: {
  planet: FlatPlanet; flag: string | null; P: Palette;
  toggleFlag: ReviewState['toggleFlag'];
}) {
  return (
    <div style={{
      padding: '8px 14px', borderTop: `1px solid ${P.border}`,
      display: 'flex', gap: 4,
    }}>
      {FLAGS.map(ft => {
        const ftColor = pc(ft.c, P);
        return (
          <button key={ft.key} onClick={() => toggleFlag(planet.id, ft.key)}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 4, fontSize: 10, fontFamily: SANS,
              background: flag === ft.key ? `${ftColor}10` : 'transparent',
              border: `1px solid ${flag === ft.key ? `${ftColor}35` : P.border}`,
              color: flag === ft.key ? ftColor : P.dim,
              cursor: 'pointer',
            }}>
            {ft.icon} {ft.label}
          </button>
        );
      })}
    </div>
  );
}

function UnchangedSection({ items, planetId, maxUsages, P, onMethodClick }: {
  items: MethodData[]; planetId: string; maxUsages: number; P: Palette;
  onMethodClick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${P.border}` }}>
      <div onClick={() => setOpen(!open)}
        style={{
          padding: '8px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
        {...hoverBg(`${P.border}30`)}>
        <span style={{
          fontSize: 8.5, color: P.dim,
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
        }}>&rsaquo;</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: P.dim, fontFamily: MONO, letterSpacing: 1 }}>
          UNCHANGED ({items.length})
        </span>
      </div>
      {open && items.map(item => (
        <div key={item.name}
          onClick={() => onMethodClick(item.name)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px',
            borderLeft: `2px solid ${P.border}`, opacity: 0.6,
            cursor: 'pointer',
          }}
          {...hoverBg(`${P.border}30`)}>
          <span style={{ fontSize: 8, color: P.dim }}>·</span>
          <span style={{
            fontSize: 7.5, fontWeight: 700, fontFamily: MONO, padding: '0 3px', borderRadius: 2,
            background: `${P.dim}10`, color: P.dim,
          }}>fn</span>
          <span style={{
            flex: 1, fontSize: 11, fontFamily: MONO, color: P.dim,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{item.name}</span>
          <span style={{ fontSize: 7.5, color: P.dim, fontFamily: MONO }}>{item.usages}x</span>
        </div>
      ))}
    </div>
  );
}

function LinkedFiles({ linked, P, onNavigate }: {
  linked: FlatPlanet[]; P: Palette;
  onNavigate: (target: FocusTarget) => void;
}) {
  return (
    <div style={{ padding: '8px 14px', borderTop: `1px solid ${P.border}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: P.dim, fontFamily: MONO, marginBottom: 6, letterSpacing: 1 }}>
        LINKED FILES ({linked.length})
      </div>
      {linked.map(lp => (
        <div key={lp.id} onClick={() => onNavigate({ kind: 'planet', id: lp.id, planet: lp })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 6px', marginBottom: 2, borderRadius: 4,
            cursor: 'pointer', fontSize: 11, fontFamily: MONO,
          }}
          {...hoverBg(`${P.border}55`)}>
          <span style={{ fontWeight: 800, color: critPc(lp.crit, P), fontSize: 12, width: 28 }}>
            {lp.crit.toFixed(1)}
          </span>
          <span style={{ color: P.bright, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lp.name}
          </span>
          <span style={{ color: P.dim, fontSize: 9 }}>{lp.galaxy.label}</span>
        </div>
      ))}
    </div>
  );
}
