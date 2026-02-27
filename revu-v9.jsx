import { useState, useCallback, useRef, useEffect } from "react";

const DARK = {
  bg: "#060810", surface: "#0b0d15", card: "#10131c", cardHov: "#161a26",
  border: "#1c2030", text: "#7b869c", dim: "#3a4258", bright: "#c8d0e0", white: "#e8ecf4",
  green: "#22c55e", red: "#ef4444", orange: "#eab308", blue: "#3b82f6",
  purple: "#a78bfa", cyan: "#06b6d4", pink: "#ec4899",
  gBg: "06", gBo: "10", sBg: "04", sBo: "0c", lBg: "#0b0d15", sh: "rgba(0,0,0,0.5)",
  diffAddBg: "rgba(34,197,94,0.07)", diffDelBg: "rgba(239,68,68,0.07)",
  diffAddHi: "rgba(34,197,94,0.25)", diffDelHi: "rgba(239,68,68,0.25)",
};
const LIGHT = {
  bg: "#f4f5f7", surface: "#ffffff", card: "#ffffff", cardHov: "#f0f1f4",
  border: "#dde0e6", text: "#5f6b80", dim: "#a4adc0", bright: "#2c3547", white: "#161b26",
  green: "#16a34a", red: "#dc2626", orange: "#d97706", blue: "#2563eb",
  purple: "#7c3aed", cyan: "#0891b2", pink: "#db2777",
  gBg: "06", gBo: "14", sBg: "05", sBo: "0e", lBg: "#ffffff", sh: "rgba(0,0,0,0.06)",
  diffAddBg: "rgba(34,197,94,0.08)", diffDelBg: "rgba(239,68,68,0.08)",
  diffAddHi: "rgba(34,197,94,0.30)", diffDelHi: "rgba(239,68,68,0.30)",
};

const MO = "'JetBrains Mono','Fira Code',monospace";
const SA = "'Inter',system-ui,sans-serif";
const cK = v => v >= 7.5 ? "red" : v >= 5 ? "orange" : v >= 3 ? "blue" : "green";

const ICONS = {
  controller: { i: "C", c: "green" }, service: { i: "S", c: "blue" },
  module: { i: "M", c: "purple" }, component: { i: "Co", c: "red" },
  guard: { i: "G", c: "orange" }, dto: { i: "D", c: "cyan" },
};

const FLAGS = [
  { key: "ok", icon: "✓", label: "OK", c: "green" },
  { key: "bug", icon: "✗", label: "Bug", c: "red" },
  { key: "test", icon: "◉", label: "Test", c: "orange" },
  { key: "question", icon: "?", label: "Question", c: "purple" },
];

// ── Word-level diff: detect changed tokens within modified lines ──
function wordDiff(oldLine, newLine) {
  const oWords = oldLine.split(/(\s+)/);
  const nWords = newLine.split(/(\s+)/);
  const result = { old: [], new: [] };
  const maxLen = Math.max(oWords.length, nWords.length);
  for (let i = 0; i < maxLen; i++) {
    const ow = oWords[i] || "";
    const nw = nWords[i] || "";
    if (ow === nw) {
      result.old.push({ text: ow, changed: false });
      result.new.push({ text: nw, changed: false });
    } else {
      if (ow) result.old.push({ text: ow, changed: true });
      if (nw) result.new.push({ text: nw, changed: true });
    }
  }
  return result;
}

