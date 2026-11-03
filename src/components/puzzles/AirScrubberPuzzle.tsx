import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { Wind, CheckCircle, RotateCcw, X, Radio } from 'lucide-react';

interface AirScrubberPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

export const AirScrubberPuzzle: React.FC<AirScrubberPuzzleProps> = ({ onSolve, onClose }) => {
  // Target values
  const targetFreq = 42; // Hz
  const targetAmp = 75;  // dB

  const [frequency, setFrequency] = useState(20);
  const [amplitude, setAmplitude] = useState(35);
  const [aqi, setAqi] = useState(238);
  const [cancellation, setCancellation] = useState(30);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const fDiff = Math.abs(frequency - targetFreq);
    const aDiff = Math.abs(amplitude - targetAmp);

    // Score out of 100
    const fScore = Math.max(0, 1 - fDiff / 40);
    const aScore = Math.max(0, 1 - aDiff / 50);
    const score = Math.round(((fScore + aScore) / 2) * 100);

    setCancellation(score);
    setAqi(Math.max(38, Math.round(240 - (score / 100) * 195)));

    if (fDiff <= 3 && aDiff <= 4 && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1400);
    }
  }, [frequency, amplitude, isSolved, onSolve]);

  const handleReset = () => {
    soundFx.playClick();
    setFrequency(15);
    setAmplitude(25);
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 04 // BIO-RESONANCE AIR HUB</span>
            <h3 className="puzzle-title">Harmonic Smog Scrubber Calibration</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="puzzle-desc">
          Tune the acoustic harmonic bio-resonance frequency and ultrasonic emission amplitude to match the atmospheric smog plume&rsquo;s particulate resonance. Achieving destructive interference disintegrates PM2.5 particles on contact.
        </p>

        {/* Status */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Particulate Cancellation</span>
            <span className={`puzzle-status-value ${cancellation >= 90 ? 'color-good' : 'color-cyan'}`}>
              {cancellation}% {cancellation >= 90 ? '(Harmonic Lock)' : '(Scattering)'}
            </span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Corridor Air Quality</span>
            <span className={`puzzle-status-value ${aqi <= 60 ? 'color-good' : 'color-amber'}`}>
              {aqi} AQI {aqi <= 60 ? '(Pure Mountain Clean)' : '(Severe PM2.5 Haze)'}
            </span>
          </div>
        </div>

        {/* Oscilloscope Graphic */}
        <div className="oscilloscope-screen">
          <div className="oscilloscope-header">
            <Radio size={14} className="color-cyan" style={{ marginRight: '6px' }} />
            <span>BIO-RESONANCE OSCILLOSCOPE INTERFEROMETER</span>
          </div>
          <svg viewBox="0 0 400 120" width="100%" height="120" className="oscilloscope-svg">
            <defs>
              <pattern id="scope-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(40,217,236,0.12)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="400" height="120" fill="url(#scope-grid)" />

            {/* Target Smog Wave (Orange) */}
            <path
              d="M 0 60 Q 50 15, 100 60 T 200 60 T 300 60 T 400 60"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              opacity="0.8"
            />

            {/* Player's Anti-Wave (Cyan) */}
            <path
              d={`M 0 60 Q ${20 + frequency * 0.7} ${60 - amplitude * 0.55}, 100 60 T 200 60 T 300 60 T 400 60`}
              fill="none"
              stroke={cancellation >= 90 ? '#34d399' : '#28d9ec'}
              strokeWidth="3"
            />
          </svg>
          <div className="oscilloscope-legend">
            <span style={{ color: '#f59e0b' }}>-- Atmospheric Smog Waveform</span>
            <span style={{ color: cancellation >= 90 ? '#34d399' : '#28d9ec' }}>
              ━ Scrubber Harmonic Counter-Wave
            </span>
          </div>
        </div>

        {/* Sliders */}
        <div className="traffic-sliders-container">
          <div className="traffic-slider-group">
            <div className="slider-label-row">
              <span className="slider-title">Acoustic Resonance Frequency</span>
              <span className="slider-value color-cyan">{frequency} Hz</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              value={frequency}
              onChange={e => setFrequency(parseInt(e.target.value, 10))}
              className="traffic-range-input"
              disabled={isSolved}
            />
          </div>

          <div className="traffic-slider-group">
            <div className="slider-label-row">
              <span className="slider-title">Ultrasonic Pulse Amplitude</span>
              <span className="slider-value color-cyan">{amplitude} dB</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={amplitude}
              onChange={e => setAmplitude(parseInt(e.target.value, 10))}
              className="traffic-range-input"
              disabled={isSolved}
            />
          </div>
        </div>

        {/* Success Banner */}
        {isSolved && (
          <div className="puzzle-success-banner">
            <CheckCircle size={20} className="color-good" />
            <span>SMOG DISSIPATED! Bio-resonance scrubbers active. Clean air corridor established at 42 AQI.</span>
          </div>
        )}

        {/* Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Reset Frequencies
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
