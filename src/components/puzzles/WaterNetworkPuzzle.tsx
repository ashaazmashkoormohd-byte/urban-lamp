import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { Droplets, CheckCircle, RotateCcw, X, ShieldAlert } from 'lucide-react';

interface WaterNetworkPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

interface Valve {
  id: string;
  name: string;
  stage: string;
  angle: number; // 0: Closed / Misaligned, 90: Open / Aligned
  targetAngle: number;
}

export const WaterNetworkPuzzle: React.FC<WaterNetworkPuzzleProps> = ({ onSolve, onClose }) => {
  const [valves, setValves] = useState<Valve[]>([
    { id: 'v1', name: 'Monsoon Sluice Gate A', stage: 'Stormwater Intake', angle: 0, targetAngle: 90 },
    { id: 'v2', name: 'Sediment Siphon B', stage: 'Coarse Grit Separation', angle: 180, targetAngle: 90 },
    { id: 'v3', name: 'Bio-Sponge Aquifer Intake', stage: 'Subterranean Absorption', angle: 270, targetAngle: 90 },
    { id: 'v4', name: 'UV Purification Polishing Sluice', stage: 'Clean Potable Reserve', angle: 0, targetAngle: 90 },
  ]);

  const [waterLevel, setWaterLevel] = useState(18); // Litres percentage
  const [pressure, setPressure] = useState(4.2); // Bar
  const [isSolved, setIsSolved] = useState(false);

  // Evaluate alignment
  useEffect(() => {
    const alignedCount = valves.filter(v => v.angle % 360 === v.targetAngle).length;
    const progress = Math.round((alignedCount / valves.length) * 100);

    setWaterLevel(18 + Math.round((progress / 100) * 82));
    setPressure(Number((4.2 - (progress / 100) * 2.8).toFixed(1)));

    if (alignedCount === valves.length && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1400);
    }
  }, [valves, isSolved, onSolve]);

  const handleTurnValve = (id: string) => {
    if (isSolved) return;
    soundFx.playPuzzleRotate();
    setValves(prev =>
      prev.map(v => (v.id === id ? { ...v, angle: (v.angle + 90) % 360 } : v))
    );
  };

  const handleReset = () => {
    soundFx.playClick();
    setValves(prev =>
      prev.map((v, idx) => ({ ...v, angle: (idx * 90) % 360 }))
    );
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 02 // YAMUNA ECO-RESERVOIR</span>
            <h3 className="puzzle-title">Closed-Loop Sponge Hydrology &amp; Sluice Routing</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Rotate the 4 hydraulic sluice valves to 90° alignment to direct monsoon flash-flood cloudbursts through all three filtration stages into the subterranean sponge aquifer before street flooding occurs.
        </p>

        {/* Telemetry Bar */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Aquifer Reserve</span>
            <span className="puzzle-status-value color-cyan">{waterLevel}% (4.5M Litres)</span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Drainage System Pressure</span>
            <span className={`puzzle-status-value ${pressure <= 2.0 ? 'color-good' : 'color-amber'}`}>
              {pressure} Bar {pressure <= 2.0 ? '(Nominal Flow)' : '(Overpressure)'}
            </span>
          </div>
        </div>

        {/* Interactive Hydraulic Manifold */}
        <div className="water-valves-grid">
          {valves.map((valve, idx) => {
            const isAligned = valve.angle % 360 === valve.targetAngle;
            return (
              <div key={valve.id} className={`valve-card ${isAligned ? 'aligned' : ''}`}>
                <div className="valve-card-header">
                  <span className="valve-stage-tag">Stage 0{idx + 1}</span>
                  <span className="valve-stage-name">{valve.stage}</span>
                </div>

                <div className="valve-graphic-wrap">
                  <button
                    type="button"
                    className="valve-wheel-btn"
                    onClick={() => handleTurnValve(valve.id)}
                    style={{
                      transform: `rotate(${valve.angle}deg)`,
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    title={`Click to turn ${valve.name}`}
                  >
                    <svg viewBox="0 0 80 80" width="80" height="80">
                      <circle cx="40" cy="40" r="32" fill="#1e293b" stroke={isAligned ? '#06b6d4' : '#475569'} strokeWidth="4" />
                      {/* Valve Spokes */}
                      <line x1="40" y1="8" x2="40" y2="72" stroke={isAligned ? '#06b6d4' : '#94a3b8'} strokeWidth="5" strokeLinecap="round" />
                      <line x1="8" y1="40" x2="72" y2="40" stroke={isAligned ? '#06b6d4' : '#94a3b8'} strokeWidth="5" strokeLinecap="round" />
                      {/* Center Hub */}
                      <circle cx="40" cy="40" r="10" fill={isAligned ? '#06b6d4' : '#64748b'} />
                      {/* Flow directional arrow */}
                      <polygon points="40,12 36,22 44,22" fill={isAligned ? '#ffffff' : '#94a3b8'} />
                    </svg>
                  </button>
                </div>

                <div className="valve-meta">
                  <span className="valve-title">{valve.name}</span>
                  <span className={`valve-status ${isAligned ? 'color-good' : 'color-amber'}`}>
                    {isAligned ? '✓ Sluice Open (100% Flow)' : '× Sluice Diverted / Blocked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Success Banner */}
        {isSolved && (
          <div className="puzzle-success-banner">
            <CheckCircle size={20} className="color-good" />
            <span>AQUIFER RECHARGED! Monsoon storm volume safely captured in subterranean sponge cells.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Valves
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
