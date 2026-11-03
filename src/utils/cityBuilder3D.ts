import * as THREE from 'three';
import {
  createRoadTexture,
  createSidewalkTexture,
  createBuildingFacadeTexture,
  createSolarGridTexture,
  createHelipadTexture,
  createNeonSignTexture,
} from './proceduralTextures';
import { CrisisInstance, ProtocolType } from '../types/game';

export interface SectorStation {
  id: string;
  name: string;
  sector: ProtocolType | 'emergency';
  coords: [number, number, number];
  terminalCoords: [number, number, number];
  promptLabel: string;
  description: string;
  solved: boolean;
  beaconColor: number;
}

export interface City3DScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  ambientLight: THREE.AmbientLight;
  sunLight: THREE.DirectionalLight;
  selectableObjects: THREE.Object3D[];
  collisionBoxes: THREE.Box3[];
  sectorStations: SectorStation[];
  setSectorSolved: (stationId: string, solved: boolean) => void;
  update: (delta: number, state?: { timeOfDay?: number; stability?: number }) => void;
  triggerProtocolVisual: (type: ProtocolType) => void;
  spawnCrisisVisual: (crisis: CrisisInstance) => void;
  removeCrisisVisual: (crisisId: string) => void;
  dispose: () => void;
}

export function buildProceduralCity(
  container: HTMLElement,
  options: {
    interactiveRaycasting?: boolean;
    onSelectZone?: (zoneId: string) => void;
    enableShadows?: boolean;
  } = {}
): City3DScene {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b13);
  scene.fog = new THREE.FogExp2(0x060b13, 0.0035);

  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1200);
  camera.position.set(0, 95, 130);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (options.enableShadows !== false) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const selectableObjects: THREE.Object3D[] = [];
  const collisionBoxes: THREE.Box3[] = [];
  const animatedVehicles: {
    mesh: THREE.Group;
    axis: 'x' | 'z';
    coord: number;
    min: number;
    max: number;
    speed: number;
    direction: number;
  }[] = [];

  const windTurbineBlades: THREE.Group[] = [];
  const crisisVisuals: Map<string, THREE.Group> = new Map();
  const protocolPulseMeshes: THREE.Mesh[] = [];
  const streetLightBulbs: { mesh: THREE.Mesh; onMat: THREE.Material; offMat: THREE.Material }[] = [];
  const buildingMaterials: THREE.MeshStandardMaterial[] = [];

  // Shared Geometries
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xe8f4fc, 1.25);
  sunLight.position.set(80, 110, 60);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 350;
  sunLight.shadow.camera.left = -110;
  sunLight.shadow.camera.right = 110;
  sunLight.shadow.camera.top = 110;
  sunLight.shadow.camera.bottom = -110;
  scene.add(sunLight);

  // Ground plane
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0a1420,
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Procedural Textures
  const roadTex = createRoadTexture(2, true);
  roadTex.repeat.set(1, 6);
  const sidewalkTex = createSidewalkTexture();
  const cbdFacadeTex = createBuildingFacadeTexture('cyber-cyan', 0.75);
  cbdFacadeTex.repeat.set(1, 2);
  const corpFacadeTex = createBuildingFacadeTexture('corporate-blue', 0.6);
  const resFacadeTex = createBuildingFacadeTexture('residential', 0.5);
  const solarTex = createSolarGridTexture();
  const helipadTex = createHelipadTexture();

  // Helper add mesh with collision tracking
  const createBox = (
    grp: THREE.Group | THREE.Scene,
    x: number, y: number, z: number,
    w: number, h: number, d: number,
    mat: THREE.Material,
    castShadow = true,
    zoneId?: string,
    isSolid = true
  ) => {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    if (zoneId) {
      mesh.userData.zoneId = zoneId;
      selectableObjects.push(mesh);
    }
    grp.add(mesh);
    if (isSolid && h >= 1.5 && (w >= 1.8 || d >= 1.8)) {
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + h / 2, z),
        new THREE.Vector3(w, h, d)
      );
      collisionBoxes.push(box);
    }
    return mesh;
  };

  const createCyl = (
    grp: THREE.Group | THREE.Scene,
    x: number, y: number, z: number,
    rad: number, h: number,
    mat: THREE.Material,
    castShadow = true,
    zoneId?: string,
    isSolid = false
  ) => {
    const mesh = new THREE.Mesh(cylGeo, mat);
    mesh.scale.set(rad * 2, h, rad * 2);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    if (zoneId) {
      mesh.userData.zoneId = zoneId;
      selectableObjects.push(mesh);
    }
    grp.add(mesh);
    if (isSolid && h >= 1.5 && rad >= 1) {
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + h / 2, z),
        new THREE.Vector3(rad * 2, h, rad * 2)
      );
      collisionBoxes.push(box);
    }
    return mesh;
  };

  // 1. ROADS AND SIDEWALKS
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.65,
    metalness: 0.2,
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.85,
    metalness: 0.1,
  });

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x3d4b5c,
    roughness: 0.7,
  });

  // Vertical roads (x = -40, 0, 40)
  [-45, 0, 45].forEach(x => {
    const road = createBox(scene, x, 0.05, 0, 9, 0.1, 180, roadMat, false, 'roads');
    // Curbs & Sidewalks
    createBox(scene, x - 5.5, 0.1, 0, 2, 0.2, 180, sidewalkMat, false);
    createBox(scene, x + 5.5, 0.1, 0, 2, 0.2, 180, sidewalkMat, false);
    createBox(scene, x - 4.6, 0.15, 0, 0.3, 0.25, 180, curbMat, false);
    createBox(scene, x + 4.6, 0.15, 0, 0.3, 0.25, 180, curbMat, false);
  });

  // Horizontal roads (z = -30, 30)
  [-30, 30].forEach(z => {
    const road = createBox(scene, 0, 0.06, z, 220, 0.1, 9, roadMat, false, 'roads');
    road.rotation.y = Math.PI / 2;
    createBox(scene, 0, 0.1, z - 5.5, 220, 0.2, 2, sidewalkMat, false);
    createBox(scene, 0, 0.1, z + 5.5, 220, 0.2, 2, sidewalkMat, false);
  });

  // Streetlights
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.8, roughness: 0.3 });
  const bulbOnMat = new THREE.MeshStandardMaterial({ color: 0xffe680, emissive: 0xffcc33, emissiveIntensity: 1.2 });
  const bulbOffMat = new THREE.MeshStandardMaterial({ color: 0x2d3748 });

  [-45, 0, 45].forEach(x => {
    for (let z = -75; z <= 75; z += 30) {
      // Light pole
      createCyl(scene, x + 6.2, 0, z, 0.18, 5.5, poleMat, true);
      createBox(scene, x + 5.2, 5.4, z, 2.2, 0.15, 0.15, poleMat, true);
      const bulb = createBox(scene, x + 4.3, 5.15, z, 0.45, 0.25, 0.35, bulbOnMat, false);
      streetLightBulbs.push({ mesh: bulb, onMat: bulbOnMat, offMat: bulbOffMat });
    }
  });

  // 2. CENTRAL BUSINESS DISTRICT (CBD) - High-detail skyscrapers
  const buildSkyscraper = (
    cx: number, cz: number,
    baseW: number, baseD: number, totalH: number,
    facadeMat: THREE.Material,
    zoneId: string,
    hasSpire = true,
    hasNeon = true
  ) => {
    const bldgGrp = new THREE.Group();
    bldgGrp.userData.zoneId = zoneId;

    // Podium level
    const podH = Math.min(10, totalH * 0.2);
    createBox(bldgGrp, cx, 0, cz, baseW + 2, podH, baseD + 2, sidewalkMat, true, zoneId);

    // Main tower body with stepped setback
    const towerH = totalH - podH - (hasSpire ? 8 : 2);
    const mainBody = createBox(bldgGrp, cx, podH, cz, baseW, towerH, baseD, facadeMat, true, zoneId);

    // Stepped upper crown
    const crownH = hasSpire ? 6 : 3;
    createBox(bldgGrp, cx, podH + towerH, cz, baseW * 0.75, crownH, baseD * 0.75, facadeMat, true, zoneId);

    if (hasSpire) {
      // Radio antenna / spire
      createCyl(bldgGrp, cx, podH + towerH + crownH, cz, 0.25, 8, poleMat, true, zoneId);
      // Beacon red light
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff1111, emissiveIntensity: 1.5 });
      createBox(bldgGrp, cx, podH + towerH + crownH + 8, cz, 0.5, 0.5, 0.5, beaconMat, false);
    }

    if (hasNeon) {
      const neonTex = createNeonSignTexture('NEXUS AI', '#28d9ec');
      const neonMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true });
      const sign = new THREE.Mesh(boxGeo, neonMat);
      sign.scale.set(baseW * 0.8, 2.2, 0.2);
      sign.position.set(cx, podH + 6, cz + baseD / 2 + 0.15);
      bldgGrp.add(sign);
    }

    scene.add(bldgGrp);
    return bldgGrp;
  };

  const cbdMat1 = new THREE.MeshStandardMaterial({
    map: cbdFacadeTex,
    emissive: 0x071e2e,
    emissiveIntensity: 0.6,
    metalness: 0.45,
    roughness: 0.35,
  });
  buildingMaterials.push(cbdMat1);

  const cbdMat2 = new THREE.MeshStandardMaterial({
    map: corpFacadeTex,
    emissive: 0x092338,
    emissiveIntensity: 0.55,
    metalness: 0.5,
    roughness: 0.3,
  });
  buildingMaterials.push(cbdMat2);

  // CBD Cluster (-22, -60)
  buildSkyscraper(-25, -60, 9, 9, 44, cbdMat1, 'cbd', true, true);
  buildSkyscraper(-14, -58, 8, 8, 38, cbdMat2, 'cbd', true, false);
  buildSkyscraper(-25, -72, 8, 8, 32, cbdMat2, 'cbd', false, true);
  buildSkyscraper(-14, -72, 7, 7, 28, cbdMat1, 'cbd', true, false);

  // 3. RESIDENTIAL ARCOLOGIES (x = 22, z = -60)
  const resMat = new THREE.MeshStandardMaterial({
    map: resFacadeTex,
    emissive: 0x14202c,
    emissiveIntensity: 0.45,
    metalness: 0.25,
    roughness: 0.6,
  });
  buildingMaterials.push(resMat);

  const buildArcology = (cx: number, cz: number, zId: string) => {
    const heights = [18, 24, 16, 22];
    [-6, 6].forEach((dx, i) => {
      [-6, 6].forEach((dz, j) => {
        const h = heights[(i * 2 + j) % heights.length];
        const b = createBox(scene, cx + dx, 0, cz + dz, 8, h, 8, resMat, true, zId);
        // Roof garden canopy
        createBox(scene, cx + dx, h, cz + dz, 8.4, 0.8, 8.4, curbMat, true, zId);
        // Small rooftop foliage
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
        createCyl(scene, cx + dx, h + 0.8, cz + dz, 1.8, 1.5, leafMat, true);
      });
    });
  };
  buildArcology(24, -60, 'res-a');
  buildArcology(68, -60, 'res-b');

  // 4. METROPOLITAN HOSPITAL (x = -68, z = 0)
  const hospMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.2 });
  const hospCrossMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.2 });
  const helipadMat = new THREE.MeshStandardMaterial({ map: helipadTex, roughness: 0.5 });

  const hospGrp = new THREE.Group();
  hospGrp.userData.zoneId = 'hospital';
  // Central Wing
  createBox(hospGrp, -68, 0, 0, 16, 12, 16, hospMat, true, 'hospital');
  // East-West Cross Wings
  createBox(hospGrp, -68, 0, 0, 24, 8, 10, hospMat, true, 'hospital');
  createBox(hospGrp, -68, 0, 0, 10, 8, 24, hospMat, true, 'hospital');
  // Emergency Helipad on Roof
  const helipadMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), helipadMat);
  helipadMesh.rotation.x = -Math.PI / 2;
  helipadMesh.position.set(-68, 12.05, 0);
  helipadMesh.receiveShadow = true;
  hospGrp.add(helipadMesh);

  // Red Cross on facade
  createBox(hospGrp, -68, 8.5, 8.1, 1.4, 4.2, 0.2, hospCrossMat, false, 'hospital');
  createBox(hospGrp, -68, 9.9, 8.1, 4.2, 1.4, 0.2, hospCrossMat, false, 'hospital');
  scene.add(hospGrp);

  // 5. SOLID-STATE ENERGY SUBSTATION (x = 68, z = 0)
  const subMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.6 });

  const subGrp = new THREE.Group();
  subGrp.userData.zoneId = 'substation';
  createBox(subGrp, 68, 0, 0, 16, 6, 16, subMat, true, 'substation');
  // Transformer coils
  [-5, 5].forEach(dx => {
    [-5, 5].forEach(dz => {
      createCyl(subGrp, 68 + dx, 6, dz, 1.4, 3.5, coilMat, true, 'substation');
      createCyl(subGrp, 68 + dx, 9.5, dz, 0.3, 3, poleMat, true);
    });
  });
  // High-voltage pylon
  createCyl(subGrp, 68, 6, 0, 0.5, 7, poleMat, true);
  scene.add(subGrp);

  // 6. SOLAR PHOTOVOLTAIC FARMS & WIND TURBINES (x = -22, z = 0)
  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.4,
    metalness: 0.8,
    roughness: 0.25,
  });

  const solarGrp = new THREE.Group();
  solarGrp.userData.zoneId = 'solar-a';
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const px = -22 + c * 5;
      const pz = r * 5;
      createCyl(solarGrp, px, 0, pz, 0.25, 2.2, poleMat, true);
      const panel = new THREE.Mesh(boxGeo, solarMat);
      panel.scale.set(3.8, 0.15, 3.8);
      panel.position.set(px, 2.2, pz);
      panel.rotation.x = -0.38;
      panel.castShadow = true;
      solarGrp.add(panel);
    }
  }
  scene.add(solarGrp);

  // Wind Turbines (x = 22, z = 0)
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  [-8, 8].forEach(dx => {
    const tx = 22 + dx;
    createCyl(scene, tx, 0, 0, 0.6, 18, poleMat, true, 'wind');
    createBox(scene, tx, 18, 0, 3, 1.8, 2, poleMat, true);

    const hub = new THREE.Group();
    hub.position.set(tx, 18, 1);
    const centerCap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), bladeMat);
    hub.add(centerCap);

    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(boxGeo, bladeMat);
      blade.scale.set(0.4, 8, 0.8);
      blade.position.set(0, 4, 0);
      blade.rotation.z = (b * Math.PI * 2) / 3;
      hub.add(blade);
    }
    scene.add(hub);
    windTurbineBlades.push(hub);
  });

  // 7. YAMUNA ECO-RESERVOIR & SPONGE HYDROLOGY (x = -68, z = 60)
  const reserGrp = new THREE.Group();
  reserGrp.userData.zoneId = 'reservoir';
  const basinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  // Outer concrete retaining wall
  createBox(reserGrp, -68, 0, 60, 22, 5, 22, basinMat, true, 'reservoir');

  // Interior water basin
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.45,
    roughness: 0.15,
    metalness: 0.85,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(boxGeo, waterMat);
  waterMesh.scale.set(19, 4, 19);
  waterMesh.position.set(-68, 2, 60);
  reserGrp.add(waterMesh);
  scene.add(reserGrp);

  // 8. AUTONOMOUS TRANSIT CORRIDOR & METRO (Elevated Track z = 48)
  const transitMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.3,
  });

  for (let x = -100; x <= 100; x += 30) {
    createCyl(scene, x, 0, 48, 0.7, 9, poleMat, true);
    createBox(scene, x, 9, 48, 30, 0.8, 3.2, transitMat, true, 'metro');
  }

  // Animated Maglev Train Pod
  const trainGrp = new THREE.Group();
  const trainMat = new THREE.MeshStandardMaterial({ color: 0x28d9ec, emissive: 0x28d9ec, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.2 });
  const trainBody = new THREE.Mesh(boxGeo, trainMat);
  trainBody.scale.set(18, 2.2, 2.4);
  trainBody.position.set(0, 10.4, 48);
  trainGrp.add(trainBody);
  scene.add(trainGrp);

  // 9. ECOLOGICAL PARK & VEGETATION (x = 68, z = 60)
  const parkGrass = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }));
  parkGrass.rotation.x = -Math.PI / 2;
  parkGrass.position.set(68, 0.08, 60);
  parkGrass.receiveShadow = true;
  parkGrass.userData.zoneId = 'park-a';
  selectableObjects.push(parkGrass);
  scene.add(parkGrass);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });

  const treeCoords = [
    [-6, -6], [0, -6], [6, -6],
    [-6, 0], [6, 0],
    [-6, 6], [0, 6], [6, 6],
  ];
  treeCoords.forEach(([dx, dz]) => {
    createCyl(scene, 68 + dx, 0, 60 + dz, 0.3, 2.5, trunkMat, true);
    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2), leavesMat);
    foliage.position.set(68 + dx, 3.8, 60 + dz);
    foliage.castShadow = true;
    scene.add(foliage);
  });

  // 10. ANIMATED MULTI-LANE VEHICLES
  const vehicleColors = [0x28d9ec, 0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981, 0xffffff];
  [-45, 0, 45].forEach((x, idx) => {
    for (let i = 0; i < 4; i++) {
      const vGrp = new THREE.Group();
      const col = vehicleColors[(idx * 4 + i) % vehicleColors.length];
      const carMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.8, roughness: 0.3 });

      const body = new THREE.Mesh(boxGeo, carMat);
      body.scale.set(1.9, 0.9, 3.8);
      body.position.y = 0.55;
      body.castShadow = true;
      vGrp.add(body);

      // Cabin roof
      const cabMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
      const cab = new THREE.Mesh(boxGeo, cabMat);
      cab.scale.set(1.6, 0.7, 2.2);
      cab.position.set(0, 1.25, -0.2);
      vGrp.add(cab);

      // Headlights
      const hLight = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hLight.scale.set(1.4, 0.25, 0.1);
      hLight.position.set(0, 0.55, 1.95);
      vGrp.add(hLight);

      // Taillights
      const tLight = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      tLight.scale.set(1.4, 0.25, 0.1);
      tLight.position.set(0, 0.55, -1.95);
      vGrp.add(tLight);

      const laneOffset = i % 2 === 0 ? 2.2 : -2.2;
      const initialZ = -70 + i * 40;
      vGrp.position.set(x + laneOffset, 0, initialZ);
      scene.add(vGrp);

      animatedVehicles.push({
        mesh: vGrp,
        axis: 'z',
        coord: x + laneOffset,
        min: -85,
        max: 85,
        speed: 18 + Math.random() * 12,
        direction: i % 2 === 0 ? 1 : -1,
      });
    }
  });

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 240 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = 45 + r * Math.cos(phi) * 0.5;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xa5f3fc, size: 0.8, transparent: true, opacity: 0.75 })
  );
  scene.add(stars);

  // 11. PHYSICAL INTERACTIVE SECTOR TERMINALS & WAYPOINTS
  const sectorStations: SectorStation[] = [
    {
      id: 'substation',
      name: 'Clean Grid Substation 01',
      sector: 'energy',
      coords: [68, 0, 0],
      terminalCoords: [56, 0, 0],
      promptLabel: 'ACCESS SUBSTATION CONDUIT MATRIX',
      description: 'Solid-state high-voltage transformer hub and BESS storage matrix.',
      solved: false,
      beaconColor: 0x38bdf8,
    },
    {
      id: 'reservoir',
      name: 'Yamuna Sponge Aquifer',
      sector: 'water',
      coords: [-68, 0, 60],
      terminalCoords: [-54, 0, 60],
      promptLabel: 'CONFIGURE HYDRAULIC SLUICE VALVES',
      description: 'Subterranean closed-loop stormwater filtration and retention aquifers.',
      solved: false,
      beaconColor: 0x06b6d4,
    },
    {
      id: 'traffic',
      name: 'CBD Traffic Intelligence Hub',
      sector: 'traffic',
      coords: [0, 0, -30],
      terminalCoords: [0, 0, -20],
      promptLabel: 'OVERRIDE TRAFFIC SIGNAL MATRIX',
      description: 'Autonomous arterial signal control and adaptive green-wave corridor.',
      solved: false,
      beaconColor: 0x22c55e,
    },
    {
      id: 'environment',
      name: 'Bio-Resonance Clean Air Hub',
      sector: 'environment',
      coords: [68, 0, 60],
      terminalCoords: [56, 0, 52],
      promptLabel: 'CALIBRATE BIO-RESONANCE SMOG SCRUBBER',
      description: 'Harmonic frequency particulate scrubbers maintaining zero PM2.5 corridors.',
      solved: false,
      beaconColor: 0x10b981,
    },
    {
      id: 'emergency',
      name: 'Apex Trauma Hospital Microgrid',
      sector: 'emergency',
      coords: [-68, 0, 0],
      terminalCoords: [-56, 0, 0],
      promptLabel: 'ENGAGE TRAUMA ICU BACKUP POWER',
      description: 'Critical municipal emergency life-support and disaster triage center.',
      solved: false,
      beaconColor: 0xef4444,
    },
    {
      id: 'core',
      name: 'Central Arcology Nexus Core',
      sector: 'emergency',
      coords: [0, 0, 0],
      terminalCoords: [0, 0, 6],
      promptLabel: 'HARMONIZE METROPOLITAN MATRIX',
      description: 'Autonomous metropolitan intelligence brain governing all 5 municipal sectors.',
      solved: false,
      beaconColor: 0xa855f7,
    },
  ];

  const stationTerminals: Map<string, {
    group: THREE.Group;
    beaconRing: THREE.Mesh;
    holoScreen: THREE.Mesh;
    beaconLight: THREE.PointLight;
    hologramIcon: THREE.Mesh;
  }> = new Map();

  const terminalKioskMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.3,
  });

  sectorStations.forEach(st => {
    const tGrp = new THREE.Group();
    const [tx, ty, tz] = st.terminalCoords;
    tGrp.position.set(tx, ty, tz);

    // Pedestal base
    const base = new THREE.Mesh(boxGeo, terminalKioskMat);
    base.scale.set(1.4, 1.1, 0.9);
    base.position.set(0, 0.55, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    tGrp.add(base);

    // Glowing trim edge
    const trimMat = new THREE.MeshBasicMaterial({ color: st.beaconColor });
    const trim = new THREE.Mesh(boxGeo, trimMat);
    trim.scale.set(1.45, 0.08, 0.95);
    trim.position.set(0, 1.05, 0);
    tGrp.add(trim);

    // Holographic interactive screen
    const screenMat = new THREE.MeshBasicMaterial({
      color: st.beaconColor,
      transparent: true,
      opacity: 0.88,
    });
    const holoScreen = new THREE.Mesh(boxGeo, screenMat);
    holoScreen.scale.set(1.1, 0.7, 0.06);
    holoScreen.position.set(0, 1.45, 0.1);
    holoScreen.rotation.x = -Math.PI / 6;
    tGrp.add(holoScreen);

    // Ground beacon light ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: st.beaconColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const beaconRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.0, 32), ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(0, 0.04, 0);
    tGrp.add(beaconRing);

    // Floating rotating hologram marker above terminal
    const iconMat = new THREE.MeshBasicMaterial({
      color: st.beaconColor,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const hologramIcon = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), iconMat);
    hologramIcon.position.set(0, 2.4, 0);
    tGrp.add(hologramIcon);

    // Beacon point light
    const beaconLight = new THREE.PointLight(st.beaconColor, 0.8, 12);
    beaconLight.position.set(0, 2.0, 0);
    tGrp.add(beaconLight);

    scene.add(tGrp);
    stationTerminals.set(st.id, { group: tGrp, beaconRing, holoScreen, beaconLight, hologramIcon });

    // Add collision for terminal pedestal
    collisionBoxes.push(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(tx, ty + 0.6, tz),
        new THREE.Vector3(1.6, 1.4, 1.1)
      )
    );
  });

  const setSectorSolved = (stationId: string, solved: boolean) => {
    const station = sectorStations.find(s => s.id === stationId);
    if (station) {
      station.solved = solved;
    }
    const term = stationTerminals.get(stationId);
    if (term) {
      const activeColor = solved ? 0x34d399 : (station?.beaconColor || 0x38bdf8);
      (term.beaconRing.material as THREE.MeshBasicMaterial).color.set(activeColor);
      (term.holoScreen.material as THREE.MeshBasicMaterial).color.set(activeColor);
      (term.hologramIcon.material as THREE.MeshBasicMaterial).color.set(activeColor);
      term.beaconLight.color.set(activeColor);
      term.beaconLight.intensity = solved ? 1.5 : 0.8;
    }
  };

  // Click Handler for raycasting
  if (options.interactiveRaycasting && options.onSelectZone) {
    const raycaster = new THREE.Raycaster();
    const handlePointer = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(selectableObjects, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.zoneId) {
          obj = obj.parent;
        }
        if (obj && obj.userData.zoneId) {
          options.onSelectZone!(obj.userData.zoneId);
        }
      }
    };
    renderer.domElement.addEventListener('click', handlePointer);
  }

  // Animation Update
  let trainX = -100;
  const update = (delta: number, state?: { timeOfDay?: number; stability?: number }) => {
    // Spin wind turbine blades
    windTurbineBlades.forEach(hub => {
      hub.rotation.z += delta * 1.8;
    });

    // Move Maglev Train
    trainX += delta * 28;
    if (trainX > 100) trainX = -100;
    trainGrp.position.x = trainX;

    // Move traffic vehicles
    animatedVehicles.forEach(v => {
      v.mesh.position.z += v.speed * delta * v.direction;
      if (v.direction > 0 && v.mesh.position.z > v.max) {
        v.mesh.position.z = v.min;
      } else if (v.direction < 0 && v.mesh.position.z < v.min) {
        v.mesh.position.z = v.max;
      }
    });

    // Update Crisis Visual Particle Oscillations
    crisisVisuals.forEach(grp => {
      grp.children.forEach((child, idx) => {
        if (child instanceof THREE.Mesh) {
          child.rotation.y += delta * 2;
          child.scale.setScalar(1 + Math.sin(Date.now() * 0.008 + idx) * 0.15);
        }
      });
    });

    // Update Protocol Pulses
    for (let i = protocolPulseMeshes.length - 1; i >= 0; i--) {
      const pMesh = protocolPulseMeshes[i];
      pMesh.scale.addScalar(delta * 25);
      const mat = pMesh.material as THREE.MeshBasicMaterial;
      mat.opacity -= delta * 0.8;
      if (mat.opacity <= 0.01) {
        scene.remove(pMesh);
        pMesh.geometry.dispose();
        mat.dispose();
        protocolPulseMeshes.splice(i, 1);
      }
    }

    // Day/Night Cycle Handling
    if (state && typeof state.timeOfDay === 'number') {
      const time = state.timeOfDay;
      const isNight = time < 6 || time > 18;
      const sunAngle = ((time - 6) / 12) * Math.PI;
      const sunHeight = Math.sin(sunAngle);
      const sunProg = Math.max(0, Math.min(1, sunHeight));

      if (!isNight) {
        sunLight.intensity = 0.35 + sunProg * 0.9;
        sunLight.position.set(80 * Math.cos(sunAngle), 110 * Math.max(0.1, sunHeight), 60);
        ambientLight.intensity = 0.45 + sunProg * 0.3;
        scene.background = new THREE.Color(0x060b13);
        scene.fog!.color.set(0x060b13);
      } else {
        sunLight.intensity = 0.08;
        sunLight.position.set(80, -30, 60);
        ambientLight.intensity = 0.2;
        scene.background = new THREE.Color(0x020408);
        scene.fog!.color.set(0x020408);
      }

      // Streetlights toggle
      streetLightBulbs.forEach(b => {
        b.mesh.material = isNight ? b.onMat : b.offMat;
      });

      // Building windows emissive
      buildingMaterials.forEach(bMat => {
        bMat.emissiveIntensity = isNight ? 0.85 : 0.45;
      });
    }
    // Animate Sector Terminals
    stationTerminals.forEach((term, id) => {
      term.hologramIcon.rotation.y += delta * 1.6;
      term.hologramIcon.rotation.x += delta * 0.9;
      const station = sectorStations.find(s => s.id === id);
      const isSolved = !!station?.solved;
      term.hologramIcon.position.y = 2.4 + Math.sin(Date.now() * 0.003) * 0.15;
      const ringScale = 1 + Math.sin(Date.now() * 0.004) * (isSolved ? 0.04 : 0.08);
      term.beaconRing.scale.set(ringScale, ringScale, 1);
    });
  };

  // Trigger Visual Protocol Animation
  const triggerProtocolVisual = (type: ProtocolType) => {
    const pulseColors: Record<ProtocolType, number> = {
      energy: 0x38bdf8,
      water: 0x06b6d4,
      traffic: 0x22c55e,
      environment: 0x10b981,
      emergency: 0xef4444,
    };

    const color = pulseColors[type] || 0x28d9ec;
    const ringGeo = new THREE.RingGeometry(2, 4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const pulseMesh = new THREE.Mesh(ringGeo, ringMat);
    pulseMesh.rotation.x = -Math.PI / 2;
    pulseMesh.position.set(0, 0.4, 0);
    scene.add(pulseMesh);
    protocolPulseMeshes.push(pulseMesh);
  };

  // Spawn 3D Crisis Visual Marker
  const spawnCrisisVisual = (crisis: CrisisInstance) => {
    if (crisisVisuals.has(crisis.id)) return;

    const grp = new THREE.Group();
    const [x, , z] = crisis.coords;
    grp.position.set(x, 0.5, z);

    // Glowing alert ring
    const alertMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.5, 24), alertMat);
    ring.rotation.x = -Math.PI / 2;
    grp.add(ring);

    // Holographic beacon cylinder
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 18, 16, 1, true), beaconMat);
    beacon.position.y = 9;
    grp.add(beacon);

    scene.add(grp);
    crisisVisuals.set(crisis.id, grp);
  };

  const removeCrisisVisual = (crisisId: string) => {
    const grp = crisisVisuals.get(crisisId);
    if (grp) {
      scene.remove(grp);
      crisisVisuals.delete(crisisId);
    }
  };

  const dispose = () => {
    renderer.dispose();
    if (container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    scene,
    camera,
    renderer,
    ambientLight,
    sunLight,
    selectableObjects,
    collisionBoxes,
    sectorStations,
    setSectorSolved,
    update,
    triggerProtocolVisual,
    spawnCrisisVisual,
    removeCrisisVisual,
    dispose,
  };
}
