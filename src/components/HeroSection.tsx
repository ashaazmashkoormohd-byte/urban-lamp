import React from 'react';
import { Play, Compass, ShieldAlert, Cpu } from 'lucide-react';
import { CityState } from '../types/city';
import { roundVal } from '../data/cityData';
import { soundFx } from '../utils/audio';

interface HeroSectionProps {
  state: CityState;
  onLaunchGame: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ state, onLaunchGame }) => {
  const handlePlayClick = () => {
    soundFx.playClick();
    onLaunchGame();
  };

  return (
    <section id="hero" className="cinematic-hero-section">
      <div className="hero-radial-glow"></div>
      <div className="hero-grid-lines"></div>

      <div className="container hero-container">
        {/* Apple-style eyebrow */}
        <div className="hero-eyebrow-capsule">
          <span className="he-flag">🇮🇳</span>
          <span className="he-text">INDIA&apos;S VISION 2040 // AUTONOMOUS METROPOLITAN INTELLIGENCE</span>
        </div>

        {/* The Exact Required Headline & Subheading */}
        <h1 className="hero-massive-headline">
          THE CITY IS YOURS TO SAVE.
        </h1>
        <p className="hero-cinematic-sub">
          Five AI protocols. One living city. Two minutes to change its future.
        </p>

        {/* Functional Hero Buttons */}
        <div className="hero-buttons-row">
          <button
            onClick={handlePlayClick}
            className="btn btn-primary btn-xl hero-btn-glow"
            type="button"
          >
            <Play size={20} style={{ marginRight: '8px' }} /> PLAY THE GAME
          </button>
          <a href="#city3d-section" className="btn btn-ghost btn-xl">
            <Compass size={20} style={{ marginRight: '8px' }} /> EXPLORE NEXUS
          </a>
        </div>

        {/* Live Metropolitan Health Stream Capsule */}
        <div className="hero-telemetry-bar">
          <div className="htb-item">
            <span className="htb-label">Managed Citizens</span>
            <span className="htb-val">10,000,000</span>
            <span className="htb-sub color-good">Protected Arcologies</span>
          </div>

          <div className="htb-item">
            <span className="htb-label">Clean Grid Share</span>
            <span className="htb-val">{roundVal(state.metrics.renewable)}%</span>
            <span className="htb-sub color-cyan">Solid-State BESS Active</span>
          </div>

          <div className="htb-item">
            <span className="htb-label">Sponge Reserves</span>
            <span className="htb-val">{roundVal(state.metrics.water)}%</span>
            <span className="htb-sub color-cyan">4.5M L / Storm Aquifer</span>
          </div>

          <div className="htb-item">
            <span className="htb-label">Traffic Congestion</span>
            <span className="htb-val">{roundVal(state.metrics.traffic)}%</span>
            <span className="htb-sub color-good">AI Wave Sequencing</span>
          </div>

          <div className="htb-item">
            <span className="htb-label">Air Purity Index</span>
            <span className="htb-val">{roundVal(state.metrics.aqi)} AQI</span>
            <span className="htb-sub color-good">Safe Respiratory Corridor</span>
          </div>
        </div>
      </div>
    </section>
  );
};
