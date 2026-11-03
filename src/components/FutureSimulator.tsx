import React, { useRef, useEffect, useState } from 'react';
import { CityState, MetricComparison } from '../types/city';
import { cloneMetrics, projectToYear } from '../utils/simulation';
import { roundVal } from '../data/cityData';

interface FutureSimulatorProps {
  state: CityState;
}

export const FutureSimulator: React.FC<FutureSimulatorProps> = ({ state }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2033);
  const [showBaseline, setShowBaseline] = useState<boolean>(true);
  const [showOptimized, setShowOptimized] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const baseMetrics = cloneMetrics(state);
  const baselineProj = projectToYear(baseMetrics, selectedYear, false);
  const optimizedProj = projectToYear(baseMetrics, selectedYear, true);

  const COLORS = {
    bg: '#070e18',
    grid: 'rgba(135, 206, 235, 0.12)',
    muted: '#9cb1c4',
    traffic: '#ff5d5d',
    renewable: '#35d399',
    water: '#28d9ec',
    aqi: '#f2a93b',
    cyan: '#28d9ec',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const pad = { top: 35, right: 30, bottom: 45, left: 55 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Background grid & axes
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    // Horizontal grid lines
    for (let p = 0; p <= 100; p += 25) {
      const y = h - pad.bottom - (p / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.stroke();

      ctx.fillStyle = COLORS.muted;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${p}%`, pad.left - 10, y + 3);
    }

    // Year labels
    ctx.textAlign = 'center';
    for (let y = 2026; y <= 2040; y += 2) {
      const x = pad.left + ((y - 2026) / 14) * chartW;
      ctx.fillText(y.toString(), x, h - pad.bottom + 20);
    }

    // Selected year vertical guideline
    const selectedX = pad.left + ((selectedYear - 2026) / 14) * chartW;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(selectedX, pad.top);
    ctx.lineTo(selectedX, h - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot curves
    const metricKeys: (keyof MetricComparison)[] = ['traffic', 'renewable', 'water', 'aqi'];
    const colors = [COLORS.traffic, COLORS.renewable, COLORS.water, COLORS.aqi];
    const labels = ['Traffic', 'Renewable', 'Water', 'AQI'];

    metricKeys.forEach((key, idx) => {
      const maxVal = key === 'aqi' ? 300 : 100;

      // Baseline line (dashed / dimmer)
      if (showBaseline) {
        ctx.strokeStyle = colors[idx];
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        for (let y = 2026; y <= 2040; y++) {
          const proj = projectToYear(baseMetrics, y, false);
          const x = pad.left + ((y - 2026) / 14) * chartW;
          const val = proj[key];
          const plotY = h - pad.bottom - Math.min(1, val / maxVal) * chartH;
          if (y === 2026) ctx.moveTo(x, plotY);
          else ctx.lineTo(x, plotY);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // AI-Optimized line (solid / glow)
      if (showOptimized) {
        ctx.strokeStyle = colors[idx];
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let y = 2026; y <= 2040; y++) {
          const proj = projectToYear(baseMetrics, y, true);
          const x = pad.left + ((y - 2026) / 14) * chartW;
          const val = proj[key];
          const plotY = h - pad.bottom - Math.min(1, val / maxVal) * chartH;
          if (y === 2026) ctx.moveTo(x, plotY);
          else ctx.lineTo(x, plotY);
        }
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1;

    // Legend
    ctx.textAlign = 'left';
    let legX = pad.left;
    labels.forEach((lbl, idx) => {
      ctx.fillStyle = colors[idx];
      ctx.fillRect(legX, 10, 10, 10);
      ctx.fillStyle = COLORS.muted;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(lbl, legX + 16, 19);
      legX += 95;
    });
  }, [selectedYear, showBaseline, showOptimized, state]);

  const milestones = [
    { year: 2028, title: 'Solar Expansion Phase 1', desc: 'Utility solar farm deployment raises renewable share to 35%.' },
    { year: 2030, title: 'Smart Grid Integration', desc: 'Solid-state battery storage enables 24/7 renewable baseload.' },
    { year: 2033, title: 'Sponge Hydrology Network', desc: 'Citywide rainwater harvesting reaches 60% coverage.' },
    { year: 2036, title: 'Autonomous Transit Corridors', desc: 'Adaptive signal control reduces vehicle congestion by 40%.' },
    { year: 2040, title: 'Carbon Neutral Target', desc: 'Nexus City achieves net-zero greenhouse emissions.' },
  ];

  return (
    <section id="future-section" className="page-section">
      <div className="container">
        <div className="section-eyebrow">LONG-RANGE URBAN TRAJECTORY</div>
        <h2 className="section-heading-lg">Future Simulator (2026 &mdash; 2040).</h2>
        <p className="section-subtext">
          Compare unmanaged baseline urban degradation against sustained AI-driven optimization across India&apos;s next fifteen years of growth.
        </p>

        <div className="future-card-container">
          <div className="future-controls">
            <div className="year-selector">
              <label htmlFor="yearSlider">Target Horizon:</label>
              <input
                type="range"
                id="yearSlider"
                min="2026"
                max="2040"
                step="1"
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
              />
              <span className="year-badge-lg" id="yearDisplay">{selectedYear}</span>
            </div>

            <div className="future-toggles">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showBaseline}
                  onChange={e => setShowBaseline(e.target.checked)}
                />
                <span>Show Baseline Projection (Dashed)</span>
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showOptimized}
                  onChange={e => setShowOptimized(e.target.checked)}
                />
                <span>Show AI-Optimized Target (Solid)</span>
              </label>
            </div>
          </div>

          <div className="future-chart-container" style={{ width: '100%', height: '340px' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
          </div>

          {/* Dynamic Comparison Summary Cards */}
          <div className="future-summary" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="bento-card" style={{ padding: '1.25rem' }}>
                <span className="sys-stat-label">Traffic Congestion ({selectedYear})</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)' }}>
                    {roundVal(optimizedProj.traffic)}%
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--red)', textDecoration: 'line-through' }}>
                    {roundVal(baselineProj.traffic)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  {roundVal(baselineProj.traffic - optimizedProj.traffic)}% reduction via AI Green Waves
                </div>
              </div>

              <div className="bento-card" style={{ padding: '1.25rem' }}>
                <span className="sys-stat-label">Clean Energy Share ({selectedYear})</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)' }}>
                    {roundVal(optimizedProj.renewable)}%
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    vs {roundVal(baselineProj.renewable)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cyan)', marginTop: '0.3rem' }}>
                  +{roundVal(optimizedProj.renewable - baselineProj.renewable)}% clean energy advantage
                </div>
              </div>

              <div className="bento-card" style={{ padding: '1.25rem' }}>
                <span className="sys-stat-label">Air Quality Index ({selectedYear})</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: optimizedProj.aqi <= 100 ? 'var(--green)' : 'var(--amber)' }}>
                    {roundVal(optimizedProj.aqi)} AQI
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--red)', textDecoration: 'line-through' }}>
                    {roundVal(baselineProj.aqi)} AQI
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Safe respiratory corridor preserved
                </div>
              </div>

              <div className="bento-card" style={{ padding: '1.25rem' }}>
                <span className="sys-stat-label">Aquifer Water Reserves ({selectedYear})</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--cyan)' }}>
                    {roundVal(optimizedProj.water)}%
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    vs {roundVal(baselineProj.water)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '0.3rem' }}>
                  Closed-loop sponge retention active
                </div>
              </div>
            </div>
          </div>

          {/* Milestones Grid */}
          <div className="milestone-grid">
            {milestones.map(m => (
              <div
                key={m.year}
                className={`milestone-card ${selectedYear >= m.year ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  borderColor: selectedYear >= m.year ? 'var(--cyan)' : 'var(--border)',
                  background: selectedYear >= m.year ? 'rgba(40, 217, 236, 0.06)' : undefined,
                }}
                onClick={() => setSelectedYear(m.year)}
              >
                <span className="milestone-year">{m.year}</span>
                <h4>{m.title}</h4>
                <p>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