// ── DATA ──
const GALAXIES = [
  {
    id: "g-front", label: "certificall-front", color: "red",
    cx: 250, cy: 280, rx: 260, ry: 290,
    systems: [
      { id: "s-admin", label: "src/app/admin", cx: -50, cy: -70, r: 120,
        planets: [
          { id: "p1", name: "dashboard.component", ext: ".ts", type: "component", crit: 2.1, add: 87, del: 12, reviewed: true, tested: true, ox: -30, oy: -15,
            methods: [
              { name: "loadStats", s: "new", crit: 2.8, u: 2, tested: true, diff: [
                { t:"a", c:"async loadStats() {" },{ t:"a", c:"  this.stats = await this.svc.getStats();" },{ t:"a", c:"  this.loading = false;" },{ t:"a", c:"}" }
              ]},
              { name: "ngOnInit", s: "mod", crit: 1.5, u: 1, tested: true, diff: [{ t:"d", c:"    this.loadData();" },{ t:"a", c:"    this.loadStats();" }] },
            ], constants: [{ name: "TABS", s: "new", crit: 1.0, u: 4 }] },
          { id: "p1b", name: "dashboard.component", ext: ".html", type: "component", crit: 0.8, add: 45, del: 8, reviewed: true, tested: false, ox: 35, oy: 25, methods: [], constants: [] },
        ]},
      { id: "s-svc-f", label: "src/app/services", cx: -30, cy: 100, r: 90,
        planets: [
          { id: "p2", name: "consumption.service", ext: ".ts", type: "service", crit: 4.2, add: 56, del: 8, tested: true, ox: 0, oy: 0,
            methods: [{ name: "getStats", s: "new", crit: 4.2, u: 3, tested: true, diff: [
              { t:"a", c:"async getStats(): Promise<StatsDto> {" },{ t:"a", c:"  return this.http.get(API_URL + '/stats');" },{ t:"a", c:"}" }
            ]}],
            constants: [{ name: "API_URL", s: "new", crit: 3.5, u: 3 }] },
        ]},
      { id: "s-models", label: "src/app/models", cx: 110, cy: -20, r: 70,
        planets: [
          { id: "p1c", name: "stats.model", ext: ".ts", type: "dto", crit: 2.0, add: 18, del: 0, tested: false, ox: 0, oy: 0, methods: [], constants: [{ name: "StatsModel", s: "new", crit: 2.0, u: 5, isType: true }] },
        ]},
    ],
  },
  {
    id: "g-api", label: "certificall-api", color: "blue",
    cx: 800, cy: 260, rx: 290, ry: 350,
    systems: [
      { id: "s-cons", label: "src/consumption", cx: -40, cy: -90, r: 135,
        planets: [
          { id: "p3", name: "consumption.controller", ext: ".ts", type: "controller", crit: 5.5, add: 78, del: 15, tested: false, ox: -20, oy: -35,
            methods: [
              { name: "getStats", s: "new", crit: 5.5, u: 1, verb: "GET", tested: false, sigChanged: false, diff: [
                { t:"a", c:"@Get('stats')" },{ t:"a", c:"@UseGuards(AdminGuard)" },{ t:"a", c:"async getStats(@Query() q: StatsQueryDto) {" },{ t:"a", c:"  return this.svc.computeStats(q);" },{ t:"a", c:"}" }
              ]},
              { name: "getQuotas", s: "mod", crit: 4.8, u: 2, verb: "GET", tested: false, sigChanged: true, diff: [
                { t:"d", c:"async getQuotas(id: string): Promise<QuotaDto[]> {" },{ t:"a", c:"async getQuotas(id: string): Promise<QuotaStatsDto> {" }
              ]},
            ], constants: [] },
          { id: "p4", name: "consumption.service", ext: ".ts", type: "service", crit: 6.8, add: 112, del: 23, tested: false, ox: 20, oy: 40,
            methods: [
              { name: "getQuotas", s: "mod", crit: 6.8, u: 4, tested: false, sigChanged: true, diff: [
                { t:"d", c:"async getQuotas(companyId: string): Promise<QuotaDto[]> {" },
                { t:"a", c:"async getQuotas(companyId: string, period?: DateRange): Promise<QuotaStatsDto> {" },
                { t:"c", c:"  const company = await this.companyRepo.findOne(companyId);" },
                { t:"a", c:"  const usage = await this.computeUsage(company, period);" },
                { t:"d", c:"  return company.quotas;" },
                { t:"a", c:"  return { quotas: company.quotas, usage, remaining: this.calcRemaining(company.quotas, usage) };" },
              ]},
              { name: "computeStats", s: "new", crit: 5.2, u: 1, tested: false, diff: [
                { t:"a", c:"async computeStats(q: StatsQueryDto) {" },
                { t:"a", c:"  const scores = await Promise.all(" },
                { t:"a", c:"    companies.map(c => this.trustSvc.calculateScore(c.lastPhotoId))" },
                { t:"a", c:"  );" },
                { t:"a", c:"  return this.aggregateStats(companies, scores);" },
                { t:"a", c:"}" },
              ]},
            ], constants: [{ name: "QUOTA_THRESHOLD", s: "new", crit: 3.0, u: 5 }] },
        ]},
      { id: "s-dto", label: "src/consumption/dto", cx: -80, cy: 110, r: 80,
        planets: [
          { id: "p5", name: "stats.dto", ext: ".ts", type: "dto", crit: 3.0, add: 34, del: 0, tested: false, ox: 0, oy: 0,
            methods: [], constants: [{ name: "StatsResponseDto", s: "new", crit: 3.0, u: 6, isType: true }, { name: "QuotaStatsDto", s: "new", crit: 2.5, u: 4, isType: true }] },
        ]},
      { id: "s-bill", label: "src/billing", cx: 110, cy: 110, r: 85,
        planets: [
          { id: "p6", name: "billing.service", ext: ".ts", type: "service", crit: 4.5, add: 0, del: 0, sideEffect: true, tested: true, ox: 0, oy: 0,
            methods: [{ name: "syncQuotas", s: "unch", crit: 4.5, u: 3, impacted: true, tested: true }], constants: [] },
        ]},
    ],
  },
  {
    id: "g-trust", label: "certificall-trust", color: "purple",
    cx: 1340, cy: 290, rx: 240, ry: 290,
    systems: [
      { id: "s-trust", label: "src/trust", cx: -15, cy: -55, r: 125,
        planets: [
          { id: "p7", name: "trust-score.service", ext: ".ts", type: "service", crit: 8.5, add: 89, del: 11, tested: false, ox: -10, oy: -30,
            methods: [
              { name: "calculateScore", s: "mod", crit: 8.5, u: 7, tested: false, sigChanged: true, diff: [
                { t:"d", c:"async calculateScore(photoId: string): Promise<number> {" },
                { t:"a", c:"async calculateScore(photoId: string, opts?: ScoreOptions): Promise<TrustScoreResult> {" },
                { t:"c", c:"  const photo = await this.photoRepo.findOne(photoId);" },
                { t:"a", c:"  const sigValid = await this.cryptoModule.verifySignature(photo.manifest);" },
                { t:"a", c:"  if (!sigValid) {" },
                { t:"a", c:"    await this.auditLogger.logSecurityEvent('INVALID_SIG', { photoId });" },
                { t:"a", c:"    return { score: 0, reason: 'SIGNATURE_INVALID', verified: false };" },
                { t:"a", c:"  }" },
                { t:"d", c:"  return this.computeScore(metadata);" },
                { t:"a", c:"  const score = this.computeScore(metadata, opts);" },
                { t:"a", c:"  return { score, reason: 'OK', verified: true };" },
              ]},
              { name: "validateIntegrity", s: "new", crit: 7.8, u: 2, tested: false, diff: [
                { t:"a", c:"async validateIntegrity(manifest: C2PAManifest): Promise<boolean> {" },
                { t:"a", c:"  const hash = await this.crypto.generateHash(manifest.raw);" },
                { t:"a", c:"  return hash === manifest.declaredHash;" },
                { t:"a", c:"}" },
              ]},
            ], constants: [{ name: "SCORE_WEIGHTS", s: "mod", crit: 7.0, u: 3 }, { name: "INTEGRITY_THRESHOLD", s: "new", crit: 6.5, u: 2 }] },
          { id: "p8", name: "crypto.module", ext: ".ts", type: "module", crit: 9.2, add: 45, del: 8, tested: false, ox: 10, oy: 45,
            methods: [{ name: "verifySignature", s: "mod", crit: 9.2, u: 5, tested: false, sigChanged: true, diff: [
              { t:"d", c:"async verifySignature(manifest: Buffer): Promise<boolean> {" },
              { t:"a", c:"async verifySignature(manifest: C2PAManifest): Promise<boolean> {" },
              { t:"c", c:"  const cert = this.extractCertificate(manifest);" },
              { t:"d", c:"  return this.validateChain(cert);" },
              { t:"a", c:"  const chainValid = await this.validateChain(cert);" },
              { t:"a", c:"  const timestampValid = await this.verifyQualifiedTimestamp(manifest);" },
              { t:"a", c:"  return chainValid && timestampValid;" },
            ]}],
            constants: [{ name: "CRYPTO_ALGORITHM", s: "mod", crit: 8.8, u: 4 }] },
        ]},
      { id: "s-tdto", label: "src/trust/dto", cx: -15, cy: 120, r: 70,
        planets: [
          { id: "p9", name: "score.dto", ext: ".ts", type: "dto", crit: 2.8, add: 22, del: 3, tested: false, ox: 0, oy: 0,
            methods: [], constants: [{ name: "TrustScoreResult", s: "mod", crit: 2.8, u: 5, isType: true }] },
        ]},
    ],
  },
];

