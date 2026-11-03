import React from 'react';

interface EpilogueProps {
  onOpenGame: () => void;
}

export const Epilogue: React.FC<EpilogueProps> = ({ onOpenGame }) => {
  return (
    <section className="epilogue-section">
      <div className="container">
        <div className="epilogue-card">
          <div className="section-eyebrow" style={{ justifyContent: 'center' }}>
            VISION 2040 MANIFESTO
          </div>
          <div className="epilogue-quote">
            &ldquo;The future of India&apos;s cities will not be defined by concrete alone, but by the transparency of the intelligence that connects our citizens to their resources.&rdquo;
          </div>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '620px', margin: '0 auto 2.5rem' }}>
            Built for school exhibition showcase: Vision 2040 &mdash; Technology for a Sustainable India.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={onOpenGame}
              className="btn btn-primary btn-lg"
              type="button"
            >
              <span>🚨</span> Play Crisis Commander
            </button>
            <a href="#hero" className="btn btn-ghost btn-lg">
              <span>↑</span> Return to Top
            </a>
          </div>
        </div>

        <footer className="site-footer">
          <div>
            NEXUS 2040 // Educational Smart-City Concept Simulation · Zero External Dependencies · 100% Offline Compatible.
          </div>
          <div>
            Rewritten in React 19 &amp; Three.js. All metrics synthetic.
          </div>
        </footer>
      </div>
    </section>
  );
};
