import React, { useRef, useEffect, useState } from 'react';
import { Play, RotateCcw, X, ShieldAlert, Award, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, Droplets, Car } from 'lucide-react';

interface CityRescueGameProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyOptimizationToCity?: () => void;
}

interface Waypoint {
  id: number;
  name: string;
  desc: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  icon: string;
  completed: boolean;
}

export const CityRescueGame: React.FC<CityRescueGameProps> = ({
  isOpen,
  onClose,
  onApplyOptimizationToCity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentMission, setCurrentMission] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [score, setScore] = useState<number>(0);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>('Press Start to mobilize Emergency Response Unit.');

  // Game state stored in refs for smooth 60fps canvas loop
  const playerRef = useRef({
    x: 400,
    y: 250,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 4,
    size: 16,
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});

  const waypointsRef = useRef<Waypoint[]>([
    {
      id: 1,
      name: 'Grid Station Alpha',
      desc: 'BESS Battery Synchronization',
      x: 680,
      y: 120,
      radius: 36,
      color: '#f2a93b',
      icon: '⚡',
      completed: false,
    },
    {
      id: 2,
      name: 'Yamuna Aquifer Station',
      desc: 'Deep Storm Surge Pumps',
      x: 120,
      y: 380,
      radius: 36,
      color: '#28d9ec',
      icon: '🌊',
      completed: false,
    },
    {
      id: 3,
      name: 'Nexus Crossroads',
      desc: 'AI Green-Wave Signal Gateway',
      x: 400,
      y: 250,
      radius: 36,
      color: '#35d399',
      icon: '🚦',
      completed: false,
    },
  ]);

  // Key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const timerInterval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          setIsPlaying(false);
          setNotification('MISSION FAILED: Time expired before city infrastructure was stabilized.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const player = playerRef.current;
      const keys = keysRef.current;

      // Handle keyboard movement
      let dx = 0;
      let dy = 0;
      if (keys['arrowup'] || keys['w']) dy -= 1;
      if (keys['arrowdown'] || keys['s']) dy += 1;
      if (keys['arrowleft'] || keys['a']) dx -= 1;
      if (keys['arrowright'] || keys['d']) dx += 1;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      player.x = Math.max(player.size, Math.min(width - player.size, player.x + dx * player.speed));
      player.y = Math.max(player.size, Math.min(height - player.size, player.y + dy * player.speed));

      if (dx !== 0 || dy !== 0) {
        player.angle = Math.atan2(dy, dx);
      }

      // Check waypoint collision
      const currentTarget = waypointsRef.current.find(wp => wp.id === currentMission);
      if (currentTarget && !currentTarget.completed) {
        const dist = Math.hypot(player.x - currentTarget.x, player.y - currentTarget.y);
        if (dist < currentTarget.radius + player.size) {
          currentTarget.completed = true;
          setScore(s => s + 500);

          if (currentMission < 3) {
            const nextM = currentMission + 1;
            setCurrentMission(nextM);
            setNotification(`STABILIZED! Next: Move to ${waypointsRef.current[nextM - 1].name}`);
          } else {
            // Victory
            setGameWon(true);
            setIsPlaying(false);
            setNotification('VICTORY: All 3 Metropolitan Crisis Nodes successfully restored!');
          }
        }
      }

      // Clear Screen
      ctx.fillStyle = '#060b13';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid Roads
      ctx.fillStyle = '#101f33';
      // Vertical main roads
      ctx.fillRect(160, 0, 70, height);
      ctx.fillRect(365, 0, 70, height);
      ctx.fillRect(570, 0, 70, height);
      // Horizontal main roads
      ctx.fillRect(0, 115, width, 70);
      ctx.fillRect(0, 315, width, 70);

      // Road dashed lines
      ctx.strokeStyle = '#28d9ec33';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 12]);

      ctx.beginPath();
      ctx.moveTo(195, 0); ctx.lineTo(195, height);
      ctx.moveTo(400, 0); ctx.lineTo(400, height);
      ctx.moveTo(605, 0); ctx.lineTo(605, height);
      ctx.moveTo(0, 150); ctx.lineTo(width, 150);
      ctx.moveTo(0, 350); ctx.lineTo(width, 350);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Building Blocks
      ctx.fillStyle = '#0b1626';
      ctx.strokeStyle = '#87ceeb22';
      ctx.lineWidth = 1;

      const blocks = [
        [30, 25, 110, 70], [250, 25, 95, 70], [455, 25, 95, 70], [660, 25, 110, 70],
        [30, 205, 110, 90], [250, 205, 95, 90], [455, 205, 95, 90], [660, 205, 110, 90],
        [30, 405, 110, 70], [250, 405, 95, 70], [455, 405, 95, 70], [660, 405, 110, 70],
      ];

      blocks.forEach(([bx, by, bw, bh]) => {
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
      });

      // Draw Waypoints
      waypointsRef.current.forEach(wp => {
        ctx.save();
        ctx.translate(wp.x, wp.y);

        const isCurrent = wp.id === currentMission && !wp.completed;

        // Pulsing halo for active target
        if (isCurrent) {
          const pulse = Math.sin(Date.now() * 0.008) * 8;
          ctx.beginPath();
          ctx.arc(0, 0, wp.radius + pulse, 0, Math.PI * 2);
          ctx.fillStyle = wp.color + '33';
          ctx.fill();
          ctx.strokeStyle = wp.color;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Base circle
        ctx.beginPath();
        ctx.arc(0, 0, wp.radius, 0, Math.PI * 2);
        ctx.fillStyle = wp.completed ? '#35d39944' : wp.color + '22';
        ctx.fill();
        ctx.strokeStyle = wp.completed ? '#35d399' : wp.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Icon & text
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wp.completed ? '✓' : wp.icon, 0, -4);

        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillStyle = wp.completed ? '#35d399' : '#ffffff';
        ctx.fillText(wp.name.toUpperCase(), 0, wp.radius + 14);

        ctx.restore();
      });

      // Draw Rescue Unit (Player)
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Vehicle glow
      ctx.shadowColor = '#28d9ec';
      ctx.shadowBlur = 12;

      // Body
      ctx.fillStyle = '#28d9ec';
      ctx.fillRect(-player.size, -player.size / 2, player.size * 2, player.size);

      // Windshield
      ctx.fillStyle = '#03070d';
      ctx.fillRect(-player.size * 0.3, -player.size * 0.4, player.size * 0.8, player.size * 0.8);

      // Emergency Beacon light
      const beaconFlash = Math.floor(Date.now() / 150) % 2 === 0;
      ctx.fillStyle = beaconFlash ? '#ff5d5d' : '#28d9ec';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Headlights beam
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 200, 0.2)';
      ctx.beginPath();
      ctx.moveTo(player.size, -player.size * 0.4);
      ctx.lineTo(player.size + 40, -player.size * 1.5);
      ctx.lineTo(player.size + 40, player.size * 1.5);
      ctx.lineTo(player.size, player.size * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      clearInterval(timerInterval);
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, currentMission]);

  const startGame = () => {
    // Reset state
    playerRef.current = {
      x: 400,
      y: 250,
      vx: 0,
      vy: 0,
      angle: 0,
      speed: 4.5,
      size: 16,
    };
    waypointsRef.current.forEach(w => (w.completed = false));
    setCurrentMission(1);
    setTimeLeft(60);
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    setNotification('MISSION 1: Rush to Grid Station Alpha to synchronize BESS battery banks!');
    setIsPlaying(true);
  };

  const handleApplyToCity = () => {
    if (onApplyOptimizationToCity) {
      onApplyOptimizationToCity();
    }
    onClose();
  };

  // Virtual directional control helpers for touch/mobile
  const handleVirtualPress = (key: string, isDown: boolean) => {
    keysRef.current[key] = isDown;
  };

  return (
    <section id="rescue-section" className="page-section">
      <div className="container">
        <div className="section-eyebrow">INTERACTIVE PROMOTIONAL GAME</div>
        <h2 className="section-heading-lg">Step Into Command.</h2>
        <p className="section-subtext">
          Experience the decisions behind the data in <strong>NEXUS 2040: CITY RESCUE</strong>, a top-down emergency defense simulation built to demonstrate smart-city crisis management in under 5 minutes.
        </p>

        <div className="rescue-showcase-card">
          <div>
            <span
              className="hero-badge"
              style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'var(--red-dim)' }}
            >
              🚨 3 INFRASTRUCTURE EMERGENCIES · 1 RESCUE UNIT
            </span>
            <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 1rem', color: '#fff' }}>
              NEXUS 2040: CITY RESCUE
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              Take the wheel of an autonomous Emergency Response Unit. Drive through the city grid, locate highlighted infrastructure stations, and deploy smart-grid solutions to save 10 million citizens.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={startGame}
                className="btn btn-primary btn-lg"
                style={{ boxShadow: '0 0 20px rgba(40,217,236,0.4)' }}
                type="button"
              >
                <span>🚀</span> {isPlaying ? 'Restart Game' : 'Play Inside Page'}
              </button>
            </div>
          </div>

          <div className="rescue-preview-box">
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Mission Objectives:
            </h4>
            <div className="rescue-mission-row">
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <div>
                <strong>Mission 1: The Blackout</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Grid Station Alpha BESS synchronization.
                </div>
              </div>
            </div>
            <div className="rescue-mission-row">
              <span style={{ fontSize: '1.2rem' }}>🌊</span>
              <div>
                <strong>Mission 2: The Flood</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Sponge-city deep aquifer storm pumps.
                </div>
              </div>
            </div>
            <div className="rescue-mission-row">
              <span style={{ fontSize: '1.2rem' }}>🚦</span>
              <div>
                <strong>Mission 3: The Traffic Crisis</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Nexus Crossroads AI green-wave clearance.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Embedded Interactive Game Screen */}
        <div
          style={{
            marginTop: '2rem',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Top HUD */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1.5rem',
              background: 'rgba(7, 14, 24, 0.95)',
              borderBottom: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan)' }}>
                NEXUS-RESCUE // ERU-01
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                MISSION {currentMission} OF 3
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                TIME: <strong style={{ color: timeLeft < 15 ? 'var(--red)' : 'var(--green)' }}>{timeLeft}s</strong>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                SCORE: <strong style={{ color: 'var(--cyan)' }}>{score}</strong>
              </div>
              {!isPlaying && (
                <button onClick={startGame} className="btn btn-primary btn-sm" type="button">
                  <Play size={14} style={{ marginRight: '4px' }} /> Start Mission
                </button>
              )}
            </div>
          </div>

          {/* Canvas Viewport */}
          <div style={{ position: 'relative', width: '100%', height: '500px', background: '#060b13' }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />

            {/* In-Game Notification Banner */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(7, 14, 24, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: '0.4rem 1.2rem',
                borderRadius: '20px',
                border: '1px solid var(--border-glow)',
                color: '#fff',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
                pointerEvents: 'none',
                textAlign: 'center',
                maxWidth: '90%',
              }}
            >
              {notification}
            </div>

            {/* Victory Overlay */}
            {gameWon && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(3, 7, 13, 0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
                <h3 style={{ fontSize: '2rem', color: 'var(--green)', marginBottom: '0.5rem' }}>
                  Metropolitan Crisis Averted!
                </h3>
                <p style={{ maxWidth: '500px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Your Emergency Response Unit synchronized the battery storage, cleared the flood sluice gates, and reconfigured AI signal corridors. All 10 million citizens are safe!
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={startGame} className="btn btn-ghost btn-lg" type="button">
                    <RotateCcw size={16} style={{ marginRight: '6px' }} /> Play Again
                  </button>
                  {onApplyOptimizationToCity && (
                    <button onClick={handleApplyToCity} className="btn btn-primary btn-lg" type="button">
                      ⚡ Apply Fixes to Live City Simulation
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameOver && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(3, 7, 13, 0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚨</div>
                <h3 style={{ fontSize: '2rem', color: 'var(--red)', marginBottom: '0.5rem' }}>
                  Grid Resilience Breached
                </h3>
                <p style={{ maxWidth: '500px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Emergency response units were unable to reach critical infrastructure before municipal cascade failures occurred.
                </p>
                <button onClick={startGame} className="btn btn-primary btn-lg" type="button">
                  <RotateCcw size={16} style={{ marginRight: '6px' }} /> Retry Mission
                </button>
              </div>
            )}

            {/* Start Prompt Overlay if idle */}
            {!isPlaying && !gameWon && !gameOver && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(3, 7, 13, 0.75)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚨</div>
                <h3 style={{ fontSize: '1.6rem', color: '#fff', marginBottom: '0.5rem' }}>
                  Ready to Drive ERU-01?
                </h3>
                <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Use <strong>W, A, S, D</strong> or <strong>Arrow Keys</strong> to drive. Reach each glowing emergency station before time runs out.
                </p>
                <button onClick={startGame} className="btn btn-primary btn-lg" type="button">
                  <Play size={18} style={{ marginRight: '6px' }} /> Mobilize Unit Now
                </button>
              </div>
            )}

            {/* On-screen virtual directional pad for mobile or touch */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 40px)',
                gridTemplateRows: 'repeat(2, 40px)',
                gap: '4px',
                opacity: 0.7,
              }}
            >
              <div></div>
              <button
                className="btn btn-ghost"
                style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseDown={() => handleVirtualPress('arrowup', true)}
                onMouseUp={() => handleVirtualPress('arrowup', false)}
                onTouchStart={() => handleVirtualPress('arrowup', true)}
                onTouchEnd={() => handleVirtualPress('arrowup', false)}
                type="button"
              >
                <ArrowUp size={18} />
              </button>
              <div></div>
              <button
                className="btn btn-ghost"
                style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseDown={() => handleVirtualPress('arrowleft', true)}
                onMouseUp={() => handleVirtualPress('arrowleft', false)}
                onTouchStart={() => handleVirtualPress('arrowleft', true)}
                onTouchEnd={() => handleVirtualPress('arrowleft', false)}
                type="button"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseDown={() => handleVirtualPress('arrowdown', true)}
                onMouseUp={() => handleVirtualPress('arrowdown', false)}
                onTouchStart={() => handleVirtualPress('arrowdown', true)}
                onTouchEnd={() => handleVirtualPress('arrowdown', false)}
                type="button"
              >
                <ArrowDown size={18} />
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseDown={() => handleVirtualPress('arrowright', true)}
                onMouseUp={() => handleVirtualPress('arrowright', false)}
                onTouchStart={() => handleVirtualPress('arrowright', true)}
                onTouchEnd={() => handleVirtualPress('arrowright', false)}
                type="button"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
