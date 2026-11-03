import React from 'react';

export const VisionSection: React.FC = () => {
  return (
    <section id="vision" className="page-section">
      <div className="container">
        <div className="section-eyebrow">THE ARCHITECTURAL PARADIGM</div>
        <h2 className="section-heading-lg">Urban Civilisation, Re-Engineered.</h2>
        <p className="section-subtext">
          By 2040, India will house over 600 million urban citizens. Dense megacities cannot rely on human reaction latency or opaque &ldquo;black-box&rdquo; machine learning during cascading climate emergencies. NEXUS 2040 demonstrates an explainable, deterministic intelligence layer where every threshold is verifiable.
        </p>

        {/* Bento Grid: Four Core Pillars */}
        <div className="bento-grid">
          <div className="bento-card span-8">
            <div>
              <div className="bento-num">01 // DETERMINISTIC REASONING</div>
              <h3 className="bento-title">Transparent Logic. Zero Hallucinations.</h3>
              <p className="bento-text">
                Every recommendation and emergency response is governed by deterministic, human-auditable if/else thresholds defined directly in code. Every action is timestamped, justified, and measured in public logs for total municipal accountability.
              </p>
            </div>
            <div className="bento-stat-highlight">
              <span className="bento-big-num">100%</span>
              <span className="bento-big-label">Auditable Decision Traceability</span>
            </div>
          </div>

          <div className="bento-card span-4">
            <div>
              <div className="bento-num">02 // SPONGE HYDROLOGY</div>
              <h3 className="bento-title">Closed-Loop Aquifers</h3>
              <p className="bento-text">
                Monsoon cloudbursts are intercepted in real-time, diverting stormwater into subterranean sponge aquifers in under 120 seconds.
              </p>
            </div>
            <div className="bento-stat-highlight">
              <span className="bento-big-num">4.5M</span>
              <span className="bento-big-label">Litres Harvested Per Storm</span>
            </div>
          </div>

          <div className="bento-card span-4">
            <div>
              <div className="bento-num">03 // SOLID-STATE GRID</div>
              <h3 className="bento-title">24/7 BESS Balancing</h3>
              <p className="bento-text">
                Massive Battery Energy Storage Systems (BESS) absorb midday solar spikes, discharging seamlessly during evening cooling surges.
              </p>
            </div>
            <div className="bento-stat-highlight">
              <span className="bento-big-num">80%+</span>
              <span className="bento-big-label">Renewable Grid Target</span>
            </div>
          </div>

          <div className="bento-card span-8">
            <div>
              <div className="bento-num">04 // AUTONOMOUS GREEN CORRIDORS</div>
              <h3 className="bento-title">Adaptive Wave Signal Control</h3>
              <p className="bento-text">
                AI signal sequencing dynamically clears congestion bottlenecks before vehicular emissions can settle into dense residential arcologies, keeping PM2.5 within safe respiratory thresholds.
              </p>
            </div>
            <div className="bento-stat-highlight">
              <span className="bento-big-num">-40%</span>
              <span className="bento-big-label">Peak Congestion Drop</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
