import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { ShieldAlert, CheckCircle, RotateCcw, X, HeartPulse } from 'lucide-react';

interface HospitalMicrogridPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

interface HospitalSystem {
  id: string;
  name: string;
  minKw: number;
  allocatedKw: number;
  status: 'critical' | 'stable';
}

export const HospitalMicrogridPuzzle: React.FC<HospitalMicrogridPuzzleProps> = ({ onSolve, onClose }) => {
  const maxMicrogridCapacity = 100; // kW

  const [systems, setSystems] = useState<HospitalSystem[]>([
    { id: 'icu', name: 'Trauma ICU & Life Support', minKw: 35, allocatedKw: 20, status: 'critical' },
    { id: 'surgery', name: 'Emergency Surgical Suites', minKw: 30, allocatedKw: 15, status: 'critical' },
    { id: 'evac', name: 'High-Speed Evacuation Lifts', minKw: 15, allocatedKw: 10, status: 'critical' },
    { id: 'iso', name: 'Negative-Pressure Isolation Ward', minKw: 20, allocatedKw: 10, status: 'critical' },
  ]);

  const [totalAllocated, setTotalAllocated] = useState(55);
  const [isOverloaded, setIsOverloaded] = useState(false);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const total = systems.reduce((sum, s) => sum + s.allocatedKw, 0);
    setTotalAllocated(total);
    const overload = total > maxMicrogridCapacity;
    setIsOverloaded(overload);

    const allSatisfied = systems.every(s => s.allocatedKw >= s.minKw);

    if (allSatisfied && !overload && total === maxMicrogridCapacity && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1400);
    }
  }, [systems, isSolved, onSolve]);

  const handleSliderChange = (id: string, val: number) => {
    if (isSolved) return;
    setSystems(prev =>
      prev.map(s => {
        if (s.id === id) {
          const isStable = val >= s.minKw;
          return {
            ...s,
            allocatedKw: val,
            status: isStable ? 'stable' : 'critical',
          };
        }
        return s;
      })
    );
  };

  const handleReset = () => {
    soundFx.playClick();
    setSystems([
      { id: 'icu', name: 'Trauma ICU & Life Support', minKw: 35, allocatedKw: 20, status: 'critical' },
      { id: 'surgery', name: 'Emergency Surgical Suites', minKw: 30, allocatedKw: 15, status: 'critical' },
      { id: 'evac', name: 'High-Speed Evacuation Lifts', minKw: 15, allocatedKw: 10, status: 'critical' },
      { id: 'iso', name: 'Negative-Pressure Isolation Ward', minKw: 20, allocatedKw: 10, status: 'critical' },
    ]);
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 05 // APEX TRAUMA HOSPITAL</span>
            <h3 className="puzzle-title">Emergency Microgrid Energy Triage</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Allocate the hospital&rsquo;s 100 kW emergency backup microgrid across the four critical lifelines. Every system must satisfy its minimum life-safety threshold without tripping the master breaker.
        </p>

        {/* Status */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Total Microgrid Load</span>
            <span
              className={`puzzle-status-value ${
                isOverloaded ? 'color-critical' : totalAllocated === maxMicrogridCapacity ? 'color-good' : 'color-cyan'
              }`}
            >
              {totalAllocated} / {maxMicrogridCapacity} kW {isOverloaded ? '(BREAKER TRIPPED)' : ''}
            </span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Clinical Triage State</span>
            <span className={`puzzle-status-value ${isSolved ? 'color-good' : 'color-amber'}`}>
              {isSolved ? 'ALL LIFELINES SECURED' : 'UNSTABLE POWER MARGINS'}
            </span>
          </div>
        </div>

        {/* Systems Sliders */}
        <div className="hospital-systems-list">
          {systems.map(sys => {
            const meetsMin = sys.allocatedKw >= sys.minKw;
            return (
              <div key={sys.id} className={`hospital-sys-card ${meetsMin ? 'satisfied' : 'deficit'}`}>
                <div className="sys-header-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HeartPulse size={16} className={meetsMin ? 'color-good' : 'color-amber'} />
                    <span className="sys-name">{sys.name}</span>
                  </div>
                  <span className={`sys-kw-badge ${meetsMin ? 'color-good' : 'color-amber'}`}>
                    {sys.allocatedKw} kW (Min: {sys.minKw} kW)
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="50"
                  value={sys.allocatedKw}
                  onChange={e => handleSliderChange(sys.id, parseInt(e.target.value, 10))}
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
            <span>HOSPITAL MICROGRID RESTORED! Trauma ICU and surgical lifelines secured.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Power Channels
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
