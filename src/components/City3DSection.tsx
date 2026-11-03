import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraPreset, CityState, LayerVisibility, MetricStatus } from '../types/city';
import { ZONE_DETAILS_MAP, roundVal, clamp, trafficStatus, renewableStatus, waterStatus, aqiStatus, marginStatus } from '../data/cityData';
import { formatTimeOfDay } from '../utils/simulation';
import { Layers, Sun, Moon, Compass, RotateCcw } from 'lucide-react';

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

  // Three.js internal references
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    raycaster: THREE.Raycaster;
    selectable: THREE.Object3D[];
    roadMaterial: THREE.MeshStandardMaterial;
    solarMaterial: THREE.MeshStandardMaterial;
    hospitalMaterial: THREE.MeshStandardMaterial;
    substationMaterial: THREE.MeshStandardMaterial;
    transitMaterial: THREE.MeshStandardMaterial;
    reservoirFillMesh: THREE.Mesh;
    floodOverlay: THREE.Mesh;
    fireSystem: THREE.Points;
    heatwaveSystem: THREE.Points;
    rainSystem: THREE.Points;
    pollutionSystem: THREE.Points;
    windBlades: THREE.Group[];
    buildingMaterials: THREE.MeshStandardMaterial[];
    streetLights: THREE.Mesh[];
    congestionMeshes: THREE.Mesh[];
    vehicleMeshes: {
      mesh: THREE.Group;
      roadAxis: 'x' | 'z';
      roadCoord: number;
      minPos: number;
      maxPos: number;
      speed: number;
      direction: number;
    }[];
    trafficLights: {
      x: number;
      z: number;
      lights: Record<string, any>;
      timer: number;
      phase: number;
    }[];
    ambientLight: THREE.AmbientLight;
    sunLight: THREE.DirectionalLight;
    targetCamPos: THREE.Vector3 | null;
    targetLookAt: THREE.Vector3 | null;
    defaultCamPos: THREE.Vector3;
    defaultTarget: THREE.Vector3;
    layerGroups: Record<keyof LayerVisibility, THREE.Group>;
    animId: number;
  } | null>(null);

  const presets: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
    overview: { pos: [0, 85, 120], target: [0, 0, 0], label: '🌐 Overview' },
    cbd: { pos: [-17, 30, -10], target: [-17, 10, -40], label: '🏙️ CBD Towers' },
    solar: { pos: [0, 20, 25], target: [0, 0, 0], label: '☀️ Solar Grid' },
    reservoir: { pos: [-61, 25, 60], target: [-61, 4, 34], label: '💧 Eco-Reservoir' },
    hospital: { pos: [-61, 20, 20], target: [-61, 4, 0], label: '🏥 Hospital Hub' },
  };

  // Color constants
  const COLOR = {
    bg: 0x060b13,
    elev1: 0x0b1626,
    elev2: 0x101f33,
    building: 0x15314c,
    buildingHi: 0x1b3a57,
    cyan: 0x28d9ec,
    green: 0x35d399,
    amber: 0xf2a93b,
    red: 0xff5d5d,
    textPrim: 0xe7f3f8,
    muted: 0x3c4f62,
    trunk: 0x3a2c1f,
    leaf: 0x1f6b4d,
  };

  const STATUS_COLOR = {
    good: COLOR.green,
    moderate: COLOR.amber,
    critical: COLOR.red,
  };

  // Setup Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLOR.bg);
    scene.fog = new THREE.FogExp2(COLOR.bg, 0.0048);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    const defaultCamPos = new THREE.Vector3(0, 85, 120);
    const defaultTarget = new THREE.Vector3(0, 0, 0);
    camera.position.copy(defaultCamPos);
    camera.lookAt(defaultTarget);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 20;
    controls.maxDistance = 220;
    controls.target.copy(defaultTarget);

    const raycaster = new THREE.Raycaster();
    const selectable: THREE.Object3D[] = [];

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xe7f3f8, 1.05);
    sunLight.position.set(70, 95, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -90;
    sunLight.shadow.camera.right = 90;
    sunLight.shadow.camera.top = 90;
    sunLight.shadow.camera.bottom = -90;
    scene.add(sunLight);

    // Layer Groups
    const layerGroups: Record<keyof LayerVisibility, THREE.Group> = {
      roads: new THREE.Group(),
      electricity: new THREE.Group(),
      water: new THREE.Group(),
      transit: new THREE.Group(),
      buildings: new THREE.Group(),
    };
    Object.values(layerGroups).forEach(g => scene.add(g));

    // Shared Geometries
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);

    const markSelectable = (obj: THREE.Object3D, zoneId: string) => {
      obj.userData.zoneId = zoneId;
      selectable.push(obj);
    };

    const makeStdMat = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) => {
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        metalness: 0.15,
        ...opts,
      });
    };

    // Ground
    const groundMat = makeStdMat(COLOR.elev1, { roughness: 0.95, metalness: 0.05 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(190, 150), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Materials
    const roadMaterial = makeStdMat(STATUS_COLOR.good, { roughness: 0.6, emissive: 0x031a16, emissiveIntensity: 0.3 });
    const solarMaterial = makeStdMat(STATUS_COLOR.good, { emissive: STATUS_COLOR.good, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.7 });
    const hospitalMaterial = makeStdMat(COLOR.textPrim, { emissive: 0x332020, emissiveIntensity: 0.15, roughness: 0.6 });
    const substationMaterial = makeStdMat(STATUS_COLOR.good, { emissive: STATUS_COLOR.good, emissiveIntensity: 0.4, roughness: 0.5 });
    const transitMaterial = makeStdMat(STATUS_COLOR.good, { emissive: STATUS_COLOR.good, emissiveIntensity: 0.45, metalness: 0.6 });

    const buildingMaterials: THREE.MeshStandardMaterial[] = [];
    const streetLights: THREE.Mesh[] = [];
    const congestionMeshes: THREE.Mesh[] = [];
    const vehicleMeshes: {
      mesh: THREE.Group;
      roadAxis: 'x' | 'z';
      roadCoord: number;
      minPos: number;
      maxPos: number;
      speed: number;
      direction: number;
    }[] = [];
    const trafficLights: {
      x: number;
      z: number;
      lights: Record<string, any>;
      timer: number;
      phase: number;
    }[] = [];
    const windBlades: THREE.Group[] = [];

    // Helper addBox
    const addBox = (grp: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, castShadow = false) => {
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      grp.add(mesh);
      return mesh;
    };

    const addCyl = (grp: THREE.Group, x: number, y: number, z: number, rad: number, h: number, mat: THREE.Material, castShadow = false) => {
      const mesh = new THREE.Mesh(cylGeo, mat);
      mesh.scale.set(rad * 2, h, rad * 2);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      grp.add(mesh);
      return mesh;
    };

    // 1. Build Roads
    const roadMeshes: THREE.Mesh[] = [];
    [-34, 0, 34].forEach(x => roadMeshes.push(addBox(layerGroups.roads, x, 0.05, 0, 6, 0.15, 140, roadMaterial)));
    [-18, 18].forEach(z => roadMeshes.push(addBox(layerGroups.roads, 0, 0.05, z, 180, 0.15, 6, roadMaterial)));
    roadMeshes.forEach(m => markSelectable(m, 'roads'));

    // Congestion markers
    const congestionMat = makeStdMat(COLOR.red, { transparent: true, opacity: 0.5 });
    [-34, 0, 34].forEach(x => {
      for (let z = -50; z <= 50; z += 20) {
        const c = addBox(layerGroups.roads, x, 0.2, z, 4, 0.1, 8, congestionMat);
        c.visible = false;
        congestionMeshes.push(c);
      }
    });

    // Streetlights
    const lightPoleMat = makeStdMat(0x4a5568);
    const bulbOnMat = makeStdMat(0xffd700, { emissive: 0xffd700, emissiveIntensity: 0.9 });
    const bulbOffMat = makeStdMat(0x4a5568, { emissive: 0x000000, emissiveIntensity: 0 });

    [-34, 0, 34].forEach(x => {
      for (let z = -50; z <= 50; z += 25) {
        addCyl(layerGroups.roads, x + 3.8, 0, z, 0.15, 4.5, lightPoleMat);
        const bulb = addBox(layerGroups.roads, x + 3.8, 4.4, z, 0.35, 0.35, 0.35, bulbOffMat);
        bulb.userData.bulbOn = bulbOnMat;
        bulb.userData.bulbOff = bulbOffMat;
        streetLights.push(bulb);
      }
    });

    // Traffic Lights at Intersections
    const intersections: { x: number; z: number }[] = [];
    [-34, 0, 34].forEach(x => {
      [-18, 18].forEach(z => intersections.push({ x, z }));
    });

    const tlRedMat = makeStdMat(0xff0000, { emissive: 0xff0000, emissiveIntensity: 0.8 });
    const tlGreenMat = makeStdMat(0x00ff00, { emissive: 0x00ff00, emissiveIntensity: 0.8 });
    const tlOffMat = makeStdMat(0x1a1a1a);

    intersections.forEach((inter, i) => {
      const pole = addCyl(layerGroups.roads, inter.x + 4, 0, inter.z + 4, 0.2, 3.8, lightPoleMat);
      const head = addBox(layerGroups.roads, inter.x + 4, 3.8, inter.z + 4, 0.7, 1.8, 0.7, lightPoleMat);
      const redMesh = addBox(layerGroups.roads, inter.x + 4, 4.4, inter.z + 4.4, 0.3, 0.3, 0.1, i % 2 === 0 ? tlRedMat : tlOffMat);
      const greenMesh = addBox(layerGroups.roads, inter.x + 4, 3.8, inter.z + 4.4, 0.3, 0.3, 0.1, i % 2 === 0 ? tlOffMat : tlGreenMat);

      trafficLights.push({
        x: inter.x,
        z: inter.z,
        lights: { redMesh, greenMesh, tlRedMat, tlGreenMat, tlOffMat },
        timer: i * 1.5,
        phase: i % 2,
      });
    });

    // Vehicles
    const carColors = [0x28d9ec, 0xff5d5d, 0x35d399, 0xf2a93b, 0xffffff, 0xa78bfa];
    [-34, 0, 34].forEach((x, idx) => {
      for (let i = 0; i < 3; i++) {
        const carGrp = new THREE.Group();
        const carColor = carColors[(idx * 3 + i) % carColors.length];
        const bodyMat = makeStdMat(carColor, { roughness: 0.3, metalness: 0.8 });
        const carBody = new THREE.Mesh(boxGeo, bodyMat);
        carBody.scale.set(1.6, 0.8, 3.2);
        carBody.position.y = 0.5;
        carGrp.add(carBody);

        // Headlights
        const hLight = new THREE.Mesh(boxGeo, makeStdMat(0xffffaa, { emissive: 0xffffaa, emissiveIntensity: 0.8 }));
        hLight.scale.set(1.2, 0.25, 0.2);
        hLight.position.set(0, 0.5, 1.6);
        carGrp.add(hLight);

        const zPos = -50 + i * 40;
        carGrp.position.set(x + (i % 2 === 0 ? 1.5 : -1.5), 0, zPos);
        layerGroups.roads.add(carGrp);

        vehicleMeshes.push({
          mesh: carGrp,
          roadAxis: 'z',
          roadCoord: x + (i % 2 === 0 ? 1.5 : -1.5),
          minPos: -65,
          maxPos: 65,
          speed: 15 + Math.random() * 8,
          direction: i % 2 === 0 ? 1 : -1,
        });
      }
    });

    // 2. Build Buildings (Residential & CBD)
    const bldgMatRes = makeStdMat(COLOR.building, { emissive: 0x0b2430, emissiveIntensity: 0.35, roughness: 0.7 });
    bldgMatRes.userData = { baseEmissive: 0.35, nightEmissive: 0.75 };
    buildingMaterials.push(bldgMatRes);

    const bldgMatCBD = makeStdMat(COLOR.buildingHi, { emissive: 0x123246, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.3 });
    bldgMatCBD.userData = { baseEmissive: 0.55, nightEmissive: 0.9 };
    buildingMaterials.push(bldgMatCBD);

    // Residential A (-61, -40) & B (17, -40)
    const buildResBlock = (cx: number, cz: number, zId: string) => {
      const heights = [5, 7.5, 4.5, 8, 6, 5.5, 8, 4, 7];
      let hIdx = 0;
      [-7, 0, 7].forEach(dx => {
        [-7, 0, 7].forEach(dz => {
          const h = heights[hIdx % heights.length];
          hIdx++;
          const b = addBox(layerGroups.buildings, cx + dx, 0, cz + dz, 5, h, 5, bldgMatRes, true);
          markSelectable(b, zId);
          // Roof cap
          addBox(layerGroups.buildings, cx + dx, h, cz + dz, 5.3, 0.4, 5.3, makeStdMat(0x1a3a5c));
        });
      });
    };
    buildResBlock(-61, -40, 'res-a');
    buildResBlock(17, -40, 'res-b');

    // CBD Towers (-17, -40)
    const cbdTowers = [
      [-9, -5, 28], [0, -5, 40], [9, -5, 24],
      [-9, 5, 34], [0, 5, 48], [9, 5, 26],
    ];
    cbdTowers.forEach(t => {
      const b = addBox(layerGroups.buildings, -17 + t[0], 0, -40 + t[1], 5, t[2], 5, bldgMatCBD, true);
      markSelectable(b, 'cbd');
      // Spire
      addBox(layerGroups.buildings, -17 + t[0], t[2], -40 + t[1], 1.2, 6, 1.2, makeStdMat(COLOR.cyan, { emissive: COLOR.cyan, emissiveIntensity: 0.4 }));
    });

    // 3. Hospital (-61, 0)
    const hosp = addBox(layerGroups.buildings, -61, 0, 0, 14, 9, 14, hospitalMaterial, true);
    markSelectable(hosp, 'hospital');
    // Red Cross
    const crossMat = makeStdMat(COLOR.red, { emissive: COLOR.red, emissiveIntensity: 0.8 });
    const crossV = addBox(layerGroups.buildings, -61, 9.2, 7.1, 1.4, 4.2, 0.2, crossMat);
    const crossH = addBox(layerGroups.buildings, -61, 10.6, 7.1, 4.2, 1.4, 0.2, crossMat);
    markSelectable(crossV, 'hospital');
    markSelectable(crossH, 'hospital');

    // 4. Solar Farms North (-17, 0) and East (17, 0)
    const buildSolar = (cx: number, cz: number, zId: string) => {
      [-5.1, -1.7, 1.7, 5.1].forEach(dx => {
        [-2.5, 2.5].forEach(dz => {
          const x = cx + dx;
          const z = cz + dz;
          addCyl(layerGroups.electricity, x, 0, z, 0.2, 1.6, makeStdMat(0x607d8b));
          const panel = new THREE.Mesh(boxGeo, solarMaterial);
          panel.scale.set(2.8, 0.15, 2.8);
          panel.position.set(x, 1.6, z);
          panel.rotation.x = -0.35;
          panel.castShadow = true;
          panel.receiveShadow = true;
          layerGroups.electricity.add(panel);
          markSelectable(panel, zId);
        });
      });
    };
    buildSolar(-17, 0, 'solar-a');
    buildSolar(17, 0, 'solar-b');

    // 5. Electrical Substation (61, 0)
    const sub = addBox(layerGroups.electricity, 61, 0, 0, 11, 5, 11, substationMaterial, true);
    markSelectable(sub, 'substation');
    // Pylons
    [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(o => {
      addCyl(layerGroups.electricity, 61 + o[0], 5, 0 + o[1], 0.3, 4.5, makeStdMat(COLOR.muted));
    });

    // 6. Eco-Reservoir (-61, 34)
    const shellGeo = new THREE.BoxGeometry(11, 8.5, 11);
    const shellLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(shellGeo),
      new THREE.LineBasicMaterial({ color: COLOR.cyan, transparent: true, opacity: 0.6 })
    );
    shellLine.position.set(-61, 4.25, 34);
    layerGroups.water.add(shellLine);

    const fillMat = makeStdMat(COLOR.cyan, {
      emissive: COLOR.cyan,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.8,
    });
    const reservoirFillMesh = new THREE.Mesh(cylGeo, fillMat);
    reservoirFillMesh.scale.set(9.5, 1, 9.5);
    reservoirFillMesh.position.set(-61, 0.5, 34);
    layerGroups.water.add(reservoirFillMesh);
    markSelectable(reservoirFillMesh, 'reservoir');

    // 7. Wind Farm (-17, 34)
    [-9, 0, 9].forEach(dx => {
      const x = -17 + dx;
      addCyl(layerGroups.electricity, x, 0, 34, 0.45, 12, makeStdMat(0xcfd9e0), true);
      addBox(layerGroups.electricity, x, 12, 34, 2, 1.4, 1.4, makeStdMat(0xcfd9e0));

      const hub = new THREE.Group();
      hub.position.set(x, 12, 34);
      const hubCenter = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), makeStdMat(0xffffff));
      hub.add(hubCenter);

      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(boxGeo, makeStdMat(0xe7f3f8));
        blade.scale.set(0.35, 5.5, 0.6);
        blade.position.set(0, 2.75, 0);
        blade.rotation.z = (b * Math.PI * 2) / 3;
        hub.add(blade);
      }
      layerGroups.electricity.add(hub);
      windBlades.push(hub);
      markSelectable(hub, 'wind');
    });

    // 8. Metro Hub (17, 34) & Viaduct
    const metroStops = [-61, -17, 17, 61];
    for (let i = 0; i < metroStops.length - 1; i++) {
      const midX = (metroStops[i] + metroStops[i + 1]) / 2;
      const len = Math.abs(metroStops[i + 1] - metroStops[i]) - 2;
      const track = addBox(layerGroups.transit, midX, 6.5, 52, len, 0.6, 2.2, transitMaterial);
      markSelectable(track, 'metro');
    }
    metroStops.forEach(x => {
      addCyl(layerGroups.transit, x, 0, 52, 0.4, 6.5, makeStdMat(COLOR.muted));
    });

    const metroStation = addBox(layerGroups.transit, 17, 0, 34, 10, 4.5, 8, makeStdMat(COLOR.building), true);
    markSelectable(metroStation, 'metro');

    // 9. Parks (Central 61, -40 & Riverside 61, 34)
    const buildPark = (cx: number, cz: number, zId: string) => {
      const grass = new THREE.Mesh(new THREE.CircleGeometry(9.5, 24), makeStdMat(0x0e2a21, { roughness: 1 }));
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(cx, 0.04, cz);
      grass.receiveShadow = true;
      layerGroups.buildings.add(grass);
      markSelectable(grass, zId);

      [[0, 0], [4, 2], [-4, 2], [2, -4], [-3, -3]].forEach(o => {
        addCyl(layerGroups.buildings, cx + o[0], 0, cz + o[1], 0.35, 1.8, makeStdMat(COLOR.trunk));
        const fol = new THREE.Mesh(new THREE.SphereGeometry(2.1, 10, 10), makeStdMat(COLOR.leaf, { roughness: 0.8 }));
        fol.position.set(cx + o[0], 3.6, cz + o[1]);
        layerGroups.buildings.add(fol);
      });
    };
    buildPark(61, -40, 'park-a');
    buildPark(61, 34, 'park-b');

    // Flood Overlay
    const floodMat = new THREE.MeshPhongMaterial({
      color: 0x2fa3c9,
      transparent: true,
      opacity: 0.65,
      shininess: 90,
    });
    const floodOverlay = new THREE.Mesh(new THREE.BoxGeometry(180, 2.8, 140), floodMat);
    floodOverlay.position.set(0, 1.4, 0);
    floodOverlay.visible = false;
    scene.add(floodOverlay);

    // Particle Systems: Fire, Heatwave, Rain, Pollution
    const makeParticles = (count: number, color: number, size: number, opacity: number) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 160;
        pos[i * 3 + 1] = Math.random() * 35;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 130;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
      });
      const sys = new THREE.Points(geo, mat);
      sys.visible = false;
      scene.add(sys);
      return sys;
    };

    const fireSystem = makeParticles(150, 0xff4500, 1.2, 0.85);
    const heatwaveSystem = makeParticles(250, 0xff7700, 1.5, 0.45);
    const rainSystem = makeParticles(400, 0x88bbdd, 0.5, 0.6);
    const pollutionSystem = makeParticles(250, 0x777766, 2.5, 0.35);

    // Starfield
    const starCount = 300;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 200 + Math.random() * 80;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.45;
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = 40 + r * Math.cos(ph) * 0.5;
      starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fd8e8, size: 0.7, transparent: true, opacity: 0.7 })));

    // Store state in ref
    threeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      raycaster,
      selectable,
      roadMaterial,
      solarMaterial,
      hospitalMaterial,
      substationMaterial,
      transitMaterial,
      reservoirFillMesh,
      floodOverlay,
      fireSystem,
      heatwaveSystem,
      rainSystem,
      pollutionSystem,
      windBlades,
      buildingMaterials,
      streetLights,
      congestionMeshes,
      vehicleMeshes,
      trafficLights,
      ambientLight,
      sunLight,
      targetCamPos: null,
      targetLookAt: null,
      defaultCamPos,
      defaultTarget,
      layerGroups,
      animId: 0,
    };

    // Click handler for raycasting
    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.intersectObjects(selectable, true);

      if (intersects.length > 0) {
        let cur: THREE.Object3D | null = intersects[0].object;
        while (cur && !cur.userData.zoneId) {
          cur = cur.parent;
        }
        if (cur && cur.userData.zoneId) {
          setSelectedZoneId(cur.userData.zoneId);
        }
      }
    };

    renderer.domElement.addEventListener('click', handlePointerDown);

    // Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      controls.update();

      // Rotate wind turbines
      windBlades.forEach(w => {
        w.rotation.y += dt * 1.5;
      });

      // Animate Vehicles
      vehicleMeshes.forEach(v => {
        const move = v.speed * dt * v.direction;
        if (v.roadAxis === 'z') {
          v.mesh.position.z += move;
          if (v.direction > 0 && v.mesh.position.z > v.maxPos) {
            v.mesh.position.z = v.minPos;
          } else if (v.direction < 0 && v.mesh.position.z < v.minPos) {
            v.mesh.position.z = v.maxPos;
          }
        }
      });

      // Animate Camera Preset Lerping
      const stateRef = threeRef.current;
      if (stateRef?.targetCamPos && stateRef?.targetLookAt) {
        camera.position.lerp(stateRef.targetCamPos, 0.05);
        controls.target.lerp(stateRef.targetLookAt, 0.05);
        if (camera.position.distanceTo(stateRef.targetCamPos) < 0.6) {
          stateRef.targetCamPos = null;
          stateRef.targetLookAt = null;
        }
      }

      // Render
      renderer.render(scene, camera);
      threeRef.current!.animId = requestAnimationFrame(animate);
    };

    threeRef.current.animId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handlePointerDown);
      if (threeRef.current?.animId) {
        cancelAnimationFrame(threeRef.current.animId);
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Dynamic Scene Elements when simulation state changes
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;

    const m = state.metrics;
    const tStat = trafficStatus(m.traffic);
    const rStat = renewableStatus(m.renewable);
    const mStat = marginStatus(m.supply, m.demand);

    // Road color
    t.roadMaterial.color.set(STATUS_COLOR[tStat]);
    t.transitMaterial.color.set(STATUS_COLOR[tStat]);

    // Show congestion markers if traffic is critical
    t.congestionMeshes.forEach(mesh => {
      mesh.visible = tStat === 'critical';
    });

    // Solar panels
    t.solarMaterial.color.set(STATUS_COLOR[rStat]);
    t.solarMaterial.emissive.set(STATUS_COLOR[rStat]);
    t.solarMaterial.emissiveIntensity = rStat === 'good' ? 0.6 : rStat === 'moderate' ? 0.35 : 0.15;

    // Eco-Reservoir Fill Height
    const fillH = (clamp(m.water, 2, 100) / 100) * 7.5 + 0.3;
    t.reservoirFillMesh.scale.y = fillH;
    t.reservoirFillMesh.position.y = fillH / 2;

    // Hospital Alert Cross
    const hospAlert = state.hospitalLoad > 70 || !!state.activeEmergency;
    t.hospitalMaterial.color.set(hospAlert ? STATUS_COLOR.critical : COLOR.textPrim);
    t.hospitalMaterial.emissive.set(hospAlert ? STATUS_COLOR.critical : 0x332020);
    t.hospitalMaterial.emissiveIntensity = hospAlert ? 0.6 : 0.15;

    // Substation Alert
    const subAlert = mStat === 'critical' || state.activeEmergency?.id === 'power';
    t.substationMaterial.color.set(STATUS_COLOR[mStat]);
    t.substationMaterial.emissive.set(STATUS_COLOR[mStat]);
    t.substationMaterial.emissiveIntensity = subAlert ? 0.6 : 0.4;

    // Emergency Systems
    const emId = state.activeEmergency?.id;
    t.floodOverlay.visible = emId === 'flood';
    t.rainSystem.visible = emId === 'flood';
    t.fireSystem.visible = emId === 'heatwave';
    t.heatwaveSystem.visible = emId === 'heatwave';
    t.pollutionSystem.visible = m.aqi > 150;

    // Day / Night Cycle
    const hours = state.timeOfDay;
    const isNight = hours < 6 || hours > 18;
    const sunAngle = ((hours - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(sunAngle);
    const sunProg = Math.max(0, Math.min(1, sunHeight));

    if (!isNight) {
      t.sunLight.intensity = 0.3 + sunProg * 0.75;
      t.sunLight.position.set(70 * Math.cos(sunAngle), 95 * Math.max(0.1, sunHeight), 50);
      t.ambientLight.intensity = 0.45 + sunProg * 0.25;
      t.scene.background = new THREE.Color(COLOR.bg);
      t.scene.fog!.color.set(COLOR.bg);
    } else {
      t.sunLight.intensity = 0.05;
      t.sunLight.position.set(70, -20, 50);
      t.ambientLight.intensity = 0.18;
      t.scene.background = new THREE.Color(0x020408);
      t.scene.fog!.color.set(0x020408);
    }

    // Windows Emissive
    t.buildingMaterials.forEach(bMat => {
      bMat.emissiveIntensity = isNight ? bMat.userData.nightEmissive : bMat.userData.baseEmissive;
    });

    // Streetlights
    t.streetLights.forEach(bulb => {
      bulb.material = isNight ? bulb.userData.bulbOn : bulb.userData.bulbOff;
    });
  }, [state]);

  // Update Layer Visibility
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    (Object.keys(layers) as (keyof LayerVisibility)[]).forEach(k => {
      if (t.layerGroups[k]) {
        t.layerGroups[k].visible = layers[k];
      }
    });
  }, [layers]);

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleCameraPreset = (name: CameraPreset) => {
    setActiveCamPreset(name);
    const t = threeRef.current;
    if (!t) return;
    const preset = presets[name];
    t.targetCamPos = new THREE.Vector3(...preset.pos);
    t.targetLookAt = new THREE.Vector3(...preset.target);
  };

  const handleResetCamera = () => {
    const t = threeRef.current;
    if (!t) return;
    t.targetCamPos = null;
    t.targetLookAt = null;
    t.camera.position.copy(t.defaultCamPos);
    t.controls.target.copy(t.defaultTarget);
    t.controls.update();
    setActiveCamPreset('overview');
  };

  const activeZoneInfo = ZONE_DETAILS_MAP[selectedZoneId] || ZONE_DETAILS_MAP['cbd'];

  // Calculate dynamic zone telemetry
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
      case 'wind':
        return [
          { label: 'Renewable Baseloader', value: `${roundVal(m.renewable)}%`, status: renewableStatus(m.renewable) },
          { label: 'Turbine Rotor Speed', value: '18.4 RPM', status: 'good' },
          { label: 'Grid Feed Margin', value: `${roundVal(m.supply)}%`, status: marginStatus(m.supply, m.demand) },
        ];
      case 'metro':
        return [
          { label: 'Traffic Reliever Benefit', value: '-35 km/h gain', status: 'good' },
          { label: 'Mobility Grid Congestion', value: `${roundVal(m.traffic)}%`, status: trafficStatus(m.traffic) },
          { label: 'Zero-Emission Metric', value: '100% Electric', status: 'good' },
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

            {/* Infrastructure Layer Toggles */}
            <div className="layer-toggles">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: '0.2rem' }}>
                LAYERS:
              </span>
              {(['roads', 'electricity', 'water', 'transit', 'buildings'] as (keyof LayerVisibility)[]).map(l => (
                <button
                  key={l}
                  className={`layer-toggle ${layers[l] ? 'active' : ''}`}
                  onClick={() => toggleLayer(l)}
                  type="button"
                >
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
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
