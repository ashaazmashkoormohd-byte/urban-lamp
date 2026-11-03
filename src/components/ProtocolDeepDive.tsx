import React, { useState } from 'react';
import { ProtocolType } from '../types/game';
import { Zap, Droplets, Car, Wind, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface ProtocolInfo {
  id: ProtocolType;
  code: string;
  name: string;
  tagline: string;
  summary: string;
  architecture: string;
  metricImpact: string;
  spec: { label: string; value: string }[];
  color: string;
  icon: string;
}

const PROTOCOL_DETAILS: ProtocolInfo[] = [
  {
    id: 'energy',
    code: 'RULE-SOLAR-02 // BESS',
    name: 'Clean Grid & BESS Balancing',
    tagline: 'Synchronized Solid-State Energy Storage',
    summary:
      'Autonomous high-voltage DC distribution balancing utility-scale solar farms and wind turbines with 24/7 battery discharge, absorbing midday surges to satisfy peak evening cooling demands.',
    architecture:
      'When renewable share < 55% or grid headroom < 10%, autonomous switchgear decouples fossil thermal reserves and scales BESS inverter output in under 40 milliseconds.',
    metricImpact: '+28% Clean Grid Generation · -29.4 MW Peak Load Strains',
    spec: [
      { label: 'Storage Capacity', value: '120 MWh Solid-State' },
      { label: 'Switchgear Latency', value: '< 40 ms' },
      { label: 'Net-Zero Target', value: '80%+ 24/7 Baseline' },
    ],
    color: 'var(--cyan)',
    icon: '⚡',
  },
  {
    id: 'water',
    code: 'RULE-WATER-03 // HYDRO',
    name: 'Sponge Hydrology & Aquifers',
    tagline: 'Subterranean Monsoon Deluge Interception',
    summary:
      'Engineered closed-loop retention reservoirs and deep-aquifer recharge wells intercepting sudden cloudburst stormwater, preventing urban flooding while guaranteeing drinking reserves.',
    architecture:
      'Telemetric flood sluice sensors detect surface runoff volumes. Sluice gates open automatically within 120 seconds, routing 4.5 million litres per storm into subterranean sponge vaults.',
    metricImpact: '+36% Reserve Buffer Recovery · 100% Runoff Reclamation',
    spec: [
      { label: 'Harvest Volume', value: '4.5M Litres / Storm' },
      { label: 'Sluice Reaction', value: '< 120 Seconds' },
      { label: 'Aquifer Filtration', value: 'Multi-Stage Bio-Bed' },
    ],
    color: '#06b6d4',
    icon: '💧',
  },
  {
    id: 'traffic',
    code: 'RULE-TRAFFIC-01 // TRANSIT',
    name: 'Adaptive Wave Signal Control',
    tagline: 'Autonomous Fleet & Arterial Phasing',
    summary:
      'Continuous micro-sequencing of intersection traffic signals synchronized with autonomous EV bus corridors and elevated maglev transit to disperse bottlenecks before idling emissions accumulate.',
    architecture:
      'Activates dynamically when sector congestion exceeds 65%. Green-wave signals unlock arterial flow and dynamically reroute heavy logistics away from residential arcology sectors.',
    metricImpact: '-40% Peak Congestion Drop · +35 km/h Average Flow Gain',
    spec: [
      { label: 'Congestion Ceiling', value: '< 40% Target' },
      { label: 'Signal Cycle', value: 'Dynamic 6s Phasing' },
      { label: 'Transit Integration', value: 'Zero-Emission Metro' },
    ],
    color: 'var(--green)',
    icon: '🚦',
  },
  {
    id: 'environment',
    code: 'RULE-AQI-04 // CANOPY',
    name: 'Bio-Resonance Clean Air Corridors',
    tagline: 'Atmospheric Particulate Filtration',
    summary:
      'Perimeter green forest canopies paired with nano-mist drone scrubber towers dynamically neutralize hazardous PM2.5 particulates before they penetrate high-density pedestrian concourses.',
    architecture:
      'Monitors air quality indices across a 1,000-node sensor grid. If localized AQI exceeds 150, ultrasonic mist towers release electrostatic neutralizing vapor along windward corridors.',
    metricImpact: '-125 AQI Drop in Deluge Zones · Safe Respiratory Safe-Haven',
    spec: [
      { label: 'Target Purity', value: '< 100 AQI Citywide' },
      { label: 'Drone Scrubber Fleet', value: '180 Autonomous Units' },
      { label: 'Biosphere Canopies', value: '4.2 km² Native Forest' },
    ],
    color: '#10b981',
    icon: '🍃',
  },
  {
    id: 'emergency',
    code: 'RULE-HEAT-06 // TRIAGE',
    name: 'Multi-Hazard Emergency Response',
    tagline: 'Instantaneous Sector Surge Protection',
    summary:
      'Deterministic disaster mitigation coordinating mobile medical triage vans, reflective heat-shield cooling deployment, and priority microgrid feeds during severe climate anomalies.',
    architecture:
      'Triggers when ambient temperatures exceed 38°C or hospital bed occupancy surpasses 70%. Reroutes auxiliary backup power and provisions emergency triage pods within 3 minutes.',
    metricImpact: '+18% City Stability Boost · Zero Hospital Blackout Failures',
    spec: [
      { label: 'Emergency Budget', value: '100 Action Units' },
      { label: 'Deployment Window', value: '< 180 Seconds' },
      { label: 'Triage Surge Capacity', value: '+450 Acute Beds' },
    ],
    color: 'var(--red)',
    icon: '🛡️',
  },
];

interface ProtocolDeepDiveProps {
  onLaunchGameWithProtocol?: (protocol: ProtocolType) => void;
}

export const ProtocolDeepDive: React.FC<ProtocolDeepDiveProps> = ({ onLaunchGameWithProtocol }) => {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('energy');

  const activeProto = PROTOCOL_DETAILS.find(p => p.id === selectedProtocol)!;

  const handleSelect = (id: ProtocolType) => {
    soundFx.playClick();
    setSelectedProtocol(id);
  };

  return (
    <section id="protocols-section" className="page-section">
      <div className="container">
        <div className="section-eyebrow">THE AUTONOMOUS CORE</div>
        <h2 className="section-heading-lg">Five AI Protocols. Zero Hallucinations.</h2>
        <p className="section-subtext">
          NEXUS 2040 does not rely on opaque deep learning or black-box algorithms during cascading climate crises. Every decision is powered by deterministic, verifiable rules defined in public municipal code.
        </p>

        {/* Protocol Selector Tabs */}
        <div className="protocol-pills-row">
          {PROTOCOL_DETAILS.map(p => (
            <button
              key={p.id}
              className={`protocol-pill-tab ${selectedProtocol === p.id ? 'active' : ''}`}
              onClick={() => handleSelect(p.id)}
              type="button"
            >
              <span className="ppt-icon">{p.icon}</span>
              <span className="ppt-title">{p.name}</span>
            </button>
          ))}
        </div>

        {/* Product Showcase Card */}
        <div className="protocol-showcase-container">
          <div className="protocol-spec-column">
            <span className="proto-code-badge" style={{ color: activeProto.color, borderColor: activeProto.color }}>
              {activeProto.code}
            </span>
            <h3 className="proto-spec-title">{activeProto.name}</h3>
            <div className="proto-tagline">{activeProto.tagline}</div>
            <p className="proto-summary-text">{activeProto.summary}</p>

            <div className="proto-rule-box">
              <strong style={{ color: '#fff', fontSize: '0.82rem' }}>Deterministic Architecture:</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                {activeProto.architecture}
              </div>
            </div>

            <div className="proto-impact-banner">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Measured Environmental Impact
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: activeProto.color, marginTop: '2px' }}>
                {activeProto.metricImpact}
              </div>
            </div>
          </div>

          <div className="protocol-metrics-column">
            <div className="pm-header">
              <span>MUNICIPAL TECHNICAL SPECIFICATIONS</span>
            </div>

            <div className="pm-specs-grid">
              {activeProto.spec.map((s, idx) => (
                <div key={idx} className="pm-spec-item">
                  <span className="pm-spec-lbl">{s.label}</span>
                  <span className="pm-spec-val" style={{ color: activeProto.color }}>{s.value}</span>
                </div>
              ))}
            </div>

            <div className="pm-action-box">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Test this protocol live inside the crisis simulator to see its immediate 3D visual and algorithmic impact.
              </p>
              <a
                href="#game-section"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
              >
                <span>🚀</span> Deploy {activeProto.name} in Game
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
