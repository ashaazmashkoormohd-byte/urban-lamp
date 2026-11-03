import React, { useState, useEffect } from 'react';
import { soundFx } from '../../utils/audio';
import { Zap, RotateCw, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface PowerGridPuzzleProps {
  onSolve: () => void;
  onClose: () => void;
}

type PipeType = 'I' | 'L' | 'T' | '+';

interface Tile {
  id: number;
  r: number;
  c: number;
  type: PipeType;
  rotation: number; // 0, 90, 180, 270
  isPowered: boolean;
}

// Direction offsets: 0: Up, 1: Right, 2: Down, 3: Left
const DIR_OFFSETS: [number, number][] = [
  [-1, 0], // Up
  [0, 1],  // Right
  [1, 0],  // Down
  [0, -1], // Left
];

// Openings for each tile type at rotation = 0
const BASE_OPENINGS: Record<PipeType, number[]> = {
  'I': [0, 2],       // Up & Down
  'L': [0, 1],       // Up & Right
  'T': [0, 1, 3],    // Up, Right, Left
  '+': [0, 1, 2, 3], // All 4 directions
};

export const PowerGridPuzzle: React.FC<PowerGridPuzzleProps> = ({ onSolve, onClose }) => {
  const rows = 3;
  const cols = 4;

  // Initialize a puzzle layout with a guaranteed solvable circuit
  const [tiles, setTiles] = useState<Tile[]>(() => {
    const initialTypes: PipeType[][] = [
      ['L', 'T', 'L', 'I'],
      ['I', 'L', '+', 'L'],
      ['L', 'I', 'T', 'L'],
    ];

    // Scrambled initial rotations
    const initialRotations: number[][] = [
      [90, 180, 0, 90],
      [0, 270, 90, 180],
      [180, 0, 270, 0],
    ];

    const result: Tile[] = [];
    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          id: id++,
          r,
          c,
          type: initialTypes[r][c],
          rotation: initialRotations[r][c],
          isPowered: false,
        });
      }
    }
    return result;
  });

  const [isSolved, setIsSolved] = useState(false);
  const [loadPercentage, setLoadPercentage] = useState(42);

  const getTileOpenings = (tile: Tile): number[] => {
    const base = BASE_OPENINGS[tile.type];
    const steps = (tile.rotation / 90) % 4;
    return base.map(dir => (dir + steps) % 4);
  };

  // Run Breadth-First-Search from Power Inlet at (1, 0) - middle left
  useEffect(() => {
    const grid: (Tile | undefined)[][] = Array.from({ length: rows }, () => Array(cols).fill(undefined));
    tiles.forEach(t => {
      grid[t.r][t.c] = t;
    });

    const poweredSet = new Set<number>();
    const queue: [number, number][] = [];

    // Power Source enters at (1, 0) from the Left (direction 3)
    const startTile = grid[1][0];
    if (startTile) {
      const openings = getTileOpenings(startTile);
      // If startTile opens to Left (3), power enters
      if (openings.includes(3)) {
        poweredSet.add(startTile.id);
        queue.push([1, 0]);
      }
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      const current = grid[r][c]!;
      const currentOpenings = getTileOpenings(current);

      currentOpenings.forEach(dir => {
        const [dr, dc] = DIR_OFFSETS[dir];
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = grid[nr][nc];
          if (neighbor && !poweredSet.has(neighbor.id)) {
            const neighborOpenings = getTileOpenings(neighbor);
            const oppositeDir = (dir + 2) % 4;
            if (neighborOpenings.includes(oppositeDir)) {
              poweredSet.add(neighbor.id);
              queue.push([nr, nc]);
            }
          }
        }
      });
    }

    // Check if Exit at (1, cols - 1) is powered and connects to the Right (direction 1)
    const exitTile = grid[1][cols - 1];
    const exitConnected = exitTile && poweredSet.has(exitTile.id) && getTileOpenings(exitTile).includes(1);

    // Update powered states on tiles
    setTiles(prev =>
      prev.map(t => ({
        ...t,
        isPowered: poweredSet.has(t.id),
      }))
    );

    const activeCount = poweredSet.size;
    setLoadPercentage(Math.min(100, Math.round((activeCount / (rows * cols)) * 100)));

    if (exitConnected && !isSolved) {
      setIsSolved(true);
      soundFx.playPuzzleSuccess();
      setTimeout(() => {
        onSolve();
      }, 1400);
    }
  }, [tiles, isSolved, onSolve]);

  const handleTileClick = (tileId: number) => {
    if (isSolved) return;
    soundFx.playPuzzleRotate();
    setTiles(prev =>
      prev.map(t => {
        if (t.id === tileId) {
          return {
            ...t,
            rotation: (t.rotation + 90) % 360,
          };
        }
        return t;
      })
    );
  };

  const handleReset = () => {
    soundFx.playClick();
    setTiles(prev =>
      prev.map(t => ({
        ...t,
        rotation: (t.id * 90 + 90) % 360,
      }))
    );
  };

  return (
    <div className="puzzle-modal-backdrop" onClick={onClose}>
      <div className="puzzle-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="puzzle-header">
          <div className="puzzle-title-group">
            <span className="puzzle-eyebrow">SECTOR 01 // CLEAN GRID SUBSTATION</span>
            <h3 className="puzzle-title">High-Voltage Circuit Conduit Alignment</h3>
          </div>
          <button className="puzzle-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Objective Briefing */}
        <p className="puzzle-desc">
          Click circuit conduit segments to rotate them 90°. Establish a continuous high-voltage line from the Solar Farm &amp; BESS generation feed on the left to the Metropolitan Transformer bus on the right.
        </p>

        {/* Status Indicators */}
        <div className="puzzle-status-bar">
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Grid Load Capacity</span>
            <span className="puzzle-status-value color-cyan">{loadPercentage}% Synchronized</span>
          </div>
          <div className="puzzle-status-item">
            <span className="puzzle-status-label">Transformer Bus</span>
            <span className={`puzzle-status-value ${isSolved ? 'color-good' : 'color-amber'}`}>
              {isSolved ? 'ONLINE (120 MWh Active)' : 'ISOLATED (Brownout)'}
            </span>
          </div>
        </div>

        {/* Interactive Circuit Grid */}
        <div className="circuit-grid-wrapper">
          {/* Power In Indicator */}
          <div className="grid-port-label port-left">
            <Zap size={18} className="color-cyan" />
            <span>SOLAR BESS IN</span>
          </div>

          <div
            className="circuit-board"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: '8px',
            }}
          >
            {tiles.map(tile => (
              <button
                key={tile.id}
                type="button"
                className={`circuit-tile ${tile.isPowered ? 'powered' : ''}`}
                onClick={() => handleTileClick(tile.id)}
                title={`Rotate Node (${tile.r}, ${tile.c})`}
              >
                <div
                  className="tile-wire-graphic"
                  style={{
                    transform: `rotate(${tile.rotation}deg)`,
                    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <CircuitGraphic type={tile.type} isPowered={tile.isPowered} />
                </div>
              </button>
            ))}
          </div>

          {/* Power Out Indicator */}
          <div className={`grid-port-label port-right ${isSolved ? 'connected' : ''}`}>
            <span>SUBSTATION BUS</span>
            <Zap size={18} className={isSolved ? 'color-good' : 'color-muted'} />
          </div>
        </div>

        {/* Victory Notification Banner */}
        {isSolved && (
          <div className="puzzle-success-banner">
            <CheckCircle size={20} className="color-good" />
            <span>SUBSTATION RESTORED! Solid-state transformers synchronized across the metropolitan grid.</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="puzzle-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleReset} type="button">
            <RotateCw size={14} style={{ marginRight: '6px' }} />
            Scramble Circuits
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Exit Terminal
          </button>
        </div>
      </div>
    </div>
  );
};

// SVG Renderer for Circuit Node Geometry
const CircuitGraphic: React.FC<{ type: PipeType; isPowered: boolean }> = ({ type, isPowered }) => {
  const color = isPowered ? '#38bdf8' : '#475569';
  const glow = isPowered ? 'drop-shadow(0 0 6px #38bdf8)' : 'none';

  return (
    <svg viewBox="0 0 60 60" width="100%" height="100%" style={{ filter: glow }}>
      {/* Node Center Junction */}
      <circle cx="30" cy="30" r="6" fill={color} />

      {/* Up Line */}
      {(type === 'I' || type === 'L' || type === 'T' || type === '+') && (
        <rect x="27" y="0" width="6" height="30" fill={color} rx="3" />
      )}

      {/* Right Line */}
      {(type === 'L' || type === 'T' || type === '+') && (
        <rect x="30" y="27" width="30" height="6" fill={color} rx="3" />
      )}

      {/* Down Line */}
      {(type === 'I' || type === '+') && (
        <rect x="27" y="30" width="6" height="30" fill={color} rx="3" />
      )}

      {/* Left Line */}
      {(type === 'T' || type === '+') && (
        <rect x="0" y="27" width="30" height="6" fill={color} rx="3" />
      )}
    </svg>
  );
};
