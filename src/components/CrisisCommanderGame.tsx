import React, { useRef, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import * as THREE from 'three';
import { GameMode, GameMetrics, ProtocolType, GameStats, PlayerControls, PlayerState } from '../types/game';
import { buildProceduralCity, City3DScene, SectorStation } from '../utils/cityBuilder3D';
import { createCharacterController, CharacterControllerInstance } from '../utils/characterController';
import { createThirdPersonCamera, ThirdPersonCameraInstance } from '../utils/thirdPersonCamera';
import { soundFx } from '../utils/audio';

// Puzzle Components
import { PowerGridPuzzle } from './puzzles/PowerGridPuzzle';
import { WaterNetworkPuzzle } from './puzzles/WaterNetworkPuzzle';
import { TrafficPuzzle } from './puzzles/TrafficPuzzle';
import { AirScrubberPuzzle } from './puzzles/AirScrubberPuzzle';
import { HospitalMicrogridPuzzle } from './puzzles/HospitalMicrogridPuzzle';

import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Zap,
  Droplets,
  Car,
  Wind,
  LifeBuoy,
  Award,
  CheckCircle2,
  Info,
  X,
  Compass,
  Crosshair,
  Lock,
} from 'lucide-react';

interface CrisisCommanderGameProps {
  onExploreCity?: () => void;
  isEmbedded?: boolean;
}