const EDGES = [
  { from: "p1", to: "p2", label: "import getStats", riskCrit: 2.8 },
  { from: "p2", to: "p3", label: "GET /stats", cross: true, riskCrit: 4.2 },
  { from: "p3", to: "p4", label: "inject computeStats", riskCrit: 5.2 },
  { from: "p4", to: "p6", label: "inject getQuotas ⚡", dashed: true, riskCrit: 4.5 },
  { from: "p4", to: "p7", label: "gRPC calculateScore", cross: true, critical: true, riskCrit: 8.5 },
  { from: "p7", to: "p8", label: "inject verifySignature", critical: true, riskCrit: 9.2 },
  { from: "p3", to: "p5", label: "type StatsDto", riskCrit: 3.0 },
  { from: "p7", to: "p9", label: "type ScoreResult", riskCrit: 2.8 },
];

// Blast radius: 2 levels of propagation
const BLAST = {};
EDGES.forEach(e => { if (!BLAST[e.from]) BLAST[e.from] = []; BLAST[e.from].push(e.to); });
function getBlast(id) {
  const l1 = BLAST[id] || [];
  const l2 = l1.flatMap(x => BLAST[x] || []).filter(x => x !== id && !l1.includes(x));
  return { l1: new Set(l1), l2: new Set(l2) };
}

const ALL = GALAXIES.flatMap(g => g.systems.flatMap(s => s.planets.map(p => ({
  ...p, galaxy: g, system: s, ax: g.cx + s.cx + p.ox, ay: g.cy + s.cy + p.oy,
}))));
const PM = Object.fromEntries(ALL.map(p => [p.id, p]));

// ── WORD-DIFF RENDERER ──
function DiffLine({ line, pairedLine, P }) {
  const bg = { a: P.diffAddBg, d: P.diffDelBg, c: "transparent" };
  const cl = { a: P.green, d: P.red, c: P.dim };
  const px = { a: "+", d: "-", c: " " };

  // Word-level highlighting for mod pairs
  let tokens = null;
  if (pairedLine && line.t !== "c") {
    const wd = wordDiff(
      line.t === "d" ? line.c : pairedLine.c,
      line.t === "a" ? line.c : pairedLine.c
    );
    tokens = line.t === "d" ? wd.old : wd.new;
  }

  return (
    <div style={{
      display: "flex", background: bg[line.t],
      borderLeft: line.t === "a" ? `2px solid ${P.green}40` : line.t === "d" ? `2px solid ${P.red}40` : "2px solid transparent",
    }}>
      <span style={{ width: 14, textAlign: "center", color: cl[line.t], fontWeight: 700, flexShrink: 0, fontSize: 8, lineHeight: "17px" }}>
        {px[line.t]}
      </span>
      <span style={{ whiteSpace: "pre", paddingRight: 6, lineHeight: "17px" }}>
        {tokens ? tokens.map((tk, i) => (
          <span key={i} style={{
            color: tk.changed ? (line.t === "d" ? P.red : P.green) : (line.t === "c" ? P.dim : P.bright),
            background: tk.changed ? (line.t === "d" ? P.diffDelHi : P.diffAddHi) : "transparent",
            borderRadius: tk.changed ? 2 : 0,
            fontWeight: tk.changed ? 700 : 400,
          }}>{tk.text}</span>
        )) : (
          <span style={{ color: line.t === "c" ? P.dim : P.bright }}>{line.c}</span>
        )}
      </span>
    </div>
  );
}

