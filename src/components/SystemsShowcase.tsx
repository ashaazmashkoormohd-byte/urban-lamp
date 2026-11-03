import React, { useState } from 'react';

interface SystemsShowcaseProps {
  onSelectOpsTab: (tabKey: string) => void;
}

export const SystemsShowcase: React.FC<SystemsShowcaseProps> = ({ onSelectOpsTab }) => {
  const [activeTab, setActiveTab] = useState<'energy' | 'water' | 'transit' | 'air' | 'emergency' | 'economy'>('energy');

  const handleJumpToOps = (tabKey: string) => {
    onSelectOpsTab(tabKey);
    const el = document.getElementById('operations-suite');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="systems-showcase" className="page-section">
      <div className="container">
        <div className="section-eyebrow">INTELLIGENCE SUBSYSTEMS</div>
        <h2 className="section-heading-lg">Six Pillars of Urban Resilience.</h2>
        <p className="section-subtext">
          Explore how NEXUS 2040 balances municipal services across competing environmental pressures in real time.
        </p>

        {/* Segmented Tab Navigation */}
        <div className="system-tabs-nav">
          <button
            className={`system-tab-btn ${activeTab === 'energy' ? 'active' : ''}`}
            onClick={() => setActiveTab('energy')}
            type="button"
          >
            ⚡ Clean Energy &amp; Grid
          </button>
          <button
            className={`system-tab-btn ${activeTab === 'water' ? 'active' : ''}`}
            onClick={() => setActiveTab('water')}
            type="button"
          >
            💧 Sponge Water Hydrology
          </button>
          <button
            className={`system-tab-btn ${activeTab === 'transit' ? 'active' : ''}`}
            onClick={() => setActiveTab('transit')}
            type="button"
          >
            🚦 Autonomous Mobility
          </button>
          <button
            className={`system-tab-btn ${activeTab === 'air' ? 'active' : ''}`}
            onClick={() => setActiveTab('air')}
            type="button"
          >
            🍃 Clean Air Corridors
          </button>
          <button
            className={`system-tab-btn ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
            type="button"
          >
            🛡️ Crisis Response
          </button>
          <button
            className={`system-tab-btn ${activeTab === 'economy' ? 'active' : ''}`}
            onClick={() => setActiveTab('economy')}
            type="button"
          >
            💰 100-Unit Economy
          </button>
        </div>

        {/* Panel 1: Energy */}
        {activeTab === 'energy' && (
          <div className="system-panel active">
            <div className="system-details-card">
              <h3>⚡ Clean Energy &amp; Smart Grid</h3>
              <p>
                Pairing utility-scale solar photovoltaic farms with wind turbines and solid-state Battery Energy Storage Systems (BESS) to supply clean power across diurnal variations.
              </p>
              <div className="system-stats-cluster">
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Renewable Target</span>
                  <span className="sys-stat-val" style={{ color: 'var(--green)' }}>80%</span>
                </div>
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Grid Stability Margin</span>
                  <span className="sys-stat-val" style={{ color: 'var(--cyan)' }}>+15% MW</span>
                </div>
              </div>
              <div className="rule-highlight-box">
                <strong>Governing Rule: RULE-SOLAR-02 &amp; RULE-GRID-05</strong><br/>
                When renewable share &lt; 55% or supply-demand margin &lt; 10%, battery banks discharge and solar farm output scales up automatically.
              </div>
            </div>
            <div className="bento-card" style={{ padding: '2rem' }}>
              <h4>Live Substation Telemetry</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                The grid automatically mitigates overloads and thermal stresses before transformers can trip.
              </p>
              <button
                onClick={() => handleJumpToOps('metrics')}
                className="btn btn-primary"
                type="button"
              >
                Open Grid Dashboard ↗
              </button>
            </div>
          </div>
        )}

        {/* Panel 2: Water */}
        {activeTab === 'water' && (
          <div className="system-panel active">
            <div className="system-details-card">
              <h3>💧 Sponge Water Hydrology &amp; Recycling</h3>
              <p>
                Citywide permeable pavements, retention canals, and rainwater harvesting networks feed the Yamuna Eco-Reservoir and recharge deep aquifers.
              </p>
              <div className="system-stats-cluster">
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Safe Reserve Buffer</span>
                  <span className="sys-stat-val" style={{ color: 'var(--cyan)' }}>&gt; 55%</span>
                </div>
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Flood Sluice Time</span>
                  <span className="sys-stat-val" style={{ color: 'var(--green)' }}>&lt; 120s</span>
                </div>
              </div>
              <div className="rule-highlight-box">
                <strong>Governing Rule: RULE-WATER-03</strong><br/>
                Triggers when water reserves drop below 40%. Recycled greywater lines and telemetry-controlled rainwater harvesting restore safe margins.
              </div>
            </div>
            <div className="bento-card" style={{ padding: '2rem' }}>
              <h4>Reservoir Monitoring</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Monitors storage capacity, contamination markers, and automated sluice gate positioning.
              </p>
              <button
                onClick={() => handleJumpToOps('metrics')}
                className="btn btn-primary"
                type="button"
              >
                Open Water Dashboard ↗
              </button>
            </div>
          </div>
        )}

        {/* Panel 3: Transit */}
        {activeTab === 'transit' && (
          <div className="system-panel active">
            <div className="system-details-card">
              <h3>🚦 Autonomous Mobility &amp; Metro</h3>
              <p>
                Adaptive signal control coordinates with the elevated metro viaduct and autonomous EV fleets to prevent intersection gridlocks.
              </p>
              <div className="system-stats-cluster">
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Congestion Cap</span>
                  <span className="sys-stat-val" style={{ color: 'var(--amber)' }}>&lt; 65%</span>
                </div>
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Average Speed Gain</span>
                  <span className="sys-stat-val" style={{ color: 'var(--green)' }}>+35 km/h</span>
                </div>
              </div>
              <div className="rule-highlight-box">
                <strong>Governing Rule: RULE-TRAFFIC-01</strong><br/>
                Triggers when congestion exceeds 65%. Activates adaptive green-wave signal phases to disperse bottlenecks and reduce vehicle idling.
              </div>
            </div>
            <div className="bento-card" style={{ padding: '2rem' }}>
              <h4>Transit Operations</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Connects residential sectors to commercial CBD hubs via zero-emission autonomous transit corridors.
              </p>
              <button
                onClick={() => handleJumpToOps('metrics')}
                className="btn btn-primary"
                type="button"
              >
                Open Transit Dashboard ↗
              </button>
            </div>
          </div>
        )}

        {/* Panel 4: Air Quality */}
        {activeTab === 'air' && (
          <div className="system-panel active">
            <div className="system-details-card">
              <h3>🍃 Clean Air Corridors &amp; PM2.5 Scrubbers</h3>
              <p>
                Urban green canopies, reflective pavement, and nano-scrubber drone towers continuously filter particulates across dense high-rise clusters.
              </p>
              <div className="system-stats-cluster">
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Target Air Quality</span>
                  <span className="sys-stat-val" style={{ color: 'var(--green)' }}>&lt; 100 AQI</span>
                </div>
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Scrubber Response</span>
                  <span className="sys-stat-val" style={{ color: 'var(--cyan)' }}>Automated</span>
                </div>
              </div>
              <div className="rule-highlight-box">
                <strong>Governing Rule: RULE-AQI-04</strong><br/>
                Triggers when AQI exceeds 150. Restricts high-emission perimeter logistics and activates misting scrubber towers in high-density zones.
              </div>
            </div>
            <div className="bento-card" style={{ padding: '2rem' }}>
              <h4>Environmental Sensors</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Real-time monitoring of particulate matter, ambient temperature, and urban heat island mitigation.
              </p>
              <button
                onClick={() => handleJumpToOps('metrics')}
                className="btn btn-primary"
                type="button"
              >
                Open Air Quality Dashboard ↗
              </button>
            </div>
          </div>
        )}

        {/* Panel 5: Emergency */}
        {activeTab === 'emergency' && (
          <div className="system-panel active">
            <div className="system-details-card">
              <h3>🛡️ Multi-Hazard Emergency Response</h3>
              <p>
                Pre-programmed crisis response protocols for Heatwaves, Monsoonal Deluges, Traffic Gridlocks, and Grid Shortages.
              </p>
              <div className="system-stats-cluster">
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Response Budget</span>
                  <span className="sys-stat-val" style={{ color: 'var(--cyan)' }}>100 Units</span>
                </div>
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Hospital Surge</span>
                  <span className="sys-stat-val" style={{ color: 'var(--green)' }}>Protected</span>
                </div>
              </div>
              <div className="rule-highlight-box">
                <strong>Governing Rule: RULE-HEAT-06 &amp; RULE-HEALTH-07</strong><br/>
                Deploys mobile triage units, reflective cooling infrastructure, and automated patient rerouting when hospital load exceeds 70%.
              </div>
            </div>
            <div className="bento-card" style={{ padding: '2rem' }}>
              <h4>Emergency Sandbox</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Simulate and resolve major urban crises with the click of a button in the operations suite.
              </p>
              <button
                onClick={() => handleJumpToOps('emergencies')}
                className="btn btn-primary"
                type="button"
              >
                Open Emergency Suite ↗
              </button>
            </div>
          </div>
        )}

        {/* Panel 6: Economy */}
        {activeTab === 'economy' && (
          <div className="system-panel active">
            <div className="system-details-card">
              <h3>💰 100-Unit Infrastructure Economy</h3>
              <p>
                Unlike fantasy dashboards, NEXUS 2040 does not assume infinite resources. Every action costs a real, finite budget (80 of 100 units covers all rules).
              </p>
              <div className="system-stats-cluster">
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Total Cycle Cost</span>
                  <span className="sys-stat-val" style={{ color: 'var(--cyan)' }}>80 / 100</span>
                </div>
                <div className="sys-stat-box">
                  <span className="sys-stat-label">Fiscal Rule</span>
                  <span className="sys-stat-val" style={{ color: 'var(--green)' }}>Zero Deficit</span>
                </div>
              </div>
              <div className="rule-highlight-box">
                <strong>Fiscal Integrity Principle:</strong><br/>
                If the budget cannot fully cover an intervention, the engine scales effect proportionally and logs a partial application. It never overspends.
              </div>
            </div>
            <div className="bento-card" style={{ padding: '2rem' }}>
              <h4>Budget Optimization</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Test citywide optimization under strict budgetary constraints.
              </p>
              <button
                onClick={() => handleJumpToOps('optimize')}
                className="btn btn-primary"
                type="button"
              >
                Run City Optimization ↗
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
