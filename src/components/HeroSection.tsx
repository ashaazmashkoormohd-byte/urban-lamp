import React from 'react';
import { CityState } from '../types/city';
import { roundVal, trafficStatus, renewableStatus, waterStatus, aqiStatus, marginStatus } from '../data/cityData';

interface HeroSectionProps {
  state: CityState;
  onOpenGame: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ state, onOpenGame }) => {
  const m = state.metrics;
  const tStatus = trafficStatus(m.traffic);
  const rStatus = renewableStatus(m.renewable);
  const wStatus = waterStatus(m.water);
  const aStatus = aqiStatus(m.aqi);
  const margin = m.supply - m.demand;
  const mStatus = marginStatus(m.supply, m.demand);

  const getStatusText = (status: 'good' | 'moderate' | 'critical', type: string) => {
    switch (type) {
      case 'traffic':
        return status === 'good' ? 'Optimal Flow' : status === 'moderate' ? 'Moderate Congestion' : 'Severe Gridlock';
      case 'renewable':
        return status === 'good' ? 'Solar/BESS Active' : status === 'moderate' ? 'Hybrid Mix' : 'Fossil Strain';
      case 'water':
        return status === 'good' ? 'Sponge Aquifer Full' : status === 'moderate' ? 'Buffering Reserves' : 'Critical Deficit';
      case 'aqi':
        return status === 'good' ? 'Clean Air Corridor' : status === 'moderate' ? 'Moderate Particulates' : 'Toxic Smog Surge';
      case 'margin':
        return status === 'good' ? 'Supply Margin Safe' : status === 'moderate' ? 'Tight Capacity' : 'Deficit Risk';
      default:
        return '';
    }
  };

  const getStatusClass = (status: 'good' | 'moderate' | 'critical') => {
    return status === 'good' ? 'color-good' : status === 'moderate' ? 'color-moderate' : 'color-critical';
  };

  return (
    <section id="hero" className="hero-section">
      <div className="hero-glow-back"></div>
      <div className="hero-content">
        <div className="hero-badge">
          <span>🇮🇳</span> INDIA'S VISION 2040 // AUTONOMOUS METROPOLITAN INTELLIGENCE
        </div>
        <h1 className="hero-title">The City That Thinks.</h1>
        <p className="hero-sub">
          A transparent, deterministic rule-based intelligence layer managing 10 million citizens, net-zero renewable energy, and instantaneous climate resilience.
        </p>

        <div className="hero-cta-group">
          <a href="#city3d-section" className="btn btn-primary btn-lg">
            <span>🏙️</span> Explore 3D City ↓
          </a>
          <button
            onClick={onOpenGame}
            className="btn btn-ghost btn-lg"
            style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
            type="button"
          >
            <span>🚨</span> Play City Rescue
          </button>
          <a href="#operations-suite" className="btn btn-ghost btn-lg">
            <span>⚡</span> Operations Suite
          </a>
        </div>

        {/* Live Drifting Telemetry Capsule */}
        <div className="hero-telemetry-capsule">
          <div className="ht-item">
            <span className="ht-label">Traffic Congestion</span>
            <span className="ht-val">{roundVal(m.traffic)}%</span>
            <span className={`ht-status ${getStatusClass(tStatus)}`}>
              {getStatusText(tStatus, 'traffic')}
            </span>
          </div>

          <div className="ht-item">
            <span className="ht-label">Clean Grid Share</span>
            <span className="ht-val">{roundVal(m.renewable)}%</span>
            <span className={`ht-status ${getStatusClass(rStatus)}`}>
              {getStatusText(rStatus, 'renewable')}
            </span>
          </div>

          <div className="ht-item">
            <span className="ht-label">Water Reserves</span>
            <span className="ht-val">{roundVal(m.water)}%</span>
            <span className={`ht-status ${getStatusClass(wStatus)}`}>
              {getStatusText(wStatus, 'water')}
            </span>
          </div>

          <div className="ht-item">
            <span className="ht-label">Air Quality Index</span>
            <span className="ht-val">{roundVal(m.aqi)} AQI</span>
            <span className={`ht-status ${getStatusClass(aStatus)}`}>
              {getStatusText(aStatus, 'aqi')}
            </span>
          </div>

          <div className="ht-item">
            <span className="ht-label">Grid Headroom</span>
            <span className="ht-val">{margin >= 0 ? `+${roundVal(margin)}%` : `${roundVal(margin)}%`}</span>
            <span className={`ht-status ${getStatusClass(mStatus)}`}>
              {getStatusText(mStatus, 'margin')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