function DiffBlock({ diff, P }) {
  // Pair del/add lines for word-level diff
  const paired = {};
  let i = 0;
  while (i < diff.length) {
    if (diff[i].t === "d" && i + 1 < diff.length && diff[i + 1].t === "a") {
      paired[i] = i + 1;
      paired[i + 1] = i;
      i += 2;
    } else {
      i++;
    }
  }

  return (
    <div style={{ borderRadius: 5, overflow: "hidden", border: `1px solid ${P.border}`, fontSize: 9.5, fontFamily: MO, marginBottom: 6 }}>
      {diff.map((line, idx) => (
        <DiffLine key={idx} line={line} pairedLine={paired[idx] !== undefined ? diff[paired[idx]] : null} P={P} />
      ))}
    </div>
  );
}

// ── MAIN ──
export default function RevuV9() {
  const ref = useRef(null);
  const [dark, setDark] = useState(true);
  const P = dark ? DARK : LIGHT;
  const [cam, setCam] = useState({ x: 80, y: 20, s: 0.55 });
  const [drag, setDrag] = useState(null);
  const [hov, setHov] = useState(null);
  const [hovSys, setHovSys] = useState(null);
  const [focus, setFocus] = useState(null);
  const [expM, setExpM] = useState(null);
  const [flags, setFlags] = useState({});
  const [comments, setComments] = useState({});
  const [actions, setActions] = useState({});
  const [cIn, setCIn] = useState("");
  const [actIn, setActIn] = useState("");

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const f = e.deltaY < 0 ? 1.12 : 0.89;
    setCam(c => {
      const ns = Math.max(0.15, Math.min(3.5, c.s * f));
      const wx = (mx - c.x) / c.s, wy = (my - c.y) / c.s;
      return { x: mx - wx * ns, y: my - wy * ns, s: ns };
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const onDown = (e) => { if (!e.target.closest("[data-ui]")) setDrag({ x: e.clientX - cam.x, y: e.clientY - cam.y }); };
  const onMove = (e) => { if (drag) setCam(c => ({ ...c, x: e.clientX - drag.x, y: e.clientY - drag.y })); };
  const onUp = () => setDrag(null);

  // Connections for hover
  const conn = new Set();
  if (hov) { conn.add(hov); EDGES.forEach(e => { if (e.from === hov) conn.add(e.to); if (e.to === hov) conn.add(e.from); }); }

  // Blast radius
  const blast = hov ? getBlast(hov) : { l1: new Set(), l2: new Set() };

  const zl = cam.s;

  const zoomTo = (p) => {
    const planet = PM[p.id];
    if (!planet) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setCam({ x: rect.width / 2 - planet.ax * 2, y: rect.height / 2 - planet.ay * 2 - 40, s: 2 });
    setFocus(p.id); setExpM(null);
  };
  const zoomOut = () => { setCam({ x: 80, y: 20, s: 0.55 }); setFocus(null); setExpM(null); };

  const toggleFlag = (id, k) => setFlags(f => ({ ...f, [id]: f[id] === k ? null : k }));
  const addComment = (id) => { if (!cIn.trim()) return; setComments(c => ({ ...c, [id]: [...(c[id] || []), { text: cIn, t: new Date().toLocaleTimeString().slice(0, 5) }] })); setCIn(""); };
  const addAction = (id) => { if (!actIn.trim()) return; setActions(a => ({ ...a, [id]: [...(a[id] || []), { text: actIn, done: false }] })); setActIn(""); };
  const toggleAction = (id, idx) => setActions(a => ({ ...a, [id]: (a[id] || []).map((x, i) => i === idx ? { ...x, done: !x.done } : x) }));

  const reviewed = ALL.filter(p => p.reviewed || flags[p.id] === "ok").length;

  return (
    <div style={{ background: P.bg, color: P.text, fontFamily: SA, height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "5px 14px", borderBottom: `1px solid ${P.border}`, background: P.surface, zIndex: 30, gap: 8 }}>
        <span style={{ fontWeight: 900, fontSize: 12, letterSpacing: 2, fontFamily: MO, color: P.cyan }}>◈ REVU</span>
        <span style={{ color: P.dim, fontSize: 9, fontFamily: MO }}>CER-247</span>
        <div style={{ flex: 1 }} />
        {focus && <button onClick={zoomOut} data-ui="true" style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontFamily: MO, background: `${P.cyan}10`, border: `1px solid ${P.cyan}25`, color: P.cyan, cursor: "pointer" }}>← univers</button>}
        <span style={{ fontSize: 8, fontFamily: MO, color: P.dim }}>{reviewed}/{ALL.length}</span>
        <button onClick={() => setDark(!dark)} data-ui="true" style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontFamily: MO, background: "transparent", border: `1px solid ${P.border}`, color: P.dim, cursor: "pointer" }}>{dark ? "☀" : "●"}</button>
      </div>

      {/* Canvas */}
      <div ref={ref} style={{ flex: 1, overflow: "hidden", cursor: drag ? "grabbing" : "grab", position: "relative" }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>

        <div style={{ position: "absolute", transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", willChange: "transform" }}>

          {/* Galaxies + Systems */}
          {GALAXIES.map(g => {
            const c = P[g.color];
            return (
              <div key={g.id}>
                <div style={{ position: "absolute", left: g.cx - g.rx, top: g.cy - g.ry, width: g.rx * 2, height: g.ry * 2, borderRadius: "50%", background: `${c}${P.gBg}`, border: `1px solid ${c}${P.gBo}`, pointerEvents: "none" }} />
                <div style={{ position: "absolute", left: g.cx - g.rx + 14, top: g.cy - g.ry + 8, fontSize: 9, fontWeight: 700, fontFamily: MO, color: `${c}55`, pointerEvents: "none" }}>{g.label}</div>
                {g.systems.map(s => {
                  const sx = g.cx + s.cx, sy = g.cy + s.cy;
                  const isH = hovSys === s.id;
                  return (
                    <div key={s.id}>
                      <div onMouseEnter={() => setHovSys(s.id)} onMouseLeave={() => setHovSys(null)}
                        style={{ position: "absolute", left: sx - s.r, top: sy - s.r, width: s.r * 2, height: s.r * 2, borderRadius: "50%", background: `${c}${P.sBg}`, border: `1px dashed ${c}${isH ? "28" : P.sBo}`, pointerEvents: "auto", cursor: "default", transition: "border-color 0.2s" }} />
                      <div style={{
                        position: "absolute", left: sx - s.r + 5, top: sy - s.r + 3,
                        fontSize: isH ? 10 : 7, fontFamily: MO, color: isH ? `${c}99` : `${c}28`,
                        background: isH ? `${P.lBg}dd` : "transparent", padding: isH ? "1px 5px" : "0",
                        borderRadius: 3, pointerEvents: "none", transition: "all 0.2s", whiteSpace: "nowrap",
                        zIndex: isH ? 5 : 0, border: isH ? `1px solid ${c}18` : "1px solid transparent",
                      }}>{s.label}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Edges — thickness by risk */}
          <svg style={{ position: "absolute", top: -300, left: -300, width: 2400, height: 1600, pointerEvents: "none", zIndex: 3 }}>
            <defs>
              {["red", "cyan", "dim"].map(k => (
                <marker key={k} id={`a${k[0]}`} viewBox="0 0 8 6" refX="7" refY="3" markerWidth={5} markerHeight={4} orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={P[k === "dim" ? "dim" : k]} />
                </marker>
              ))}
            </defs>
            {EDGES.map((edge, i) => {
              const ff = PM[edge.from], tf = PM[edge.to];
              if (!ff || !tf) return null;
              const o = 300;
              const x1 = ff.ax + o, y1 = ff.ay + o, x2 = tf.ax + o, y2 = tf.ay + o;
              const vis = !hov || conn.has(edge.from) || conn.has(edge.to);
              const ck = edge.critical ? "red" : edge.cross ? "cyan" : "dim";
              const color = P[ck];
              const op = vis ? (edge.critical ? 0.8 : hov && (conn.has(edge.from) && conn.has(edge.to)) ? 0.6 : 0.25) : 0.02;
              const dx = x2 - x1, dy = y2 - y1, dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const nx = -dy / dist, ny = dx / dist;
              const bend = Math.min(dist * 0.22, 55) * (edge.cross ? 1 : 0.4);
              const qx = (x1 + x2) / 2 + nx * bend, qy = (y1 + y2) / 2 + ny * bend;
              const lx = (x1 + qx) / 2, ly = (y1 + qy) / 2;
              // Thickness by risk: 1-3px based on riskCrit
              const thickness = edge.riskCrit >= 7 ? 2.5 : edge.riskCrit >= 5 ? 1.8 : 1;

              return (
                <g key={i} opacity={op} style={{ transition: "opacity 0.2s" }}>
                  {edge.riskCrit >= 7 && vis && (
                    <path d={`M${x1},${y1} Q${qx},${qy} ${x2},${y2}`} fill="none" stroke={color} strokeWidth={12} opacity={0.04} style={{ filter: "blur(8px)" }} />
                  )}
                  <path d={`M${x1},${y1} Q${qx},${qy} ${x2},${y2}`} fill="none" stroke={color}
                    strokeWidth={thickness} strokeDasharray={edge.dashed ? "5,4" : "none"}
                    markerEnd={`url(#a${ck[0]})`} />
                  {vis && zl >= 0.4 && (
                    <g>
                      <rect x={lx - edge.label.length * 2.2 - 3} y={ly - 6} width={edge.label.length * 4.4 + 6} height={11} rx={3}
                        fill={P.lBg} stroke={`${color}20`} strokeWidth={0.5} opacity={0.9} />
                      <text x={lx} y={ly + 2} textAnchor="middle" fill={color} fontSize={5.5} fontFamily={MO} fontWeight={600}>{edge.label}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Planets */}
          {ALL.map(planet => {
            const vis = !hov || conn.has(planet.id);
            const isBlastL1 = blast.l1.has(planet.id);
            const isBlastL2 = blast.l2.has(planet.id);
            const isHov = hov === planet.id;
            const isFoc = focus === planet.id;
            const ic = ICONS[planet.type] || { i: "?", c: "dim" };
            const ck = cK(planet.crit);
            const color = P[ck];
            const iconC = P[ic.c];
            const baseR = 24 + (planet.crit / 10) * 14;
            const flag = flags[planet.id];
            const items = [...(planet.methods || []), ...(planet.constants || [])].filter(m => m.s !== "unch" || m.impacted).sort((a, b) => b.crit - a.crit);
            const maxU = Math.max(...items.map(m => m.u || 1), 1);
            // Tags
            const newFn = items.filter(m => m.s === "new" && !m.isType).length;
            const modFn = items.filter(m => m.s === "mod").length;
            const sigC = items.filter(m => m.sigChanged).length;

            // Blast ring color
            const blastBorder = isBlastL1 ? `${P.orange}60` : isBlastL2 ? `${P.orange}25` : null;

            return (
              <div key={planet.id} data-ui="true" style={{
                position: "absolute", left: planet.ax - baseR, top: planet.ay - baseR,
                opacity: vis || isBlastL1 || isBlastL2 ? 1 : 0.04,
                transition: "opacity 0.2s", zIndex: isFoc ? 20 : isHov ? 10 : 1,
              }}
                onMouseEnter={() => setHov(planet.id)}
                onMouseLeave={() => setHov(null)}>

                {/* Blast radius ring */}
                {blastBorder && !isHov && (
                  <div style={{
                    position: "absolute", left: -4, top: -4, width: baseR * 2 + 8, height: baseR * 2 + 8,
                    borderRadius: "50%", border: `2px solid ${blastBorder}`,
                    pointerEvents: "none", animation: isBlastL1 ? "none" : "none",
                  }} />
                )}

                {/* Circle */}
                <div onClick={(e) => { e.stopPropagation(); zoomTo(planet); }}
                  style={{
                    width: baseR * 2, height: baseR * 2, borderRadius: "50%",
                    background: isFoc ? `${color}14` : isHov ? P.cardHov : P.card,
                    border: `1.5px ${planet.sideEffect ? "dashed" : "solid"} ${isFoc ? `${color}55` : isHov ? `${color}35` : P.border}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", position: "relative",
                    boxShadow: (isHov || isFoc) ? `0 0 20px ${color}12` : `0 1px 3px ${P.sh}`,
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}>

                  {/* Type badge */}
                  <div style={{ position: "absolute", top: 2, left: baseR - 8, width: 14, height: 14, borderRadius: "50%", background: `${iconC}18`, border: `1px solid ${iconC}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, fontWeight: 800, color: iconC, fontFamily: MO }}>{ic.i}</div>

                  {/* Test indicator */}
                  {planet.tested !== undefined && (
                    <div style={{
                      position: "absolute", top: 1, right: baseR - 9,
                      width: 7, height: 7, borderRadius: "50%",
                      background: planet.tested ? P.green : `${P.red}88`,
                      border: `1px solid ${planet.tested ? P.green : P.red}44`,
                    }} />
                  )}

                  {/* Flag */}
                  {flag && <div style={{ position: "absolute", bottom: 4, left: baseR - 6, fontSize: 9 }}>{FLAGS.find(f => f.key === flag)?.icon}</div>}

                  {/* Score */}
                  <span style={{
                    fontSize: 11 + (planet.crit / 10) * 7, fontWeight: 900, fontFamily: MO, color, lineHeight: 1,
                    textShadow: planet.crit >= 7 ? `0 0 10px ${color}44` : "none",
                  }}>{planet.crit.toFixed(1)}</span>

                  {/* Name */}
                  <span style={{ fontSize: 7, fontWeight: 600, color: P.bright, fontFamily: SA, textAlign: "center", padding: "1px 4px", lineHeight: 1.15, maxWidth: baseR * 2 - 8, wordBreak: "break-word" }}>
                    {planet.name}
                  </span>

                  {zl >= 0.5 && (
                    <span style={{ fontSize: 5.5, fontFamily: MO, color: P.dim, marginTop: 1 }}>
                      {planet.add > 0 && <span style={{ color: P.green }}>+{planet.add}</span>}
                      {planet.del > 0 && <span style={{ marginLeft: 2, color: P.red }}>-{planet.del}</span>}
                      {planet.sideEffect && <span style={{ color: P.orange }}> ⚡</span>}
                      {(planet.reviewed || flag === "ok") && <span style={{ color: P.green }}> ✓</span>}
                    </span>
                  )}
                </div>

                {/* Hover tags — factual summary */}
                {isHov && !isFoc && items.length > 0 && (
                  <div style={{
                    position: "absolute", top: baseR * 2 + 4, left: baseR - 80, width: 160,
                    background: `${P.surface}ee`, border: `1px solid ${P.border}`, borderRadius: 6,
                    padding: "4px 6px", backdropFilter: "blur(6px)", pointerEvents: "none",
                    display: "flex", flexWrap: "wrap", gap: 3,
                  }}>
                    {newFn > 0 && <span style={{ fontSize: 7, fontFamily: MO, color: P.green, background: `${P.green}10`, padding: "0 4px", borderRadius: 3 }}>+{newFn} fn</span>}
                    {modFn > 0 && <span style={{ fontSize: 7, fontFamily: MO, color: P.orange, background: `${P.orange}10`, padding: "0 4px", borderRadius: 3 }}>~{modFn} mod</span>}
                    {sigC > 0 && <span style={{ fontSize: 7, fontFamily: MO, color: P.red, background: `${P.red}10`, padding: "0 4px", borderRadius: 3 }}>⚠ {sigC} sig</span>}
                    {!planet.tested && <span style={{ fontSize: 7, fontFamily: MO, color: P.red, background: `${P.red}08`, padding: "0 4px", borderRadius: 3 }}>untested</span>}
                  </div>
                )}

                {/* Zoom-revealed methods (no click) */}
                {!isFoc && zl >= 0.85 && items.length > 0 && (
                  <div style={{ marginTop: 4, width: baseR * 2, pointerEvents: "none" }}>
                    {items.slice(0, zl >= 1.4 ? 6 : 3).map((it, i) => {
                      const mc = P[cK(it.crit)];
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 2px", fontSize: 6, fontFamily: MO }}>
                          <span style={{ color: it.s === "new" ? P.green : it.s === "mod" ? P.orange : P.dim, fontWeight: 800, width: 5 }}>
                            {it.s === "new" ? "+" : it.s === "mod" ? "~" : "·"}
                          </span>
                          <span style={{ flex: 1, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                          {it.sigChanged && <span style={{ color: P.red, fontSize: 5 }}>⚠</span>}
                          {it.tested === false && it.crit >= 5 && <span style={{ fontSize: 5, color: P.red }}>○</span>}
                          <span style={{ color: mc, fontWeight: 700, fontSize: 5.5 }}>{it.crit.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Focus panel */}
                {isFoc && items.length > 0 && (
                  <div data-ui="true" style={{
                    position: "absolute", top: baseR * 2 + 8, left: baseR - 185,
                    width: 370, background: P.surface, border: `1px solid ${P.border}`,
                    borderRadius: 10, boxShadow: `0 8px 40px ${P.sh}`, zIndex: 25, overflow: "hidden",
                  }} onClick={(e) => e.stopPropagation()}>

                    {/* Header */}
                    <div style={{ padding: "8px 12px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: `${iconC}15`, border: `1px solid ${iconC}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: iconC, fontFamily: MO }}>{ic.i}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: P.white, fontFamily: SA }}>{planet.name}<span style={{ color: P.dim, fontWeight: 400 }}>{planet.ext}</span></div>
                        <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                          {newFn > 0 && <span style={{ fontSize: 7, fontFamily: MO, color: P.green, background: `${P.green}10`, padding: "0 3px", borderRadius: 2 }}>+{newFn} fn</span>}
                          {modFn > 0 && <span style={{ fontSize: 7, fontFamily: MO, color: P.orange, background: `${P.orange}10`, padding: "0 3px", borderRadius: 2 }}>~{modFn} mod</span>}
                          {sigC > 0 && <span style={{ fontSize: 7, fontFamily: MO, color: P.red, background: `${P.red}10`, padding: "0 3px", borderRadius: 2 }}>⚠ {sigC} sig changed</span>}
                          {!planet.tested && <span style={{ fontSize: 7, fontFamily: MO, color: P.red, background: `${P.red}08`, padding: "0 3px", borderRadius: 2 }}>untested</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color, fontFamily: MO }}>{planet.crit.toFixed(1)}</span>
                    </div>

                    <div style={{ maxHeight: 420, overflow: "auto" }}>
                      {items.map((item, i) => {
                        const mc = P[cK(item.crit)];
                        const isM = planet.methods?.includes(item);
                        const mId = `${planet.id}-${item.name}`;
                        const isSel = expM === mId;
                        const mKey = `${planet.id}:${item.name}`;
                        const mFlag = flags[mKey];
                        const mCmts = comments[mKey] || [];
                        const mActs = actions[mKey] || [];
                        const barW = Math.max(4, ((item.u || 1) / maxU) * 100);

                        return (
                          <div key={i}>
                            <div onClick={() => setExpM(isSel ? null : mId)}
                              style={{
                                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                                borderLeft: `2px solid ${mc}${item.crit >= 7 ? "aa" : "44"}`,
                                background: isSel ? `${mc}08` : "transparent",
                                cursor: item.diff ? "pointer" : "default", transition: "background 0.1s",
                              }}
                              onMouseOver={(e) => { if (!isSel) e.currentTarget.style.background = `${mc}04`; }}
                              onMouseOut={(e) => { if (!isSel) e.currentTarget.style.background = isSel ? `${mc}08` : "transparent"; }}>
                              <span style={{ fontSize: 7, color: item.s === "new" ? P.green : item.s === "mod" ? P.orange : item.impacted ? P.orange : P.dim, fontWeight: 800, width: 8 }}>
                                {item.s === "new" ? "+" : item.s === "mod" ? "~" : item.impacted ? "⚡" : "·"}
                              </span>
                              <span style={{ fontSize: 6, fontWeight: 700, fontFamily: MO, padding: "0 3px", borderRadius: 2, background: item.verb ? `${P.cyan}10` : item.isType ? `${P.purple}10` : isM ? `${P.blue}10` : `${P.orange}10`, color: item.verb ? P.cyan : item.isType ? P.purple : isM ? P.blue : P.orange }}>
                                {item.verb || (item.isType ? "T" : isM ? "fn" : "ct")}
                              </span>
                              <span style={{ flex: 1, fontSize: 9.5, fontFamily: MO, color: item.crit >= 7 ? P.white : P.bright, fontWeight: item.crit >= 7 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.name}
                              </span>
                              {item.sigChanged && <span style={{ fontSize: 7, color: P.red, fontFamily: MO, fontWeight: 700 }}>⚠sig</span>}
                              {item.tested === false && item.crit >= 5 && <span style={{ width: 5, height: 5, borderRadius: "50%", background: `${P.red}66`, flexShrink: 0 }} />}
                              {mFlag && <span style={{ fontSize: 8 }}>{FLAGS.find(f => f.key === mFlag)?.icon}</span>}
                              <div style={{ width: 22, height: 2, background: P.border, borderRadius: 1, overflow: "hidden", flexShrink: 0 }}>
                                <div style={{ width: `${barW}%`, height: "100%", background: (item.u || 0) >= 5 ? P.cyan : P.dim, borderRadius: 1 }} />
                              </div>
                              <span style={{ fontSize: 6, color: P.dim, fontFamily: MO }}>{item.u}×</span>
                              <span style={{ fontSize: 9.5, fontWeight: 800, color: mc, fontFamily: MO }}>{item.crit.toFixed(1)}</span>
                              {item.diff && <span style={{ fontSize: 7, color: P.dim, transform: isSel ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>}
                            </div>

                            {isSel && (
                              <div style={{ padding: "4px 12px 6px 18px" }} onClick={(e) => e.stopPropagation()}>
                                {item.diff && <DiffBlock diff={item.diff} P={P} />}

                                {/* Flags */}
                                <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                                  {FLAGS.map(ft => (
                                    <button key={ft.key} onClick={() => toggleFlag(mKey, ft.key)} data-ui="true"
                                      style={{ padding: "2px 5px", borderRadius: 3, fontSize: 7.5, fontFamily: SA, background: mFlag === ft.key ? `${P[ft.c]}12` : "transparent", border: `1px solid ${mFlag === ft.key ? `${P[ft.c]}40` : P.border}`, color: mFlag === ft.key ? P[ft.c] : P.dim, cursor: "pointer" }}>
                                      {ft.icon} {ft.label}
                                    </button>
                                  ))}
                                </div>

                                {/* Actions */}
                                {mActs.length > 0 && (
                                  <div style={{ marginBottom: 3 }}>
                                    {mActs.map((a, ai) => (
                                      <div key={ai} onClick={() => toggleAction(mKey, ai)} data-ui="true"
                                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 0", cursor: "pointer", fontSize: 8.5, fontFamily: SA, color: a.done ? P.dim : P.text }}>
                                        <span style={{ fontSize: 9, color: a.done ? P.green : P.dim }}>{a.done ? "☑" : "☐"}</span>
                                        <span style={{ textDecoration: a.done ? "line-through" : "none" }}>{a.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 2, marginBottom: 3 }}>
                                  <input value={actIn} onChange={(e) => setActIn(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") addAction(mKey); }}
                                    placeholder="+ action à faire..." data-ui="true"
                                    style={{ flex: 1, padding: "3px 5px", borderRadius: 3, fontSize: 8, fontFamily: SA, background: P.bg, border: `1px solid ${P.border}`, color: P.bright, outline: "none" }} />
                                  <button onClick={() => addAction(mKey)} data-ui="true"
                                    style={{ padding: "3px 6px", borderRadius: 3, fontSize: 7, background: `${P.orange}15`, border: `1px solid ${P.orange}30`, color: P.orange, cursor: "pointer" }}>+</button>
                                </div>

                                {/* Comments */}
                                {mCmts.map((c, ci) => (
                                  <div key={ci} style={{ fontSize: 8.5, color: P.text, fontFamily: SA, padding: "2px 5px", background: `${P.cyan}04`, borderRadius: 3, marginBottom: 2, borderLeft: `2px solid ${P.cyan}25` }}>
                                    <span style={{ color: P.dim, fontSize: 7, fontFamily: MO }}>{c.t}</span> {c.text}
                                  </div>
                                ))}
                                <div style={{ display: "flex", gap: 2 }}>
                                  <input value={cIn} onChange={(e) => setCIn(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") addComment(mKey); }}
                                    placeholder="commentaire..." data-ui="true"
                                    style={{ flex: 1, padding: "3px 5px", borderRadius: 3, fontSize: 8, fontFamily: SA, background: P.bg, border: `1px solid ${P.border}`, color: P.bright, outline: "none" }} />
                                  <button onClick={() => addComment(mKey)} data-ui="true"
                                    style={{ padding: "3px 6px", borderRadius: 3, fontSize: 7, background: P.cyan, border: "none", color: "#000", cursor: "pointer", fontWeight: 700 }}>↵</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* File actions */}
                    <div style={{ padding: "5px 12px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 3 }}>
                      {FLAGS.map(ft => (
                        <button key={ft.key} onClick={() => toggleFlag(planet.id, ft.key)} data-ui="true"
                          style={{ flex: 1, padding: "3px 0", borderRadius: 4, fontSize: 7.5, fontFamily: SA, background: flag === ft.key ? `${P[ft.c]}10` : "transparent", border: `1px solid ${flag === ft.key ? `${P[ft.c]}35` : P.border}`, color: flag === ft.key ? P[ft.c] : P.dim, cursor: "pointer" }}>
                          {ft.icon} {ft.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
