import React, { useEffect, useState } from 'react';
import { formatClockTime } from '../utils/simulation';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface NavigationProps {
  simRunning: boolean;
  onToggleSim: () => void;
  onReset: () => void;
  onOpenGame?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  simRunning,
  onToggleSim,
  onReset,
}) => {
  const [clock, setClock] = useState(formatClockTime(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatClockTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="nexus-nav">
      <div className="nav-container">
        <a href="#hero" className="brand-group">
          <span className="brand-mark">NEXUS</span>
          <span className="brand-year">2040</span>
          <span className="sim-live-badge">
            <span className={`live-dot ${!simRunning ? 'paused' : ''}`} id="liveDot"></span>
            <span>{simRunning ? 'SIMULATED · LIVE' : 'SIMULATION · PAUSED'}</span>
          </span>
        </a>

        {/* Smooth Navigation Jump Links */}
        <nav className="nav-links" aria-label="Experience Sections">
          <a href="#vision" className="nav-link">Vision</a>
          <a href="#city3d-section" className="nav-link">3D City</a>
          <a href="#systems-showcase" className="nav-link">Systems</a>
          <a href="#future-section" className="nav-link">Future 2040</a>
          <a href="#rescue-section" className="nav-link">City Rescue</a>
          <a href="#operations-suite" className="nav-link">Command Suite</a>
        </nav>

        {/* Right Actions & Clock */}
        <div className="nav-actions">
          <span className="clock-display" id="clock">{clock}</span>
          <button
            id="simToggleBtn"
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={onToggleSim}
            title={simRunning ? 'Pause Live Simulation' : 'Resume Live Simulation'}
          >
            {simRunning ? (
              <>
                <Pause size={14} style={{ marginRight: '4px' }} />
                Pause
              </>
            ) : (
              <>
                <Play size={14} style={{ marginRight: '4px' }} />
                Resume
              </>
            )}
          </button>
          <button
            id="resetBtn"
            className="btn btn-danger btn-sm"
            type="button"
            onClick={onReset}
            title="Reset City to Default Crisis Baseline"
          >
            <RotateCcw size={14} style={{ marginRight: '4px' }} />
            Reset
          </button>
        </div>
      </div>
    </header>
  );
};
