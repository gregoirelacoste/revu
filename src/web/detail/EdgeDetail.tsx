import type { EdgeData, FlatPlanet, Palette, FocusTarget } from '../types';
import { MONO, SANS, critColor, BADGE_ICONS } from '../theme/colors';

interface Props {
  edge: EdgeData;
  fromPlanet: FlatPlanet;
  toPlanet: FlatPlanet;
  P: Palette;
  onNavigate: (target: FocusTarget) => void;
}

const LINK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  import: { label: 'IMPORT', color: 'blue' },
  inject: { label: 'INJECT', color: 'purple' },
  type: { label: 'TYPE', color: 'cyan' },
  'side-effect': { label: 'SIDE EFFECT', color: 'orange' },
  http: { label: 'HTTP', color: 'green' },
  grpc: { label: 'GRPC', color: 'pink' },
};

export function EdgeDetail({ edge, fromPlanet, toPlanet, P, onNavigate }: Props) {
  const riskColor = P[critColor(edge.riskCrit) as keyof Palette] as string;
  const linkInfo = LINK_TYPE_LABELS[edge.linkType ?? 'import'] ?? LINK_TYPE_LABELS.import;
  const typeColor = P[linkInfo.color as keyof Palette] as string;

  return (
    <div>
      {/* Header */}
      <div style={{
        padding: '14px 14px 10px', borderBottom: `1px solid ${P.border}`,
      }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: P.dim, fontFamily: MONO, letterSpacing: 2, marginBottom: 4 }}>
          LINK
        </div>
        <div style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 3,
          background: `${typeColor}15`, border: `1px solid ${typeColor}30`,
          fontSize: 9, fontWeight: 700, color: typeColor, fontFamily: MONO, letterSpacing: 1,
        }}>
          {linkInfo.label}
        </div>
        {edge.cross && (
          <span style={{
            marginLeft: 6, padding: '2px 6px', borderRadius: 3,
            background: `${P.cyan}12`, border: `1px solid ${P.cyan}25`,
            fontSize: 8, fontWeight: 600, color: P.cyan, fontFamily: MONO,
          }}>CROSS-REPO</span>
        )}
      </div>

      {/* SigChanged banner */}
      {edge.sigChanged && (
        <div style={{
          padding: '8px 14px', background: `${P.red}08`,
          borderBottom: `1px solid ${P.red}20`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 12 }}>&#9888;</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: P.red, fontFamily: SANS }}>
              Signature Changed
            </div>
            <div style={{ fontSize: 8, color: P.dim, fontFamily: MONO, marginTop: 1 }}>
              Breaking change detected in target file
            </div>
          </div>
        </div>
      )}

      {/* Risk score */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${P.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: riskColor, fontFamily: MONO }}>
          {edge.riskCrit.toFixed(1)}
        </span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: P.bright, fontFamily: SANS }}>Risk Score</div>
          <div style={{ fontSize: 7.5, color: P.dim, fontFamily: MONO }}>
            {edge.critical ? 'CRITICAL' : edge.riskCrit >= 5 ? 'HIGH' : 'NORMAL'}
          </div>
        </div>
      </div>

      {/* From → To planets */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${P.border}` }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: P.dim, fontFamily: MONO, letterSpacing: 1, marginBottom: 8 }}>
          CONNECTION
        </div>
        <PlanetLink label="FROM" planet={fromPlanet} P={P} onNavigate={onNavigate} />
        <div style={{
          padding: '4px 0', textAlign: 'center', fontSize: 10, color: P.dim,
        }}>&#8595;</div>
        <PlanetLink label="TO" planet={toPlanet} P={P} onNavigate={onNavigate} />
      </div>

      {/* Specifiers */}
      {edge.specifiers && edge.specifiers.length > 0 && (
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: P.dim, fontFamily: MONO, letterSpacing: 1, marginBottom: 6 }}>
            SPECIFIERS ({edge.specifiers.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {edge.specifiers.map(s => (
              <span key={s} style={{
                padding: '2px 6px', borderRadius: 3,
                background: `${typeColor}10`, border: `1px solid ${typeColor}18`,
                fontSize: 9, fontFamily: MONO, color: P.bright,
              }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanetLink({ label, planet, P, onNavigate }: {
  label: string; planet: FlatPlanet; P: Palette;
  onNavigate: (target: FocusTarget) => void;
}) {
  const ic = BADGE_ICONS[planet.type] ?? { i: '?', c: 'dim' };
  const iconC = P[ic.c as keyof Palette] as string;
  const pc = P[critColor(planet.crit) as keyof Palette] as string;

  return (
    <div onClick={() => onNavigate({ kind: 'planet', id: planet.id, planet })}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
        border: `1px solid ${P.border}`, transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${P.border}44`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <span style={{
        fontSize: 6, fontWeight: 700, color: P.dim, fontFamily: MONO, width: 24, letterSpacing: 0.5,
      }}>{label}</span>
      <span style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        background: `${iconC}15`, border: `1px solid ${iconC}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 6, fontWeight: 800, color: iconC, fontFamily: MONO,
      }}>{ic.i}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: P.bright, fontFamily: MONO,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{planet.name}</div>
        <div style={{ fontSize: 7, color: P.dim, fontFamily: MONO }}>
          {planet.galaxy.label} / {planet.system.label}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: pc, fontFamily: MONO }}>
        {planet.crit.toFixed(1)}
      </span>
    </div>
  );
}
