import type { MethodData, Palette, Flag } from '../types';
import { MONO, SANS, critColor, FLAGS } from '../theme/colors';
import { DiffBlock } from './DiffBlock';
import { ReviewTools } from './ReviewTools';

interface Props {
  item: MethodData;
  isMethod: boolean;
  planetId: string;
  maxUsages: number;
  P: Palette;
  isExpanded: boolean;
  onToggle: () => void;
  // Review
  flags: Record<string, Flag | null>;
  comments: Record<string, Array<{ text: string; t: string }>>;
  actions: Record<string, Array<{ text: string; done: boolean }>>;
  toggleFlag: (id: string, key: Flag) => void;
  addComment: (id: string, text: string) => void;
  addAction: (id: string, text: string) => void;
  toggleAction: (id: string, idx: number) => void;
}

export function MethodRow({
  item, isMethod, planetId, maxUsages, P,
  isExpanded, onToggle,
  flags, comments, actions, toggleFlag, addComment, addAction, toggleAction,
}: Props) {
  const mc = P[critColor(item.crit) as keyof Palette] as string;
  const mKey = `${planetId}:${item.name}`;
  const mFlag = flags[mKey] ?? null;
  const barW = Math.max(4, ((item.usages || 1) / maxUsages) * 100);

  return (
    <div>
      <div onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
          borderLeft: `2px solid ${mc}${item.crit >= 7 ? 'aa' : '44'}`,
          background: isExpanded ? `${mc}08` : 'transparent',
          cursor: item.diff?.length ? 'pointer' : 'default',
          transition: 'background 0.1s',
        }}>
        <span style={{
          fontSize: 7, fontWeight: 800, width: 8,
          color: item.status === 'new' ? P.green : item.status === 'mod' ? P.orange : item.impacted ? P.orange : P.dim,
        }}>
          {item.status === 'new' ? '+' : item.status === 'mod' ? '~' : item.impacted ? '⚡' : '·'}
        </span>
        <span style={{
          fontSize: 6, fontWeight: 700, fontFamily: MONO, padding: '0 3px', borderRadius: 2,
          background: item.httpVerb ? `${P.cyan}10` : item.isType ? `${P.purple}10` : isMethod ? `${P.blue}10` : `${P.orange}10`,
          color: item.httpVerb ? P.cyan : item.isType ? P.purple : isMethod ? P.blue : P.orange,
        }}>
          {item.httpVerb || (item.isType ? 'T' : isMethod ? 'fn' : 'ct')}
        </span>
        <span style={{
          flex: 1, fontSize: 9.5, fontFamily: MONO,
          color: item.crit >= 7 ? P.white : P.bright,
          fontWeight: item.crit >= 7 ? 700 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.name}</span>
        {item.sigChanged && (
          <span style={{ fontSize: 7, color: P.red, fontFamily: MONO, fontWeight: 700 }}>⚠sig</span>
        )}
        {item.tested === false && item.crit >= 5 && (
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: `${P.red}66`, flexShrink: 0 }} />
        )}
        {mFlag && <span style={{ fontSize: 8 }}>{FLAGS.find(f => f.key === mFlag)?.icon}</span>}
        <div style={{ width: 22, height: 2, background: P.border, borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: `${barW}%`, height: '100%', background: (item.usages || 0) >= 5 ? P.cyan : P.dim, borderRadius: 1 }} />
        </div>
        <span style={{ fontSize: 6, color: P.dim, fontFamily: MONO }}>{item.usages}×</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: mc, fontFamily: MONO }}>{item.crit.toFixed(1)}</span>
        {item.diff?.length > 0 && (
          <span style={{
            fontSize: 7, color: P.dim,
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
          }}>›</span>
        )}
      </div>

      {isExpanded && (
        <div style={{ padding: '4px 12px 6px 18px' }}>
          {item.diff?.length > 0 && <DiffBlock diff={item.diff} P={P} />}
          <ReviewTools mKey={mKey} mFlag={mFlag}
            mComments={comments[mKey] ?? []}
            mActions={actions[mKey] ?? []}
            P={P} toggleFlag={toggleFlag} addComment={addComment}
            addAction={addAction} toggleAction={toggleAction} />
        </div>
      )}
    </div>
  );
}
