import React, { useEffect, useState } from 'react';
import { formatClockTime } from '../utils/simulation';
import { soundFx } from '../utils/audio';
import { Play, Pause, RotateCcw, Volume2, VolumeX, ShieldAlert } from 'lucide-react';

interface NavigationProps {
  simRunning: boolean;
  onToggleSim: () => void;
  onReset: () => void;
  onLaunchGame: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  simRunning,
  onToggleSim,
  onReset,
  onLaunchGame,
}) => {
  const [clock, setClock] = useState(formatClockTime(new Date()));
  const [soundOn, setSoundOn] = useState<boolean>(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(formatClockTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundFx.setMuted(!next);
  };

  return (
    <header className="nexus-nav">
      <div className="nav-container">
        <a href="#hero" className="brand-group">
          <span className="brand-mark">NEXUS</span>
          <span className="brand-year">2040</span>
          <span className="sim-live-badge">
            <span className={`live-dot ${!simRunning ? 'paused' : ''}`}></span>
            <span>AUTONOMOUS · LIVE</span>
          </span>
        </a>

        {/* Smooth Navigation Jump Links */}
        <nav className="nav-links" aria-label="Experience Sections">
          <a href="#game-section" className="nav-link special-link">
            🎮 Crisis Commander
          </a>
          <a href="#city3d-section" className="nav-link">3D Twin</a>
          <a href="#protocols-section" className="nav-link">5 Protocols</a>
          <a href="#systems-showcase" className="nav-link">Architecture</a>
          <a href="#future-section" className="nav-link">Future 2040</a>
          <a href="#operations-suite" className="nav-link">Operations</a>
        </nav>

        {/* Right Actions & Clock */}
        <div className="nav-actions">
          <button
            onClick={handleToggleSound}
            className="btn btn-ghost btn-icon-only"
            type="button"
            title={soundOn ? 'Mute Sounds' : 'Enable Sounds'}
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <span className="clock-display" id="clock">{clock}</span>

          <button
            onClick={onReset}
            className="btn btn-danger btn-sm"
            type="button"
            title="Reset City to Crisis Baseline"
          >
            <RotateCcw size={13} style={{ marginRight: '4px' }} />
            Reset
          </button>

          <button
            onClick={onLaunchGame}
            className="btn btn-primary btn-sm nav-cta-btn"
            type="button"
          >
            <span>🚨</span> Play Game
          </button>
        </div>
      </div>
    </header>
  );
};