export const CrisisCommanderGame: React.FC<CrisisCommanderGameProps> = ({
  onExploreCity,
  isEmbedded = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const city3dRef = useRef<City3DScene | null>(null);
  const characterRef = useRef<CharacterControllerInstance | null>(null);
  const cameraControllerRef = useRef<ThirdPersonCameraInstance | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Game Lifecycle State
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [invertY, setInvertY] = useState<boolean>(false);
  const [invertX, setInvertX] = useState<boolean>(false);
  const [mouseSensitivity, setMouseSensitivity] = useState<number>(1.0);

  // Active Puzzle Modal
  const [activePuzzle, setActivePuzzle] = useState<string | null>(null);

  // Player State for HUD
  const [playerHudState, setPlayerHudState] = useState<PlayerState>({
    x: 0,
    y: 0,
    z: 14,
    yaw: 0,
    isGrounded: true,
    isSprinting: false,
    isMoving: false,
    actionState: 'idle',
  });

  // Camera Yaw for Compass
  const [cameraHeading, setCameraHeading] = useState<number>(0);

  // Sector Objectives
  const [sectorObjectives, setSectorObjectives] = useState<Record<string, boolean>>({
    substation: false,
    reservoir: false,
    traffic: false,
    environment: false,
    emergency: false,
  });

  // Nearby Station Prompt
  const [nearbyStation, setNearbyStation] = useState<SectorStation | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<GameMetrics>({
    stability: 85,
    energy: 55,
    water: 50,
    traffic: 65,
    pollution: 62,
    compute: 100,
  });

  // Stats & End Screen
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    crisesResolved: 0,
    protocolsTriggered: 0,
    maxStability: 85,
    minStability: 85,
    citizensSaved: 10000000,
    rank: 'A',
  });

  // Notification Banner
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'warn' | 'success' } | null>({
    message: 'NEXUS 2040: Third-person crisis exploration matrix online.',
    type: 'info',
  });

  const showNotification = useCallback((message: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setNotification({ message, type });
    const timer = setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  // Controls input ref
  const controlsRef = useRef<PlayerControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    interact: false,
  });

  // 1. Initialize 3D Engine, Character, and Follow Camera
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Build the procedural 3D city
    const cityScene = buildProceduralCity(container, {
      interactiveRaycasting: false,
      enableShadows: true,
    });
    city3dRef.current = cityScene;

    // Create the articulated cybernetic field engineer
    const character = createCharacterController();
    character.setPosition(0, 0, 14);
    cityScene.scene.add(character.group);
    characterRef.current = character;

    // Create third-person follow camera
    const thirdPersonCamera = createThirdPersonCamera(cityScene.camera, container);
    thirdPersonCamera.setInvertY(invertY);
    thirdPersonCamera.setInvertX(invertX);
    thirdPersonCamera.setSensitivity(0.0024 * mouseSensitivity);
    cameraControllerRef.current = thirdPersonCamera;

    // Main Game Loop
    let lastTime = performance.now();
    const renderLoop = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const char = characterRef.current;
      const camCtrl = cameraControllerRef.current;

      if (char && camCtrl) {
        // Update character physics & animation
        char.update(dt, controlsRef.current, camCtrl.getYaw(), cityScene.collisionBoxes);

        // Update follow camera
        camCtrl.update(dt, char.state, cityScene.collisionBoxes);

        // Update city systems (train, wind turbines, vehicles)
        cityScene.update(dt);

        // Calculate proximity to sector stations
        let foundStation: SectorStation | null = null;
        for (let i = 0; i < cityScene.sectorStations.length; i++) {
          const st = cityScene.sectorStations[i];
          const dist = Math.hypot(char.state.x - st.terminalCoords[0], char.state.z - st.terminalCoords[2]);
          if (dist <= 8.5) {
            foundStation = st;
            break;
          }
        }
        setNearbyStation(foundStation);

        // Update HUD state throttle
        setPlayerHudState({ ...char.state });
        setCameraHeading(camCtrl.getYaw());
      }

      cityScene.renderer.render(cityScene.scene, cityScene.camera);
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    // Resize Handler
    const handleResize = () => {
      if (!container || !cityScene) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;
      cityScene.camera.aspect = w / h;
      cityScene.camera.updateProjectionMatrix();
      cityScene.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      character.dispose();
      thirdPersonCamera.dispose();
      cityScene.dispose();
      city3dRef.current = null;
      characterRef.current = null;
      cameraControllerRef.current = null;
    };
  }, []);

  // 2. Keyboard & Mouse Input Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activePuzzle) {
        if (e.key === 'Escape') setActivePuzzle(null);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') controlsRef.current.forward = true;
      if (key === 's' || key === 'arrowdown') controlsRef.current.backward = true;
      if (key === 'a' || key === 'arrowleft') controlsRef.current.left = true;
      if (key === 'd' || key === 'arrowright') controlsRef.current.right = true;
      if (e.shiftKey) controlsRef.current.sprint = true;
      if (e.code === 'Space') {
        controlsRef.current.jump = true;
        e.preventDefault();
      }

      // Interact trigger
      if (key === 'e') {
        if (nearbyStation) {
          handleOpenStation(nearbyStation);
        }
      }

      // Pause menu
      if (e.key === 'Escape') {
        if (gameMode === 'playing') {
          setGameMode('paused');
          document.exitPointerLock?.();
        } else if (gameMode === 'paused') {
          setGameMode('playing');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') controlsRef.current.forward = false;
      if (key === 's' || key === 'arrowdown') controlsRef.current.backward = false;
      if (key === 'a' || key === 'arrowleft') controlsRef.current.left = false;
      if (key === 'd' || key === 'arrowright') controlsRef.current.right = false;
      if (!e.shiftKey) controlsRef.current.sprint = false;
      if (e.code === 'Space') controlsRef.current.jump = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === mountRef.current && cameraControllerRef.current) {
        cameraControllerRef.current.handleMouseMove(e.movementX, e.movementY);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (cameraControllerRef.current) {
        cameraControllerRef.current.handleWheel(e.deltaY);
      }
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === mountRef.current;
      setIsPointerLocked(locked);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: true });
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gameMode, activePuzzle, nearbyStation]);

  // Request pointer lock on viewport click
  const handleViewportClick = () => {
    if (gameMode === 'playing' && !activePuzzle && mountRef.current) {
      mountRef.current.requestPointerLock?.();
    }
  };

  // Open interactive station terminal
  const handleOpenStation = (st: SectorStation) => {
    document.exitPointerLock?.();
    soundFx.playInteract();

    if (st.id === 'core') {
      const solvedCount = Object.values(sectorObjectives).filter(Boolean).length;
      if (solvedCount >= 5) {
        // Trigger Victory
        handleVictory();
      } else {
        showNotification(
          `Central Arcology Core requires all 5 municipal sectors online. (${solvedCount}/5 secured)`,
          'warn'
        );
      }
      return;
    }

    setActivePuzzle(st.id);
  };

  // Handle Puzzle Solve Callback
  const handlePuzzleSolved = (stationId: string) => {
    setActivePuzzle(null);
    setSectorObjectives(prev => ({ ...prev, [stationId]: true }));

    if (city3dRef.current) {
      city3dRef.current.setSectorSolved(stationId, true);
    }

    // Boost metrics
    setMetrics(prev => ({
      ...prev,
      stability: Math.min(100, prev.stability + 12),
      energy: stationId === 'substation' ? 95 : prev.energy,
      water: stationId === 'reservoir' ? 92 : prev.water,
      traffic: stationId === 'traffic' ? 24 : prev.traffic,
      pollution: stationId === 'environment' ? 38 : prev.pollution,
      compute: Math.min(100, prev.compute + 30),
    }));

    setStats(prev => ({
      ...prev,
      score: prev.score + 2500,
      crisesResolved: prev.crisesResolved + 1,
    }));

    showNotification(`SECTOR RESTORED: ${stationId.toUpperCase()} online and stabilized!`, 'success');

    // Check if all 5 are solved
    const nextSolved = { ...sectorObjectives, [stationId]: true };
    const allDone = Object.values(nextSolved).filter(Boolean).length >= 5;
    if (allDone) {
      showNotification('ALL 5 SECTORS SECURED! Proceed to the Central Arcology Core to harmonize.', 'success');
    }
  };

  // 120-Second Simulation Countdown & Stability Decay
  useEffect(() => {
    if (gameMode !== 'playing' || activePuzzle) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleDefeat('Crisis timer expired before full harmonization.');
          return 0;
        }
        return prev - 1;
      });

      // Passive stability decay if sectors remain unresolved
      const unresolvedCount = 5 - Object.values(sectorObjectives).filter(Boolean).length;
      if (unresolvedCount > 0) {
        setMetrics(prev => {
          const decay = unresolvedCount * 0.25;
          const newStability = Math.max(0, prev.stability - decay);
          if (newStability <= 0) {
            handleDefeat('Metropolitan stability collapsed to 0%.');
          }
          return {
            ...prev,
            stability: Math.round(newStability * 10) / 10,
          };
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameMode, activePuzzle, sectorObjectives]);

  // Victory Handler
  const handleVictory = () => {
    setGameMode('victory');
    document.exitPointerLock?.();
    soundFx.playVictory();

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#28d9ec', '#35d399', '#f2a93b'],
    });
  };

  // Defeat Handler
  const handleDefeat = (reason: string) => {
    setGameMode('defeat');
    document.exitPointerLock?.();
    soundFx.playDefeat();
    showNotification(`MISSION FAILED: ${reason}`, 'warn');
  };

  // Start Simulation
  const handleStartGame = () => {
    soundFx.playClick();
    setGameMode('playing');
    setTimeLeft(120);
    setSectorObjectives({
      substation: false,
      reservoir: false,
      traffic: false,
      environment: false,
      emergency: false,
    });
    setMetrics({
      stability: 85,
      energy: 55,
      water: 50,
      traffic: 65,
      pollution: 62,
      compute: 100,
    });
    if (characterRef.current) {
      characterRef.current.setPosition(0, 0, 14);
    }
    try {
      mountRef.current?.requestPointerLock?.();
    } catch (_) {}
  };

  const handleRestart = () => {
    handleStartGame();
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.setMuted(!next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const toggleInvertY = () => {
    setInvertY(prev => {
      const next = !prev;
      cameraControllerRef.current?.setInvertY(next);
      return next;
    });
  };

  const toggleInvertX = () => {
    setInvertX(prev => {
      const next = !prev;
      cameraControllerRef.current?.setInvertX(next);
      return next;
    });
  };

  const changeSensitivity = (val: number) => {
    setMouseSensitivity(val);
    cameraControllerRef.current?.setSensitivity(0.0024 * val);
  };

  // Compass formatting
  const getCompassHeadingDegrees = () => {
    const deg = ((cameraHeading * 180) / Math.PI) % 360;
    return (deg + 360) % 360;
  };

  const solvedCount = Object.values(sectorObjectives).filter(Boolean).length;

  return (
    <section id="game-section" className="page-section game-rebuild-section" style={{ paddingTop: '2.5rem' }}>
      <div className="container">
        {/* Section Lead */}
        <div className="section-eyebrow">THIRD-PERSON METROPOLITAN DEFENSE ADVENTURE</div>
        <h2 className="section-heading-lg">NEXUS 2040: Crisis Commander.</h2>
        <p className="section-subtext">
          Control India&rsquo;s autonomous cybernetic field engineer in real-time 3D. Explore the living city streets, navigate to active crisis beacons, and solve five critical engineering puzzles to restore stability before the 120-second crisis timer expires.
        </p>

        {/* Game Master Container */}
        <div className="commander-viewport-frame">
          {/* Top Bar */}
          <div className="commander-topbar">
            <div className="topbar-left">
              <span className="commander-badge">NEXUS 2040 // CRISIS EXPLORER</span>
              <span className="live-pill">THIRD-PERSON 3D</span>
            </div>

            <div className="topbar-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={toggleSound}
                type="button"
                title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span className="btn-label-text">{soundEnabled ? 'Audio ON' : 'Audio OFF'}</span>
              </button>

              <button
                className="btn btn-ghost btn-sm"
                onClick={toggleFullscreen}
                type="button"
                title="Fullscreen Game"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              {gameMode === 'playing' && (
                <>
                  <button
                    className={`btn btn-ghost btn-sm ${invertY ? 'btn-active' : ''}`}
                    onClick={toggleInvertY}
                    type="button"
                    title="Toggle Inverted Mouse Look (Y-axis)"
                  >
                    <span>Invert Y: {invertY ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setGameMode('paused');
                      document.exitPointerLock?.();
                    }}
                    type="button"
                  >
                    Pause
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3D Scene Viewport Canvas */}
          <div
            ref={mountRef}
            className="commander-canvas-stage"
            onClick={handleViewportClick}
            aria-label="Interactive 3D Third-Person City Experience"
          >
            {/* Reticle / Crosshair */}
            {gameMode === 'playing' && !activePuzzle && isPointerLocked && (
              <div className="third-person-reticle" aria-hidden="true">
                <Crosshair size={18} />
              </div>
            )}

            {/* Click to Lock Mouse Prompt */}
            {gameMode === 'playing' && !activePuzzle && !isPointerLocked && (
              <div className="pointer-lock-overlay-prompt">
                <Lock size={16} style={{ marginRight: '6px' }} />
                <span>Click viewport to lock mouse cursor for 3D camera look (Esc to unlock)</span>
              </div>
            )}

            {/* Floating Interaction Prompt */}
            {gameMode === 'playing' && !activePuzzle && nearbyStation && (
              <div className="floating-interaction-prompt">
                <button
                  className="prompt-pill-btn"
                  onClick={() => handleOpenStation(nearbyStation)}
                  type="button"
                >
                  <span className="key-badge">E</span>
                  <span>{nearbyStation.promptLabel}</span>
                </button>
              </div>
            )}

            {/* 360° Compass Navigation Bar at Top */}
            {gameMode === 'playing' && (
              <div className="hud-compass-bar">
                <div className="compass-cardinals">
                  <span>N</span>
                  <span>NE</span>
                  <span>E</span>
                  <span>SE</span>
                  <span>S</span>
                  <span>SW</span>
                  <span>W</span>
                  <span>NW</span>
                </div>
                <div className="compass-center-marker">
                  <Compass size={14} />
                  <span>{Math.round(getCompassHeadingDegrees())}°</span>
                </div>
              </div>
            )}

            {/* Objective Checklist in Top Right */}
            {gameMode === 'playing' && (
              <div className="hud-objective-card">
                <div className="obj-header">
                  <span>MUNICIPAL OBJECTIVES</span>
                  <span className="obj-counter color-cyan">{solvedCount}/5</span>
                </div>
                <div className="obj-list" style={{ pointerEvents: 'auto' }}>
                  <button
                    type="button"
                    className={`obj-item ${sectorObjectives.substation ? 'done' : ''}`}
                    onClick={() => {
                      const st = city3dRef.current?.sectorStations.find(s => s.id === 'substation');
                      if (st) handleOpenStation(st);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' }}
                  >
                    <Zap size={13} className={sectorObjectives.substation ? 'color-good' : 'color-cyan'} />
                    <span>Clean Grid Substation</span>
                  </button>
                  <button
                    type="button"
                    className={`obj-item ${sectorObjectives.reservoir ? 'done' : ''}`}
                    onClick={() => {
                      const st = city3dRef.current?.sectorStations.find(s => s.id === 'reservoir');
                      if (st) handleOpenStation(st);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' }}
                  >
                    <Droplets size={13} className={sectorObjectives.reservoir ? 'color-good' : 'color-cyan'} />
                    <span>Yamuna Sponge Aquifer</span>
                  </button>
                  <button
                    type="button"
                    className={`obj-item ${sectorObjectives.traffic ? 'done' : ''}`}
                    onClick={() => {
                      const st = city3dRef.current?.sectorStations.find(s => s.id === 'traffic');
                      if (st) handleOpenStation(st);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' }}
                  >
                    <Car size={13} className={sectorObjectives.traffic ? 'color-good' : 'color-cyan'} />
                    <span>CBD Traffic Green Wave</span>
                  </button>
                  <button
                    type="button"
                    className={`obj-item ${sectorObjectives.environment ? 'done' : ''}`}
                    onClick={() => {
                      const st = city3dRef.current?.sectorStations.find(s => s.id === 'environment');
                      if (st) handleOpenStation(st);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' }}
                  >
                    <Wind size={13} className={sectorObjectives.environment ? 'color-good' : 'color-cyan'} />
                    <span>Bio-Resonance Smog Hub</span>
                  </button>
                  <button
                    type="button"
                    className={`obj-item ${sectorObjectives.emergency ? 'done' : ''}`}
                    onClick={() => {
                      const st = city3dRef.current?.sectorStations.find(s => s.id === 'emergency');
                      if (st) handleOpenStation(st);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' }}
                  >
                    <ShieldAlert size={13} className={sectorObjectives.emergency ? 'color-good' : 'color-cyan'} />
                    <span>Trauma Hospital Microgrid</span>
                  </button>
                </div>
              </div>
            )}

            {/* Stability & Time Gauges Top Left */}
            {gameMode === 'playing' && (
              <div className="hud-vitals-card">
                <div className="vital-row">
                  <span className="vital-label">CITY STABILITY</span>
                  <span
                    className={`vital-val ${
                      metrics.stability > 60 ? 'color-good' : metrics.stability > 30 ? 'color-amber' : 'color-critical'
                    }`}
                  >
                    {Math.round(metrics.stability)}%
                  </span>
                </div>
                <div className="vital-bar-track">
                  <div
                    className="vital-bar-fill"
                    style={{
                      width: `${metrics.stability}%`,
                      backgroundColor:
                        metrics.stability > 60
                          ? 'var(--green)'
                          : metrics.stability > 30
                          ? 'var(--amber)'
                          : 'var(--red)',
                    }}
                  />
                </div>

                <div className="vital-row" style={{ marginTop: '0.4rem' }}>
                  <span className="vital-label">CRISIS TIMER</span>
                  <span className={`vital-val ${timeLeft < 30 ? 'color-critical' : 'color-cyan'}`}>
                    {timeLeft}s
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Controls Legend Strip */}
            {gameMode === 'playing' && (
              <div className="hud-controls-helper">
                <span>[W][A][S][D] Move</span>
                <span>·</span>
                <span>[Mouse] Look</span>
                <span>·</span>
                <span>[Shift] Sprint</span>
                <span>·</span>
                <span>[Space] Jet Jump</span>
                <span>·</span>
                <span>[E] Interact</span>
                <span>·</span>
                <span>[Esc] Pause &amp; Settings</span>
              </div>
            )}
          </div>

          {/* MAIN MENU OVERLAY */}
          {gameMode === 'menu' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <span className="menu-kicker">AUTHENTICATED // CHIEF AI FIELD ENGINEER</span>
                <h1 className="menu-game-title">NEXUS 2040</h1>
                <h2 className="menu-game-subtitle">CRISIS COMMANDER: 3D ADVENTURE</h2>

                <p className="menu-brief">
                  You are deployed into the living streets of Nexus City. Ten million citizens depend on your field actions to restore five failing municipal sectors: power grid, sponge aquifers, traffic arteries, air quality, and trauma microgrids.
                </p>

                <div className="menu-specs-row">
                  <div className="menu-spec-box">
                    <span className="spec-big">120s</span>
                    <span className="spec-sub">Crisis Duration</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big">5 Puzzles</span>
                    <span className="spec-sub">Logical Challenges</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big">Third-Person</span>
                    <span className="spec-sub">Controllable 3D Hero</span>
                  </div>
                </div>

                <div className="menu-buttons-group">
                  <button className="btn btn-primary btn-lg" onClick={handleStartGame} type="button">
                    <Play size={16} style={{ marginRight: '8px' }} />
                    INITIALIZE SIMULATION
                  </button>
                  <button className="btn btn-ghost btn-lg" onClick={() => setGameMode('instructions')} type="button">
                    <Info size={16} style={{ marginRight: '8px' }} />
                    Mission Briefing &amp; Controls
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HOW TO PLAY MODAL */}
          {gameMode === 'instructions' && (
            <div className="commander-menu-overlay">
              <div className="modal-instructions-card">
                <div className="cc-modal-header">
                  <h3>Mission Briefing &amp; Operative Controls</h3>
                  <button className="btn-close" onClick={() => setGameMode('menu')} type="button">
                    <X size={18} />
                  </button>
                </div>

                <div className="instructions-body">
                  <div className="inst-section">
                    <h4>🕹️ Operative Controls</h4>
                    <p>
                      <strong>WASD / Arrow Keys</strong>: Move field engineer forward, backward, left, and right.
                      <br />
                      <strong>Mouse Look</strong>: Pointer-lock orbital third-person camera. Follows your character naturally with building collision avoidance.
                      <br />
                      <strong>Shift</strong>: Jetpack thruster sprint across metropolitan boulevards.
                      <br />
                      <strong>Space</strong>: Jet booster jump to hop over curbs and barriers.
                      <br />
                      <strong>E</strong>: Interact with infrastructure terminals when in proximity.
                    </p>
                  </div>

                  <div className="inst-section">
                    <h4>🧩 Five Sector Challenges</h4>
                    <p>
                      1. <strong>Clean Grid Substation</strong>: Rotate circuit conduits to align the Solar/BESS feed with the metropolitan transformer bus.
                      <br />
                      2. <strong>Yamuna Sponge Aquifer</strong>: Align hydraulic valves to 90° to route flash-flood runoff into subterranean retention sponges.
                      <br />
                      3. <strong>CBD Traffic Command</strong>: Synchronize intersection phase timings into an uninterrupted &ldquo;Green Wave&rdquo;.
                      <br />
                      4. <strong>Bio-Resonance Air Hub</strong>: Calibrate harmonic frequency and ultrasonic amplitude to disperse PM2.5 smog plumes.
                      <br />
                      5. <strong>Trauma Hospital Microgrid</strong>: Triage emergency power distribution across ICU, surgical, and lift lifelines.
                    </p>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-primary btn-md" onClick={handleStartGame} type="button">
                    Start Mission Now
                  </button>
                  <button className="btn btn-ghost btn-md" onClick={() => setGameMode('menu')} type="button">
                    Return to Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PAUSE MENU */}
          {gameMode === 'paused' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <h3>SIMULATION PAUSED</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                  City systems held in frozen state. Time remaining: {timeLeft}s.
                </p>

                {/* Control Preferences Card */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  textAlign: 'left'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🎮 Camera &amp; Mouse Control Preferences
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Invert Pitch (Y-Axis):</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${invertY ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={toggleInvertY}
                    >
                      {invertY ? 'INVERTED' : 'NORMAL (Standard)'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Invert Yaw (X-Axis):</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${invertX ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={toggleInvertX}
                    >
                      {invertX ? 'INVERTED' : 'NORMAL (Standard)'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Mouse Look Sensitivity:</span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {[0.6, 1.0, 1.5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`btn btn-sm ${mouseSensitivity === s ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => changeSensitivity(s)}
                          style={{ minWidth: '42px', padding: '0.2rem 0.5rem' }}
                        >
                          {s === 0.6 ? 'Low' : s === 1.0 ? 'Med' : 'High'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button
                    className="btn btn-primary btn-md"
                    onClick={() => {
                      setGameMode('playing');
                      setTimeout(() => {
                        mountRef.current?.requestPointerLock?.();
                      }, 200);
                    }}
                    type="button"
                  >
                    Resume Exploration
                  </button>
                  <button className="btn btn-ghost btn-md" onClick={handleRestart} type="button">
                    Restart Simulation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VICTORY SCREEN */}
          {gameMode === 'victory' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <span className="menu-kicker color-good">METROPOLITAN HARMONIZATION ACHIEVED</span>
                <h1 className="menu-game-title" style={{ color: 'var(--green)' }}>
                  VICTORY
                </h1>
                <p className="menu-brief">
                  You successfully resolved all five municipal crises and harmonized the Central Arcology Core! All 10,000,000 citizens are secure, clean energy is balanced, and closed-loop sponge aquifers are full.
                </p>

                <div className="menu-specs-row">
                  <div className="menu-spec-box">
                    <span className="spec-big color-good">10,000,000</span>
                    <span className="spec-sub">Citizens Protected</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big color-cyan">{stats.score}</span>
                    <span className="spec-sub">Triage Score</span>
                  </div>
                  <div className="menu-spec-box">
                    <span className="spec-big color-good">RANK S+</span>
                    <span className="spec-sub">Command Rating</span>
                  </div>
                </div>

                <div className="menu-buttons-group">
                  <button className="btn btn-primary btn-lg" onClick={handleRestart} type="button">
                    <RotateCcw size={16} style={{ marginRight: '8px' }} />
                    PLAY AGAIN
                  </button>
                  {onExploreCity && (
                    <button className="btn btn-ghost btn-lg" onClick={onExploreCity} type="button">
                      Inspect 3D Twin
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DEFEAT SCREEN */}
          {gameMode === 'defeat' && (
            <div className="commander-menu-overlay">
              <div className="menu-center-card">
                <span className="menu-kicker color-critical">METROPOLITAN INFRASTRUCTURE FAILURE</span>
                <h1 className="menu-game-title" style={{ color: 'var(--red)' }}>
                  DEFEAT
                </h1>
                <p className="menu-brief">
                  Metropolitan stability collapsed before all municipal crises could be resolved. Electrical brownouts and flash-floods overwhelmed city safety buffers.
                </p>

                <div className="menu-buttons-group">
                  <button className="btn btn-primary btn-lg" onClick={handleRestart} type="button">
                    <RotateCcw size={16} style={{ marginRight: '8px' }} />
                    RETRY SIMULATION
                  </button>
                  <button className="btn btn-ghost btn-lg" onClick={() => setGameMode('menu')} type="button">
                    Return to Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE PUZZLE MODALS */}
          {activePuzzle === 'substation' && (
            <PowerGridPuzzle
              onSolve={() => handlePuzzleSolved('substation')}
              onClose={() => setActivePuzzle(null)}
            />
          )}

          {activePuzzle === 'reservoir' && (
            <WaterNetworkPuzzle
              onSolve={() => handlePuzzleSolved('reservoir')}
              onClose={() => setActivePuzzle(null)}
            />
          )}

          {activePuzzle === 'traffic' && (
            <TrafficPuzzle
              onSolve={() => handlePuzzleSolved('traffic')}
              onClose={() => setActivePuzzle(null)}
            />
          )}

          {activePuzzle === 'environment' && (
            <AirScrubberPuzzle
              onSolve={() => handlePuzzleSolved('environment')}
              onClose={() => setActivePuzzle(null)}
            />
          )}

          {activePuzzle === 'emergency' && (
            <HospitalMicrogridPuzzle
              onSolve={() => handlePuzzleSolved('emergency')}
              onClose={() => setActivePuzzle(null)}
            />
          )}
        </div>
      </div>
    </section>
  );
};
