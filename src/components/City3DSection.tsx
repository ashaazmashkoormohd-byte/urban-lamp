import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraPreset, CityState, LayerVisibility } from '../types/city';
import { ZONE_DETAILS_MAP, roundVal, trafficStatus, renewableStatus, waterStatus, aqiStatus, marginStatus } from '../data/cityData';
import { formatTimeOfDay } from '../utils/simulation';
import { buildProceduralCity, City3DScene } from '../utils/cityBuilder3D';
import { Sun, Moon, RotateCcw } from 'lucide-react';

interface City3DSectionProps {
  state: CityState;
  onUpdateTimeOfDay: (time: number) => void;
  onToggleAutoTime: () => void;
}

export const City3DSection: React.FC<City3DSectionProps> = ({
  state,
  onUpdateTimeOfDay,
  onToggleAutoTime,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('cbd');
  const [activeCamPreset, setActiveCamPreset] = useState<CameraPreset>('overview');

  const [layers, setLayers] = useState<LayerVisibility>({
    roads: true,
    electricity: true,
    water: true,
    transit: true,
    buildings: true,
  });

  const citySceneRef = useRef<{
    cityScene: City3DScene;
    controls: OrbitControls;
    targetCamPos: THREE.Vector3 | null;
    targetLookAt: THREE.Vector3 | null;
    defaultCamPos: THREE.Vector3;
    defaultTarget: THREE.Vector3;
    animId: number;
  } | null>(null);

  const presets: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
    overview: { pos: [0, 95, 130], target: [0, 0, 0], label: '🌐 Overview' },
    cbd: { pos: [-22, 35, -35], target: [-22, 12, -60], label: '🏙️ CBD Towers' },
    solar: { pos: [-22, 24, 25], target: [-22, 4, 0], label: '☀️ Solar Grid' },
    reservoir: { pos: [-68, 30, 85], target: [-68, 4, 60], label: '💧 Eco-Reservoir' },
    hospital: { pos: [-68, 26, 25], target: [-68, 5, 0], label: '🏥 Hospital Hub' },
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Build the exact same procedural city used by the game
    const cityScene = buildProceduralCity(container, {
      interactiveRaycasting: true,
      onSelectZone: (zoneId: string) => {
        setSelectedZoneId(zoneId);
      },
      enableShadows: true,
    });

    const defaultCamPos = new THREE.Vector3(0, 95, 130);
    const defaultTarget = new THREE.Vector3(0, 0, 0);

    const controls = new OrbitControls(cityScene.camera, cityScene.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 15;
    controls.maxDistance = 240;
    controls.target.copy(defaultTarget);

    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      controls.update();

      // Camera preset smooth transition
      const sRef = citySceneRef.current;
      if (sRef?.targetCamPos && sRef?.targetLookAt) {
        cityScene.camera.position.lerp(sRef.targetCamPos, Math.min(1, dt * 5));
        controls.target.lerp(sRef.targetLookAt, Math.min(1, dt * 5));
        if (cityScene.camera.position.distanceTo(sRef.targetCamPos) < 0.6) {
          sRef.targetCamPos = null;
          sRef.targetLookAt = null;
        }
      }

      cityScene.update(dt, { timeOfDay: state.timeOfDay });
      cityScene.renderer.render(cityScene.scene, cityScene.camera);

      citySceneRef.current!.animId = requestAnimationFrame(animate);
    };

    citySceneRef.current = {
      cityScene,
      controls,
      targetCamPos: null,
      targetLookAt: null,
      defaultCamPos,
      defaultTarget,
      animId: requestAnimationFrame(animate),
    };

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
      if (citySceneRef.current?.animId) {
        cancelAnimationFrame(citySceneRef.current.animId);
      }
      controls.dispose();
      cityScene.dispose();
      citySceneRef.current = null;
    };
  }, []);

  // Sync time-of-day changes
  useEffect(() => {
    if (!citySceneRef.current) return;
    citySceneRef.current.cityScene.update(0.01, { timeOfDay: state.timeOfDay });
  }, [state.timeOfDay]);

  const handleCameraPreset = (name: CameraPreset) => {
    setActiveCamPreset(name);
    const sRef = citySceneRef.current;
    if (!sRef) return;
    const preset = presets[name];
    sRef.targetCamPos = new THREE.Vector3(...preset.pos);
    sRef.targetLookAt = new THREE.Vector3(...preset.target);
  };

  const handleResetCamera = () => {
    const sRef = citySceneRef.current;
    if (!sRef) return;
    sRef.targetCamPos = null;
    sRef.targetLookAt = null;
    sRef.cityScene.camera.position.copy(sRef.defaultCamPos);
    sRef.controls.target.copy(sRef.defaultTarget);
    sRef.controls.update();
    setActiveCamPreset('overview');
  };

  const activeZoneInfo = ZONE_DETAILS_MAP[selectedZoneId] || ZONE_DETAILS_MAP['cbd'];

  const getZoneStats = (zoneId: string) => {
    const m = state.metrics;
    switch (zoneId) {
      case 'res-a':
      case 'res-b':
        return [
          { label: 'Local Traffic Flow', value: `${roundVal(m.traffic)}%`, status: trafficStatus(m.traffic) },
          { label: 'Air Purity Corridor', value: `${roundVal(m.aqi)} AQI`, status: aqiStatus(m.aqi) },
          { label: 'Greywater Recycling', value: `${roundVal(m.water)}%`, status: waterStatus(m.water) },
        ];
      case 'cbd':
        return [
          { label: 'Commercial Power Draw', value: `${roundVal(m.demand)}%`, status: marginStatus(m.supply, m.demand) },
          { label: 'Access Corridor Congestion', value: `${roundVal(m.traffic)}%`, status: trafficStatus(m.traffic) },
          { label: 'Air Particulate Sensor', value: `${roundVal(m.aqi)} AQI`, status: aqiStatus(m.aqi) },
        ];
      case 'hospital':
        return [
          { label: 'Clinical Bed Occupancy', value: `${roundVal(state.hospitalLoad)}%`, status: state.hospitalLoad > 70 ? 'critical' : 'good' },
          { label: 'Microgrid Emergency Feed', value: `${roundVal(m.supply)}%`, status: marginStatus(m.supply, m.demand) },
          { label: 'Air Filtration Scrubbers', value: 'Active', status: 'good' },
        ];
      case 'solar-a':
      case 'solar-b':
        return [
          { label: 'Solar Generation Status', value: `${roundVal(m.renewable)}%`, status: renewableStatus(m.renewable) },
          { label: 'BESS Sync Efficiency', value: '98.4%', status: 'good' },
          { label: 'Grid Export Headroom', value: `${roundVal(m.supply - m.demand)}%`, status: marginStatus(m.supply, m.demand) },
        ];
      case 'substation':
        return [
          { label: 'Total Grid Supply', value: `${roundVal(m.supply)}%`, status: marginStatus(m.supply, m.demand) },
          { label: 'Metropolitan Demand', value: `${roundVal(m.demand)}%`, status: marginStatus(m.supply, m.demand) },
          { label: 'Net Supply Margin', value: `${roundVal(m.supply - m.demand)}%`, status: marginStatus(m.supply, m.demand) },
        ];
      case 'reservoir':
        return [
          { label: 'Aquifer Water Reserves', value: `${roundVal(m.water)}%`, status: waterStatus(m.water) },
          { label: 'Storm Retention Buffer', value: '4.5M Litres', status: 'good' },
          { label: 'Automated Sluice Status', value: state.activeEmergency?.id === 'flood' ? 'Emergency Drain' : 'Closed', status: state.activeEmergency?.id === 'flood' ? 'warning' : 'good' },
        ];
      default:
        return [
          { label: 'Ecological Health', value: 'Optimal', status: 'good' },
          { label: 'Heat Island Buffer', value: '-3.8°C Ambient', status: 'good' },
          { label: 'Local Particulate Scrubbing', value: `${roundVal(m.aqi)} AQI`, status: aqiStatus(m.aqi) },
        ];
    }
  };

  const currentStats = getZoneStats(selectedZoneId);

  return (
    <section id="city3d-section" className="page-section" style={{ paddingTop: '2rem' }}>
      <div className="container">
        <div className="section-eyebrow">INTERACTIVE METROPOLITAN DIGITAL TWIN</div>
        <h2 className="section-heading-lg">Explore Nexus City in Genuine 3D.</h2>
        <p className="section-subtext">
          Rendered live in your browser with Three.js. Drag to rotate, scroll to zoom, right-click to pan. Select cinematic camera presets, scrub the day/night lighting cycle, or click any structure to inspect its live simulated status.
        </p>

        <div className="city-3d-wrapper">
          {/* Top 3D Control Bar */}
          <div className="city-controls-bar">
            {/* Camera Presets */}
            <div className="cam-presets-group">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: '0.3rem' }}>
                CAMERAS:
              </span>
              {(Object.keys(presets) as CameraPreset[]).map(key => (
                <button
                  key={key}
                  className={`preset-pill ${activeCamPreset === key ? 'active' : ''}`}
                  onClick={() => handleCameraPreset(key)}
                  type="button"
                >
                  {presets[key].label}
                </button>
              ))}
            </div>

            {/* Time of Day Control */}
            <div className="time-control">
              <label htmlFor="timeSlider">Time of Day:</label>
              <input
                type="range"
                id="timeSlider"
                min="0"
                max="24"
                step="0.25"
                value={state.timeOfDay}
                onChange={e => onUpdateTimeOfDay(parseFloat(e.target.value))}
              />
              <span id="timeDisplay" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', minWidth: '45px' }}>
                {formatTimeOfDay(state.timeOfDay)}
              </span>
              <button
                id="autoTimeBtn"
                className={`preset-pill ${state.autoTime ? 'active' : ''}`}
                onClick={onToggleAutoTime}
                type="button"
              >
                {state.autoTime ? (
                  <>
                    <Sun size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Auto: ON
                  </>
                ) : (
                  <>
                    <Moon size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Auto: OFF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Viewport + Context Sidebar */}
          <div className="city-viewport-container">
            <div
              ref={mountRef}
              id="cityCanvasWrap"
              className="city3d-canvas-wrap"
              aria-label="3D view of Nexus City"
            ></div>

            <div className="city3d-hint">
              Drag to rotate · Scroll to zoom · Right-click to pan · Click structure to inspect
            </div>

            <button
              id="resetCameraBtn"
              className="btn btn-ghost btn-sm city3d-reset-btn"
              type="button"
              onClick={handleResetCamera}
            >
              <RotateCcw size={13} style={{ marginRight: '4px' }} />
              Reset View
            </button>

            {/* Contextual Telemetry Sidebar */}
            <aside className="map-info-sidebar" id="mapInfo">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span className="section-eyebrow" style={{ margin: 0 }}>{activeZoneInfo.tag}</span>
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.6rem' }}>{activeZoneInfo.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                {activeZoneInfo.desc}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Live Telemetry Stream
                </div>
                {currentStats.map((st, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{st.label}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color:
                          st.status === 'good'
                            ? 'var(--green)'
                            : st.status === 'warning' || st.status === 'moderate'
                            ? 'var(--amber)'
                            : 'var(--red)',
                      }}
                    >
                      {st.value}
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
};
