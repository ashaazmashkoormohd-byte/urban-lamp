import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { Navigation, CheckCircle, RotateCcw, X, Activity } from 'lucide-react';

interface TrafficPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

interface ArterialSignal {
  id: string;
  name: string;
  intersection: string;
  currentPhase: number; // 0 - 100
  targetPhase: number;  // Target alignment range +/- 6
  congestion: number;    // %
}

export const TrafficPuzzle: React.FC<TrafficPuzzleProps> = ({ onSolve, onClose }) => {
  const [signals, setSignals] = useState<ArterialSignal[]>([
    { id: 'sig1', name: 'North Boulevard Corridors', intersection: 'Int. C-1 CBD North', currentPhase: 12, targetPhase: 40, congestion: 88 },
    { id: 'sig2', name: 'Central Ring Express', intersection: 'Int. C-2 Metro Hub', currentPhase: 85, targetPhase: 65, congestion: 92 },
    { id: 'sig3', name: 'South Arterial Bypass', intersection: 'Int. C-3 Arcology Spine', currentPhase: 20, targetPhase: 50, congestion: 84 },
  ]);

  const [avgCongestion, setAvgCongestion] = useState(88);
  const [syncAccuracy, setSyncAccuracy] = useState(35);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    let totalError = 0;
    signals.forEach(s => {
      totalError += Math.abs(s.currentPhase - s.targetPhase);
    });

    const maxError = 150;
    const accuracy = Math.max(0, Math.min(100, Math.round((1 - totalError / maxError) * 100)));
    const congestion = Math.max(18, Math.round(90 - (accuracy / 100) * 72));

    setSyncAccuracy(accuracy);
    setAvgCongestion(congestion);

    const allAligned = signals.every(s => Math.abs(s.currentPhase - s.targetPhase) <= 6);

    if (allAligned && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1400);
    }
  }, [signals, isSolved, onSolve]);

  const handlePhaseChange = (id: string, val: number) => {
    if (isSolved) return;
    setSignals(prev =>
      prev.map(s => (s.id === id ? { ...s, currentPhase: val } : s))
    );
  };

  const handleReset = () => {
    soundFx.playClick();
    setSignals(prev => [
      { ...prev[0], currentPhase: 10 },
      { ...prev[1], currentPhase: 90 },
      { ...prev[2], currentPhase: 15 },
    ]);
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 03 // CBD TRAFFIC INTELLIGENCE</span>
            <h3 className="puzzle-title">Adaptive Wave Signal Optimization</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Adjust the phase offset timing for all three major arterial intersections. Aligning the signal frequency waveforms produces an uninterrupted &ldquo;Green Wave&rdquo; corridor, clearing vehicle queues and granting priority to emergency dispatch.
        </p>

        {/* Telemetry Bar */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Green Wave Synchronization</span>
            <span className={`puzzle-status-value ${syncAccuracy >= 88 ? 'color-good' : 'color-cyan'}`}>
              {syncAccuracy}% {syncAccuracy >= 88 ? '(Phase Locked)' : '(Harmonizing)'}
            </span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Arterial Congestion</span>
            <span className={`puzzle-status-value ${avgCongestion < 35 ? 'color-good' : 'color-amber'}`}>
              {avgCongestion}% {avgCongestion < 35 ? '(Free Flow)' : '(Gridlock)'}
            </span>
          </div>
        </div>

        {/* Waveform Visualization Canvas */}
        <div className="traffic-waveform-box">
          <div className="waveform-header">
            <Activity size={14} className="color-cyan" style={{ marginRight: '6px' }} />
            <span>METROPOLITAN TRAFFIC WAVE RESIDUAL</span>
          </div>
          <div className="waveform-visual-track">
            {signals.map((s, idx) => {
              const diff = Math.abs(s.currentPhase - s.targetPhase);
              const inSync = diff <= 6;
              return (
                <div key={s.id} className="signal-wave-row">
                  <span className="signal-row-label">Avenue 0{idx + 1}</span>
                  <div className="wave-bar-bg">
                    {/* Target Window */}
                    <div
                      className="target-window-zone"
                      style={{
                        left: `${s.targetPhase - 6}%`,
                        width: '12%',
                      }}
                      title="Target Synchronization Window"
                    />
                    {/* Current Position Marker */}
                    <div
                      className={`current-phase-pin ${inSync ? 'in-sync' : ''}`}
                      style={{
                        left: `${s.currentPhase}%`,
                      }}
                    />
                  </div>
                  <span className={`signal-sync-tag ${inSync ? 'color-good' : 'color-muted'}`}>
                    {inSync ? 'LOCKED' : `${Math.round(diff)}ms`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase Adjusters */}
        <div className="traffic-sliders-container">
          {signals.map(s => {
            const inSync = Math.abs(s.currentPhase - s.targetPhase) <= 6;
            return (
              <div key={s.id} className="traffic-slider-group">
                <div className="slider-label-row">
                  <div>
                    <span className="slider-title">{s.name}</span>
                    <span className="slider-sub">{s.intersection}</span>
                  </div>
                  <span className={`slider-value ${inSync ? 'color-good' : 'color-cyan'}`}>
                    {s.currentPhase}% Phase
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={s.currentPhase}
                  onChange={e => handlePhaseChange(s.id, parseInt(e.target.value, 10))}
                  className="traffic-range-input"
                  disabled={isSolved}
                />
              </div>
            );
          })}
        </div>

        {/* Success Banner */}
        {isSolved && (
          <div className="puzzle-success-banner">
            <CheckCircle size={20} className="color-good" />
            <span>GREEN WAVE ESTABLISHED! Arterial vehicle queue cleared. Emergency corridors active.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Signal Phasing
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
