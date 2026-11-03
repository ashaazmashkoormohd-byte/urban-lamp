import React, { useRef, useEffect, useState, useMemo } from 'react';
import { CityState, LogEntry, MetricComparison, MetricStatus } from '../types/city';
import {
  roundVal,
  trafficStatus,
  renewableStatus,
  waterStatus,
  aqiStatus,
  marginStatus,
  FIELD_META,
  OPTIMIZATION_RULES,
  EMERGENCIES,
  PRESETS,
} from '../data/cityData';
import { getRecommendations } from '../utils/simulation';
import {
  BarChart3,
  Cpu,
  Zap,
  AlertTriangle,
  Layers,
  Map,
  Info,
  CheckCircle2,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';

interface OperationsSuiteProps {
  state: CityState;
  history: Record<string, number[]>;
  logs: LogEntry[];
  activeOpsTab: string;
  onSelectOpsTab: (tab: string) => void;
  onOptimizeCity: () => void;
  onTriggerEmergency: (id: string) => void;
  onDeployEmergencyResponse: () => void;
  onApplyScenario: (presetKey: string) => void;
  onClearLogs: () => void;
  comparisonData: { before: MetricComparison; after: MetricComparison; title: string } | null;
}

export const OperationsSuite: React.FC<OperationsSuiteProps> = ({
  state,
  history,
  logs,
  activeOpsTab,
  onSelectOpsTab,
  onOptimizeCity,
  onTriggerEmergency,
  onDeployEmergencyResponse,
  onApplyScenario,
  onClearLogs,
  comparisonData,
}) => {
  const m = state.metrics;
  const tStat = trafficStatus(m.traffic);
  const rStat = renewableStatus(m.renewable);
  const wStat = waterStatus(m.water);
  const aStat = aqiStatus(m.aqi);
  const mStat = marginStatus(m.supply, m.demand);
  const margin = m.supply - m.demand;

  const recs = useMemo(() => getRecommendations(state), [state]);

  // 2D Map Canvas Ref & State
  const map2dCanvasRef = useRef<HTMLCanvasElement>(null);
  const [map2dZoom, setMap2dZoom] = useState<number>(1);
  const [map2dPan, setMap2dPan] = useState<{ x: number; y: number }>({ x: 450, y: 260 });
  const isDraggingMapRef = useRef<boolean>(false);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Comparison Chart Canvas Ref
  const compCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render 2D Topographical Map Canvas
  useEffect(() => {
    if (activeOpsTab !== 'map2d') return;
    const canvas = map2dCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(map2dPan.x, map2dPan.y);
    ctx.scale(map2dZoom, map2dZoom);
    ctx.translate(-w / 2, -h / 2);

    // Parchment texture
    const parchment = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 1.4);
    parchment.addColorStop(0, '#f5e6c7');
    parchment.addColorStop(0.4, '#e9d6ac');
    parchment.addColorStop(0.8, '#d7c296');
    parchment.addColorStop(1, '#c5b186');
    ctx.fillStyle = parchment;
    ctx.fillRect(0, 0, w, h);

    // Subtle paper noise
    ctx.fillStyle = 'rgba(139, 119, 82, 0.04)';
    for (let i = 0; i < 3000; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }

    // Topographic contours
    ctx.strokeStyle = 'rgba(101, 67, 33, 0.15)';
    ctx.lineWidth = 1.5;
    for (let elev = 0; elev < 5; elev++) {
      const baseR = 190 + elev * 38;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
        const rad = baseR + Math.sin(angle * 3) * 25 + Math.cos(angle * 5) * 18;
        const px = w / 2 + Math.cos(angle) * rad;
        const py = h / 2 + Math.sin(angle) * rad * 0.7;
        if (angle === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Hand-drawn Roads
    const drawWavyLine = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const segs = 24;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const lx = x1 + (x2 - x1) * t;
        const ly = y1 + (y2 - y1) * t;
        const offset = Math.sin(t * Math.PI * 4) * 3;
        ctx.lineTo(lx, ly + offset);
      }
      ctx.stroke();
    };

    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    [-136, 0, 136].forEach(dx => {
      const rx = w / 2 + dx;
      drawWavyLine(rx, 40, rx, h - 40);
    });
    [-72, 72].forEach(dz => {
      const ry = h / 2 + dz;
      drawWavyLine(40, ry, w - 40, ry);
    });

    // Dashed center road stripes
    ctx.strokeStyle = '#a67c52';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    [-136, 0, 136].forEach(dx => {
      const rx = w / 2 + dx;
      drawWavyLine(rx, 40, rx, h - 40);
    });
    [-72, 72].forEach(dz => {
      const ry = h / 2 + dz;
      drawWavyLine(40, ry, w - 40, ry);
    });
    ctx.setLineDash([]);

    // Zones
    const zones2d = [
      { id: 'res-a', x: w / 2 - 244, y: h / 2 - 160, label: 'Residential A', icon: '🏘', type: 'residential' },
      { id: 'cbd', x: w / 2 - 68, y: h / 2 - 160, label: 'CBD Core', icon: '🏛', type: 'cbd' },
      { id: 'res-b', x: w / 2 + 68, y: h / 2 - 160, label: 'Residential B', icon: '🏘', type: 'residential' },
      { id: 'park-a', x: w / 2 + 244, y: h / 2 - 160, label: 'Central Park', icon: '🌲', type: 'park' },
      { id: 'hospital', x: w / 2 - 244, y: h / 2, label: 'Hospital Hub', icon: '⚕', type: 'hospital' },
      { id: 'solar-a', x: w / 2 - 68, y: h / 2, label: 'Solar North', icon: '☀', type: 'solar' },
      { id: 'solar-b', x: w / 2 + 68, y: h / 2, label: 'Solar East', icon: '☀', type: 'solar' },
      { id: 'substation', x: w / 2 + 244, y: h / 2, label: 'Substation', icon: '⚡', type: 'power' },
      { id: 'reservoir', x: w / 2 - 244, y: h / 2 + 136, label: 'Eco-Reservoir', icon: '💧', type: 'water' },
      { id: 'wind', x: w / 2 - 68, y: h / 2 + 136, label: 'Wind Farm', icon: '🌪', type: 'wind' },
      { id: 'metro', x: w / 2 + 68, y: h / 2 + 136, label: 'Metro Viaduct', icon: '🚂', type: 'transit' },
      { id: 'park-b', x: w / 2 + 244, y: h / 2 + 136, label: 'Riverside Wetland', icon: '🌲', type: 'park' },
    ];

    zones2d.forEach(zone => {
      let statusBorder = '#4a7c59';
      if (zone.type === 'residential' || zone.type === 'cbd') {
        const s = trafficStatus(m.traffic);
        statusBorder = s === 'good' ? '#4a7c59' : s === 'moderate' ? '#c4a35a' : '#b84949';
      } else if (zone.type === 'solar' || zone.type === 'wind') {
        const s = renewableStatus(m.renewable);
        statusBorder = s === 'good' ? '#4a7c59' : s === 'moderate' ? '#c4a35a' : '#b84949';
      } else if (zone.type === 'water') {
        const s = waterStatus(m.water);
        statusBorder = s === 'good' ? '#4a7c59' : s === 'moderate' ? '#c4a35a' : '#b84949';
      } else if (zone.type === 'power') {
        const s = marginStatus(m.supply, m.demand);
        statusBorder = s === 'good' ? '#4a7c59' : s === 'moderate' ? '#c4a35a' : '#b84949';
      }

      // Organic blob
      ctx.save();
      ctx.translate(zone.x, zone.y);

      ctx.fillStyle = 'rgba(74, 124, 89, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = statusBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.icon, 0, -4);

      ctx.font = 'italic bold 11px Georgia, serif';
      ctx.fillStyle = '#3a2a1a';
      ctx.fillText(zone.label.toUpperCase(), 0, 24);

      ctx.restore();
    });

    // Compass Rose
    const compX = w - 60;
    const compY = 60;
    ctx.strokeStyle = '#5c4a3a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(compX, compY, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#b84949';
    ctx.beginPath();
    ctx.moveTo(compX, compY - 26);
    ctx.lineTo(compX - 6, compY - 2);
    ctx.lineTo(compX + 6, compY - 2);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 12px Georgia, serif';
    ctx.fillStyle = '#2c2c2c';
    ctx.textAlign = 'center';
    ctx.fillText('N', compX, compY - 34);

    // Title & Scale
    ctx.font = 'italic bold 22px Georgia, serif';
    ctx.fillStyle = '#4a3a2a';
    ctx.textAlign = 'left';
    ctx.fillText('NEXUS CITY // TOPOGRAPHICAL TWIN', 30, 36);

    ctx.font = 'italic 11px Georgia, serif';
    ctx.fillStyle = '#6b5a4a';
    ctx.fillText('Autonomous Municipal Hydrology & Corridors · Scale 1:5000', 30, 56);

    ctx.restore();
  }, [activeOpsTab, map2dZoom, map2dPan, m]);

  // Render Before/After Comparison Chart if present
  useEffect(() => {
    if (!comparisonData || activeOpsTab !== 'optimize') return;
    const canvas = compCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const keys: (keyof MetricComparison)[] = ['traffic', 'renewable', 'water', 'aqi', 'demand', 'hospitalLoad'];
    const barW = 28;
    const groupGap = 85;
    const startX = 60;

    keys.forEach((k, i) => {
      const gx = startX + i * groupGap;
      const bVal = comparisonData.before[k];
      const aVal = comparisonData.after[k];
      const maxVal = k === 'aqi' ? 300 : 100;

      const bH = (bVal / maxVal) * (h - 80);
      const aH = (aVal / maxVal) * (h - 80);

      // Before bar (dim gray/amber)
      ctx.fillStyle = 'rgba(255, 93, 93, 0.4)';
      ctx.fillRect(gx, h - 40 - bH, barW, bH);

      // After bar (cyan/green)
      ctx.fillStyle = 'rgba(53, 211, 153, 0.85)';
      ctx.fillRect(gx + barW + 4, h - 40 - aH, barW, aH);

      // Label
      ctx.fillStyle = '#9cb1c4';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(k.slice(0, 4).toUpperCase(), gx + barW, h - 20);
    });

    // Legend
    ctx.fillStyle = 'rgba(255, 93, 93, 0.5)';
    ctx.fillRect(startX, 15, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Before', startX + 18, 25);

    ctx.fillStyle = 'rgba(53, 211, 153, 0.85)';
    ctx.fillRect(startX + 80, 15, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText('After Optimization', startX + 98, 25);
  }, [comparisonData, activeOpsTab]);

  // Helper Sparkline SVG generator
  const renderSparkline = (data: number[], color: string) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 240;
    const h = 38;

    const points = data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * w;
        const y = h - ((val - min) / range) * (h - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width={w} height={h} style={{ width: '100%', height: '38px', marginTop: '0.6rem' }}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      </svg>
    );
  };

  return (
    <section id="operations-suite" className="page-section">
      <div className="container">
        <div className="section-eyebrow">COMMAND &amp; CONTROL ENVIRONMENT</div>
        <h2 className="section-heading-lg">Simulation Operations Suite.</h2>
        <p className="section-subtext">
          Access the deep simulation suite: live sensor telemetry, rule engine recommendations, deterministic budget optimizer, crisis sandbox, and 2D topographical mapping.
        </p>

        <div className="operations-deck">
          {/* Subnav Navigation */}
          <nav className="ops-subnav" aria-label="Operations Tools">
            {[
              { id: 'metrics', label: '📊 Live Metrics' },
              { id: 'engine', label: '⚙️ Decision Engine' },
              { id: 'optimize', label: '⚡ Optimization (100 Budget)' },
              { id: 'emergencies', label: '🚨 Crisis Sandbox' },
              { id: 'scenarios', label: '🎭 Scenario Presets' },
              { id: 'map2d', label: '🗺️ 2D Topo Map' },
              { id: 'about', label: 'ℹ️ About & Ethics' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`ops-tab-btn ${activeOpsTab === tab.id ? 'active' : ''}`}
                onClick={() => onSelectOpsTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab 1: Live Metrics */}
          {activeOpsTab === 'metrics' && (
            <div className="ops-tool-panel active">
              <div className="metric-grid">
                {/* Traffic */}
                <article className="metric-card">
                  <header>
                    <h2>Traffic Congestion</h2>
                    <span className={`status-pill ${tStat}`}>
                      {tStat === 'good' ? 'Optimal Flow' : tStat === 'moderate' ? 'Moderate' : 'Critical'}
                    </span>
                  </header>
                  <div className="metric-value">
                    <span>{roundVal(m.traffic)}</span>
                    <span className="metric-unit">%</span>
                  </div>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: `${m.traffic}%`,
                        background: tStat === 'good' ? 'var(--green)' : tStat === 'moderate' ? 'var(--amber)' : 'var(--red)',
                      }}
                    />
                  </div>
                  {renderSparkline(history['traffic'], tStat === 'good' ? 'var(--green)' : 'var(--red)')}
                </article>

                {/* Renewable */}
                <article className="metric-card">
                  <header>
                    <h2>Renewable Energy Share</h2>
                    <span className={`status-pill ${rStat}`}>
                      {rStat === 'good' ? 'Target Met' : rStat === 'moderate' ? 'Hybrid' : 'Deficit'}
                    </span>
                  </header>
                  <div className="metric-value">
                    <span>{roundVal(m.renewable)}</span>
                    <span className="metric-unit">%</span>
                  </div>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: `${m.renewable}%`,
                        background: rStat === 'good' ? 'var(--green)' : rStat === 'moderate' ? 'var(--amber)' : 'var(--red)',
                      }}
                    />
                  </div>
                  {renderSparkline(history['renewable'], 'var(--green)')}
                </article>

                {/* Water */}
                <article className="metric-card">
                  <header>
                    <h2>Water Reserves</h2>
                    <span className={`status-pill ${wStat}`}>
                      {wStat === 'good' ? 'Sponge Full' : wStat === 'moderate' ? 'Safe' : 'Depleted'}
                    </span>
                  </header>
                  <div className="metric-value">
                    <span>{roundVal(m.water)}</span>
                    <span className="metric-unit">%</span>
                  </div>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: `${m.water}%`,
                        background: wStat === 'good' ? 'var(--cyan)' : wStat === 'moderate' ? 'var(--amber)' : 'var(--red)',
                      }}
                    />
                  </div>
                  {renderSparkline(history['water'], 'var(--cyan)')}
                </article>

                {/* AQI */}
                <article className="metric-card">
                  <header>
                    <h2>Air Quality Index</h2>
                    <span className={`status-pill ${aStat}`}>
                      {aStat === 'good' ? 'Clean Air' : aStat === 'moderate' ? 'Moderate' : 'Hazardous'}
                    </span>
                  </header>
                  <div className="metric-value">
                    <span>{roundVal(m.aqi)}</span>
                    <span className="metric-unit">AQI</span>
                  </div>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: `${Math.min(100, (m.aqi / 300) * 100)}%`,
                        background: aStat === 'good' ? 'var(--green)' : aStat === 'moderate' ? 'var(--amber)' : 'var(--red)',
                      }}
                    />
                  </div>
                  {renderSparkline(history['aqi'], aStat === 'good' ? 'var(--green)' : 'var(--amber)')}
                </article>

                {/* Demand */}
                <article className="metric-card">
                  <header>
                    <h2>Electricity Demand</h2>
                    <span className={`status-pill ${mStat}`}>
                      {mStat === 'good' ? 'Balanced' : mStat === 'moderate' ? 'High Load' : 'Critical Spike'}
                    </span>
                  </header>
                  <div className="metric-value">
                    <span>{roundVal(m.demand)}</span>
                    <span className="metric-unit">% of grid</span>
                  </div>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: `${m.demand}%`,
                        background: mStat === 'good' ? 'var(--green)' : 'var(--amber)',
                      }}
                    />
                  </div>
                  {renderSparkline(history['demand'], 'var(--amber)')}
                </article>
              </div>

              {/* Grid & Environment Detail Row */}
              <div style={{ marginTop: '2.5rem' }}>
                <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  Grid &amp; Environment Detail
                </h4>
                <div className="stat-row-grid">
                  <div className="sys-stat-box">
                    <span className="sys-stat-label">Ambient Temperature</span>
                    <span className="sys-stat-val" style={{ color: state.temperature > 38 ? 'var(--red)' : 'var(--cyan)' }}>
                      {roundVal(state.temperature)}°C
                    </span>
                  </div>
                  <div className="sys-stat-box">
                    <span className="sys-stat-label">Hospital Surge Load</span>
                    <span className="sys-stat-val" style={{ color: state.hospitalLoad > 70 ? 'var(--red)' : 'var(--green)' }}>
                      {roundVal(state.hospitalLoad)}%
                    </span>
                  </div>
                  <div className="sys-stat-box">
                    <span className="sys-stat-label">Total Grid Supply</span>
                    <span className="sys-stat-val" style={{ color: 'var(--green)' }}>
                      {roundVal(m.supply)}%
                    </span>
                  </div>
                  <div className="sys-stat-box">
                    <span className="sys-stat-label">Net Supply Margin</span>
                    <span className="sys-stat-val" style={{ color: margin >= 10 ? 'var(--green)' : margin >= 0 ? 'var(--amber)' : 'var(--red)' }}>
                      {margin >= 0 ? `+${roundVal(margin)}%` : `${roundVal(margin)}%`}
                    </span>
                  </div>
                  <div className="sys-stat-box">
                    <span className="sys-stat-label">Managed Citizens</span>
                    <span className="sys-stat-val" style={{ color: '#fff' }}>
                      2,400,000
                    </span>
                  </div>
                  <div className="sys-stat-box">
                    <span className="sys-stat-label">Active Climate Hazard</span>
                    <span className="sys-stat-val" style={{ color: state.activeEmergency ? 'var(--red)' : 'var(--green)' }}>
                      {state.activeEmergency ? EMERGENCIES[state.activeEmergency.id]?.label : 'None (Nominal)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Decision Engine */}
          {activeOpsTab === 'engine' && (
            <div className="ops-tool-panel active">
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                A deterministic rule-based reasoning system. Every recommendation surfaces from explicit threshold checks defined in code, ensuring transparent traceability for municipal stakeholders.
              </p>
              <div className="engine-grid">
                <div className="recommendations" id="recommendationsPanel">
                  <h3>Current Advisory Recommendations ({recs.length})</h3>
                  <div id="recommendationsList" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recs.map(r => (
                      <div
                        key={r.id}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderLeft: `4px solid ${
                            r.severity === 'critical'
                              ? 'var(--red)'
                              : r.severity === 'warning'
                              ? 'var(--amber)'
                              : 'var(--green)'
                          }`,
                          borderTop: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, color: '#fff' }}>{r.title}</span>
                          <span
                            className="status-pill"
                            style={{
                              background:
                                r.severity === 'critical'
                                  ? 'var(--red-dim)'
                                  : r.severity === 'warning'
                                  ? 'var(--amber-dim)'
                                  : 'var(--green-dim)',
                              color:
                                r.severity === 'critical'
                                  ? 'var(--red)'
                                  : r.severity === 'warning'
                                  ? 'var(--amber)'
                                  : 'var(--green)',
                            }}
                          >
                            {r.id}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)' }}>{r.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="decision-log-panel">
                  <div className="log-header">
                    <h3>AI Decision Log ({logs.length})</h3>
                    <button onClick={onClearLogs} className="btn btn-ghost btn-sm" type="button">
                      <Trash2 size={13} style={{ marginRight: '4px' }} /> Clear Log
                    </button>
                  </div>
                  <div className="decision-log" id="decisionLog" role="log" aria-live="polite">
                    {logs.length === 0 ? (
                      <div className="log-empty">
                        No events yet. Trigger a scenario or run an optimization to populate the log.
                      </div>
                    ) : (
                      logs.map(e => (
                        <div key={e.id} className={`log-entry ${e.severity}`}>
                          <span className="log-time">[{e.time}]</span>{' '}
                          <span className="log-tag">{e.tag}</span> &mdash;{' '}
                          <strong>{e.title}:</strong> {e.detail}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Optimization */}
          {activeOpsTab === 'optimize' && (
            <div className="ops-tool-panel active">
              <div className="resource-meter">
                <div className="rm-head">
                  <span>Infrastructure Budget (Max 100)</span>
                  <span id="infraBudgetLabel">{roundVal(state.budgets.infra)} / {state.budgets.infraMax} Units</span>
                </div>
                <div className="rm-track">
                  <div
                    className="rm-fill"
                    id="infraBudgetFill"
                    style={{
                      width: `${(state.budgets.infra / state.budgets.infraMax) * 100}%`,
                      background: state.budgets.infra > 30 ? 'var(--cyan)' : 'var(--red)',
                    }}
                  />
                </div>
              </div>

              <button
                id="optimizeBtn"
                className="btn btn-primary btn-lg"
                type="button"
                style={{ marginBottom: '2rem' }}
                onClick={onOptimizeCity}
              >
                ⚡ Optimize City Under 100-Unit Budget
              </button>

              <div className="rules-reference">
                <h4 style={{ marginBottom: '0.75rem' }}>Optimization Rule Set (Deterministic Specification)</h4>
                {OPTIMIZATION_RULES.map(rule => (
                  <div key={rule.id} className="rule-row">
                    <span className="rule-name">{rule.id} &mdash; {rule.title}</span>
                    <span className="rule-cost">Cost: {rule.cost} Units</span>
                    <span className="rule-detail">
                      Triggers: {rule.detect(state)}. Spends from Infrastructure Budget with proportional downscaling if budget is partial.
                    </span>
                  </div>
                ))}
              </div>

              {/* Before / After Comparison */}
              <div style={{ marginTop: '2rem' }}>
                <h4>Before / After Optimization Comparison</h4>
                {!comparisonData ? (
                  <p className="empty-state" id="comparisonEmpty">
                    Click <strong>Optimize City Under 100-Unit Budget</strong> above or deploy an emergency response to generate the comparison charts.
                  </p>
                ) : (
                  <div id="comparisonContent">
                    <div style={{ width: '100%', height: '260px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                      <canvas ref={compCanvasRef} width={640} height={240} style={{ width: '100%', height: '100%' }} />
                    </div>

                    <div className="comparison-table" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '0.6rem' }}>Metric</th>
                            <th style={{ padding: '0.6rem' }}>Before</th>
                            <th style={{ padding: '0.6rem' }}>After</th>
                            <th style={{ padding: '0.6rem' }}>Delta Improvement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(FIELD_META).map(key => {
                            const meta = FIELD_META[key];
                            const bVal = comparisonData.before[key as keyof MetricComparison];
                            const aVal = comparisonData.after[key as keyof MetricComparison];
                            const diff = aVal - bVal;
                            const isGood = meta.higherIsBetter ? diff > 0 : diff < 0;

                            return (
                              <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.6rem', color: '#fff', fontWeight: 600 }}>{meta.label}</td>
                                <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>
                                  {roundVal(bVal)}{meta.unit}
                                </td>
                                <td style={{ padding: '0.6rem', fontWeight: 700, color: '#fff' }}>
                                  {roundVal(aVal)}{meta.unit}
                                </td>
                                <td style={{ padding: '0.6rem', color: isGood ? 'var(--green)' : diff === 0 ? 'var(--text-muted)' : 'var(--red)', fontWeight: 700 }}>
                                  {diff > 0 ? `+${roundVal(diff)}` : roundVal(diff)}{meta.unit}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Emergencies */}
          {activeOpsTab === 'emergencies' && (
            <div className="ops-tool-panel active">
              {state.activeEmergency ? (
                <div className="emergency-banner" style={{ display: 'flex' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--red)' }}>
                      🚨 ACTIVE EMERGENCY: {EMERGENCIES[state.activeEmergency.id]?.label.toUpperCase()}
                    </strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {EMERGENCIES[state.activeEmergency.id]?.description}
                    </div>
                  </div>
                  <button
                    id="deployResponseBtn"
                    className="btn btn-primary"
                    type="button"
                    onClick={onDeployEmergencyResponse}
                  >
                    Deploy Emergency Response ({EMERGENCIES[state.activeEmergency.id]?.responseCost} Capacity)
                  </button>
                </div>
              ) : (
                <div style={{ padding: '1rem', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', marginBottom: '1.5rem', color: 'var(--green)' }}>
                  ✓ All urban sectors are currently nominal. Select an emergency below to trigger a stress test.
                </div>
              )}

              <div className="emergency-grid">
                {Object.values(EMERGENCIES).map(em => (
                  <button
                    key={em.id}
                    className="emergency-card"
                    onClick={() => onTriggerEmergency(em.id)}
                    type="button"
                    disabled={!!state.activeEmergency}
                    style={{ opacity: state.activeEmergency ? 0.6 : 1 }}
                  >
                    <div className="ec-icon">{em.icon}</div>
                    <h3>{em.label}</h3>
                    <p>{em.description}</p>
                  </button>
                ))}
              </div>

              <div className="resource-meter" style={{ marginTop: '2rem' }}>
                <div className="rm-head">
                  <span>Emergency Response Capacity</span>
                  <span id="responseBudgetLabel">
                    {roundVal(state.budgets.response)} / {state.budgets.responseMax} Units
                  </span>
                </div>
                <div className="rm-track">
                  <div
                    className="rm-fill"
                    id="responseBudgetFill"
                    style={{
                      width: `${(state.budgets.response / state.budgets.responseMax) * 100}%`,
                      background: 'var(--green)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Scenario Presets */}
          {activeOpsTab === 'scenarios' && (
            <div className="ops-tool-panel active">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Load pre-configured metropolitan scenarios to evaluate the intelligence system under diverse climate conditions.
              </p>
              <div className="scenario-grid">
                {Object.values(PRESETS).map(preset => (
                  <button
                    key={preset.id}
                    className="scenario-card"
                    onClick={() => onApplyScenario(preset.id)}
                    type="button"
                  >
                    <h3>{preset.label}</h3>
                    <p>{preset.blurb}</p>
                    <div style={{ marginTop: '0.8rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
                      Traffic: {preset.metrics.traffic}% · Renewable: {preset.metrics.renewable}% · Temp: {preset.temperature}°C
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 6: 2D Map */}
          {activeOpsTab === 'map2d' && (
            <div className="ops-tool-panel active">
              <div className="map2d-wrapper" style={{ position: 'relative' }}>
                <canvas
                  ref={map2dCanvasRef}
                  width={900}
                  height={520}
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius)', cursor: 'grab' }}
                  onMouseDown={e => {
                    isDraggingMapRef.current = true;
                    lastMouseRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onMouseMove={e => {
                    if (!isDraggingMapRef.current) return;
                    const dx = e.clientX - lastMouseRef.current.x;
                    const dy = e.clientY - lastMouseRef.current.y;
                    setMap2dPan(p => ({ x: p.x + dx, y: p.y + dy }));
                    lastMouseRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onMouseUp={() => {
                    isDraggingMapRef.current = false;
                  }}
                  onMouseLeave={() => {
                    isDraggingMapRef.current = false;
                  }}
                  onWheel={e => {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    setMap2dZoom(z => Math.max(0.6, Math.min(3, z * delta)));
                  }}
                />
                <div className="map2d-controls">
                  <button
                    className="map2d-btn"
                    type="button"
                    title="Zoom In"
                    onClick={() => setMap2dZoom(z => Math.min(3, z * 1.2))}
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    className="map2d-btn"
                    type="button"
                    title="Zoom Out"
                    onClick={() => setMap2dZoom(z => Math.max(0.6, z / 1.2))}
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    className="map2d-btn"
                    type="button"
                    title="Reset View"
                    onClick={() => {
                      setMap2dZoom(1);
                      setMap2dPan({ x: 450, y: 260 });
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 7: About */}
          {activeOpsTab === 'about' && (
            <div className="ops-tool-panel active">
              <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1.5rem', color: '#fff' }}>About NEXUS 2040</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  NEXUS 2040 is a conceptual demonstration built for India&apos;s Vision 2040 &mdash; a technologically advanced, sustainable urban paradigm. It simulates a fictional smart city, &ldquo;Nexus City,&rdquo; showing how transparent rule-based architectures empower municipal operators to manage resource allocation with zero hallucinations and full public accountability.
                </p>

                <div className="rule-highlight-box">
                  <strong>Simulated Proof of Concept:</strong> This software uses deterministic if/else logic, not an opaque black-box deep learning model. It does not read real-world physical sensors or external APIs. All telemetry is synthetically computed in your browser.
                </div>

                <div className="bento-grid" style={{ marginTop: '1rem' }}>
                  <div className="bento-card span-6">
                    <h4>Core Principles</h4>
                    <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8, paddingLeft: '1rem', listStyle: 'disc' }}>
                      <li>Deterministic auditability: every decision traces to a code line.</li>
                      <li>Finite budget economics: zero deficit interventions.</li>
                      <li>Instant multi-hazard resilience: under 120s sluice response.</li>
                    </ul>
                  </div>

                  <div className="bento-card span-6">
                    <h4>Exhibition Metadata</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Target Horizon: 2040 Net-Zero Smart City<br/>
                      Runtime: Client-side React 19 + Three.js<br/>
                      Zero External Cloud Dependencies · Offline Capable
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
};
