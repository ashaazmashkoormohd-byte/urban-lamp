/* =============================================================================
   NEXUS 2040 — city3d.js
   A self-contained Three.js renderer for the Nexus City 3D map.

   DESIGN NOTE: this file knows nothing about the decision engine, the
   optimizer, or metric thresholds. It only knows how to draw a city and
   recolor/resize a handful of meshes based on a small plain-object
   "view state" handed to it by script.js. script.js remains the single
   source of truth for what counts as "good/moderate/critical" — this file
   just renders whatever it's told, so the 3D view can never silently
   disagree with the dashboard.

   LAYOUT: 3 vertical + 2 horizontal roads divide the ground into a 4×3 grid
   of clear cells (no building ever crosses a road — see the CELL constants
   below). One zone lives in each cell; the metro line is the one feature
   that deliberately spans the whole city, elevated above everything else.

   Public API (attached to window.City3D):
     City3D.init(containerEl)   - build the scene once
     City3D.update(viewState)   - recolor/resize meshes from state
     City3D.onTabShown()        - call when the City Map tab becomes visible
     City3D.onTabHidden()       - call when it's hidden (pauses rendering)
     City3D.resetCamera()       - snap the camera back to the default view
     City3D.setClickHandler(fn) - fn(zoneId) runs when a zone is clicked
   ============================================================================= */

window.City3D = (function () {

  /* ---- Palette (kept in sync with style.css custom properties) --------- */
  const COLOR = {
    bg: 0x060b13, elev1: 0x0b1626, elev2: 0x101f33,
    building: 0x15314c, buildingHi: 0x1b3a57,
    cyan: 0x28d9ec, green: 0x35d399, amber: 0xf2a93b, red: 0xff5d5d,
    textPrim: 0xe7f3f8, muted: 0x3c4f62, trunk: 0x3a2c1f, leaf: 0x1f6b4d,
  };
  const STATUS_COLOR = { good: COLOR.green, moderate: COLOR.amber, critical: COLOR.red };

  /* ---- Cell centers: 4 x-bands x 3 z-bands, clear of every road -------- */
  const CELL_X = { farWest: -61, westCenter: -17, eastCenter: 17, farEast: 61 };
  const CELL_Z = { north: -40, center: 0, south: 34 };
  const METRO_Z = 52; // elevated line sits further south, clear of the south-band clusters

  /* ---- Module state ------------------------------------------------------ */
  let scene, camera, renderer, controls, raycaster;
  let containerEl = null;
  let tabVisible = false;
  let ready = false;
  let clickHandler = null;

  const selectable = []; // meshes/groups eligible for raycasting
  let sharedBoxGeo, sharedCylGeo, sharedConeGeo;

  let roadMaterial, solarMaterial, hospitalMaterial, substationMaterial, transitMaterial;
  let reservoirFillMesh, floodOverlay;
  let hospitalAlertActive = false;
  let substationAlertActive = false;
  const windBlades = [];
  let ambientLight, sunLight;
  const DEFAULT_SUN = { color: 0xe7f3f8, intensity: 1.05 };
  let defaultCamPos, defaultTarget;
  let targetCamPos = null;
  let targetLookAt = null;
  let CAMERA_PRESETS = null;

  // Day/night cycle state
  let currentTimeOfDay = 12; // 0-24, 12 = noon
  const layers = {
    roads: true,
    electricity: true,
    water: true,
    transit: true,
    buildings: true
  };
  const layerGroups = {
    roads: null,
    electricity: null,
    water: null,
    transit: null,
    buildings: null
  };
  const buildingMaterials = []; // Track building materials for window effects
  const streetLights = []; // Track streetlight meshes
  const fireParticles = []; // Track fire particle systems
  let fireSystem = null;
  const congestionMeshes = []; // Track congestion indicators
  const vehicleMeshes = []; // Track 3D vehicles
  const rainParticles = []; // Track rain particles
  const pollutionParticles = []; // Track pollution haze
  let rainSystem = null;
  let pollutionSystem = null;
  let heatwaveSystem = null;
  let lastTime = 0; // For smooth animation delta time
  let currentTrafficStatus = 'good'; // Track current traffic status
  const trafficLights = []; // Track traffic light meshes
  let trafficLightTimer = 0; // Timer for traffic light cycling
  const TRAFFIC_LIGHT_CYCLE = 6; // Seconds between light changes

  /* ---------------------------- small helpers ---------------------------- */

  function addBox(group, x, yBase, z, w, h, d, material, castShadow) {
    const mesh = new THREE.Mesh(sharedBoxGeo, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, yBase + h / 2, z);
    mesh.castShadow = !!castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addCylinder(group, x, yBase, z, radius, h, material, castShadow) {
    const mesh = new THREE.Mesh(sharedCylGeo, material);
    mesh.scale.set(radius * 2, h, radius * 2);
    mesh.position.set(x, yBase + h / 2, z);
    mesh.castShadow = !!castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addCone(group, x, yBase, z, radius, h, material) {
    const mesh = new THREE.Mesh(sharedConeGeo, material);
    mesh.scale.set(radius * 2, h, radius * 2);
    mesh.position.set(x, yBase + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function markSelectable(obj, zoneId) {
    obj.userData.zoneId = zoneId;
    selectable.push(obj);
  }

  function makeStandardMaterial(hex, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.75, metalness: 0.15 }, opts || {}));
  }

  /* ----------------------------- scene setup ------------------------------ */

  function buildGround(group) {
    const mat = makeStandardMaterial(COLOR.elev1, { roughness: 0.95, metalness: 0.05 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(190, 150), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);
  }

  function buildRoads(group) {
    roadMaterial = makeStandardMaterial(STATUS_COLOR.good, { roughness: 0.6, emissive: 0x031a16, emissiveIntensity: 0.3 });
    const y = 0.05;
    const roadMeshes = [];
    [-34, 0, 34].forEach(x => roadMeshes.push(addBox(group, x, y, 0, 6, 0.15, 140, roadMaterial)));
    [-18, 18].forEach(z => roadMeshes.push(addBox(group, 0, y, z, 180, 0.15, 6, roadMaterial)));
    roadMeshes.forEach(m => markSelectable(m, 'roads'));

    // Add congestion indicators (colored overlays on roads)
    const congestionMat = makeStandardMaterial(COLOR.red, { transparent: true, opacity: 0.4 });
    [-34, 0, 34].forEach(x => {
      for (let z = -60; z <= 60; z += 15) {
        const congestion = addBox(group, x, y + 0.1, z, 4, 0.05, 8, congestionMat);
        congestion.visible = false;
        congestion.userData.isCongestion = true;
        congestionMeshes.push(congestion);
      }
    });
    [-18, 18].forEach(z => {
      for (let x = -70; x <= 70; x += 15) {
        const congestion = addBox(group, x, y + 0.1, z, 8, 0.05, 4, congestionMat);
        congestion.visible = false;
        congestion.userData.isCongestion = true;
        congestionMeshes.push(congestion);
      }
    });
  }

  function buildStreetLights(group) {
    const lightMat = makeStandardMaterial(0x4a5568, { roughness: 0.6 });

    // Place streetlights along roads
    const positions = [];
    [-34, 0, 34].forEach(x => {
      for (let z = -60; z <= 60; z += 20) {
        positions.push([x + 4, z]);
        positions.push([x - 4, z]);
      }
    });
    [-18, 18].forEach(z => {
      for (let x = -80; x <= 80; x += 20) {
        positions.push([x, z + 4]);
        positions.push([x, z - 4]);
      }
    });

    positions.forEach(([x, z]) => {
      const pole = addCylinder(group, x, 0, z, 0.15, 5, lightMat);
      const arm = addBox(group, x + 1.5, 4.5, z, 2, 0.1, 0.1, lightMat);
      const bulbMatOn = makeStandardMaterial(0xffd700, { emissive: 0xffd700, emissiveIntensity: 0.8 });
      const bulbMatOff = makeStandardMaterial(0x4a5568, { emissive: 0x000000, emissiveIntensity: 0 });
      const bulb = addBox(group, x + 2.3, 4.3, z, 0.3, 0.4, 0.3, bulbMatOff);
      bulb.userData.isStreetLight = true;
      bulb.userData.bulbMatOn = bulbMatOn;
      bulb.userData.bulbMatOff = bulbMatOff;
      streetLights.push(bulb);
    });
  }

  function buildTrafficLights(group) {
    // Traffic light materials
    const poleMat = makeStandardMaterial(0x2F4F4F, { roughness: 0.8 });
    const redMat = makeStandardMaterial(0xFF0000, { emissive: 0xFF0000, emissiveIntensity: 0.8 });
    const yellowMat = makeStandardMaterial(0xFFFF00, { emissive: 0xFFFF00, emissiveIntensity: 0.8 });
    const greenMat = makeStandardMaterial(0x00FF00, { emissive: 0x00FF00, emissiveIntensity: 0.8 });
    const offMat = makeStandardMaterial(0x1a1a1a, { emissive: 0x000000, emissiveIntensity: 0 });

    // Intersection coordinates
    const intersections = [];
    [-34, 0, 34].forEach(x => {
      [-18, 18].forEach(z => {
        intersections.push({ x, z });
      });
    });

    intersections.forEach((inter, i) => {
      // Create traffic light pole at each intersection (4 poles, one for each direction)
      const polePositions = [
        { x: inter.x - 6, z: inter.z - 6, dir: 'south' }, // Controls southbound vertical
        { x: inter.x + 6, z: inter.z - 6, dir: 'north' }, // Controls northbound vertical
        { x: inter.x - 6, z: inter.z + 6, dir: 'west' },  // Controls westbound horizontal
        { x: inter.x + 6, z: inter.z + 6, dir: 'east' },  // Controls eastbound horizontal
      ];

      const intersectionLights = {};

      polePositions.forEach((pos, dirIndex) => {
        const pole = addCylinder(group, pos.x, 0, pos.z, 0.2, 4, poleMat);
        const housing = addBox(group, pos.x, 4.5, pos.z, 0.8, 2, 0.5, poleMat);
        
        const redLight = addBox(group, pos.x, 5.2, pos.z, 0.3, 0.3, 0.1, offMat);
        const yellowLight = addBox(group, pos.x, 4.5, pos.z, 0.3, 0.3, 0.1, offMat);
        const greenLight = addBox(group, pos.x, 3.8, pos.z, 0.3, 0.3, 0.1, offMat);
        
        intersectionLights[pos.dir] = {
          redLight,
          yellowLight,
          greenLight,
          redMat,
          yellowMat,
          greenMat,
          offMat,
          state: 'red'
        };
      });

      // Store intersection with direction-aware lights
      trafficLights.push({
        x: inter.x,
        z: inter.z,
        lights: intersectionLights,
        verticalState: 'green', // State for vertical traffic
        horizontalState: 'red', // State for horizontal traffic
        phase: i % 2
      });
      
      // Set initial states
      if (i % 2 === 0) {
        intersectionLights.north.greenLight.material = greenMat;
        intersectionLights.north.state = 'green';
        intersectionLights.south.greenLight.material = greenMat;
        intersectionLights.south.state = 'green';
        intersectionLights.east.redLight.material = redMat;
        intersectionLights.east.state = 'red';
        intersectionLights.west.redLight.material = redMat;
        intersectionLights.west.state = 'red';
      } else {
        intersectionLights.east.greenLight.material = greenMat;
        intersectionLights.east.state = 'green';
        intersectionLights.west.greenLight.material = greenMat;
        intersectionLights.west.state = 'green';
        intersectionLights.north.redLight.material = redMat;
        intersectionLights.north.state = 'red';
        intersectionLights.south.redLight.material = redMat;
        intersectionLights.south.state = 'red';
      }
    });
  }

  function buildResidential(group, zoneId, cx, cz, baseColor) {
    const mat = makeStandardMaterial(baseColor, { emissive: 0x0b2430, emissiveIntensity: 0.35, roughness: 0.7 });
    mat.userData.isBuilding = true;
    mat.userData.baseEmissiveIntensity = 0.35;
    mat.userData.nightEmissiveIntensity = 0.65;
    buildingMaterials.push(mat);
    
    // Cartoonish accent colors for roofs and details
    const roofColors = [0x8B4513, 0xA0522D, 0xCD853F, 0xD2691E];
    const windowMat = makeStandardMaterial(0x87CEEB, { emissive: 0x1a3a5c, emissiveIntensity: 0.4 });
    
    const heights = [4, 6.5, 3.5, 7, 5, 4.5, 6.5, 3, 5.5];
    let i = 0;
    [-7, 0, 7].forEach(dx => {
      [-7, 0, 7].forEach(dz => {
        const h = heights[i % heights.length]; i++;
        const bx = cx + dx;
        const bz = cz + dz;
        
        // Main building body
        const building = addBox(group, bx, 0, bz, 5, h, 5, mat, true);
        markSelectable(building, zoneId);
        
        // Add cartoonish roof
        const roofMat = makeStandardMaterial(roofColors[i % roofColors.length], { roughness: 0.9 });
        const roof = addBox(group, bx, h + 0.5, bz, 5.5, 1, 5.5, roofMat);
        
        // Add window grid for cartoon look
        const windowSize = 0.8;
        const windowSpacing = 1.5;
        for (let wy = 1; wy < h - 1; wy += windowSpacing) {
          for (let wx = -1.5; wx <= 1.5; wx += windowSpacing) {
            // Front windows
            addBox(group, bx + wx, wy, bz + 2.6, windowSize, windowSize, 0.1, windowMat);
            // Back windows
            addBox(group, bx + wx, wy, bz - 2.6, windowSize, windowSize, 0.1, windowMat);
          }
        }
      });
    });
  }

  function buildCBD(group, cx, cz) {
    const mat = makeStandardMaterial(COLOR.buildingHi, { emissive: 0x123246, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.4 });
    mat.userData.isBuilding = true;
    mat.userData.baseEmissiveIntensity = 0.55;
    mat.userData.nightEmissiveIntensity = 0.8;
    buildingMaterials.push(mat);
    
    // Glass-like window material
    const glassMat = makeStandardMaterial(0x87CEEB, { emissive: 0x2a4a6c, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 });
    const accentMat = makeStandardMaterial(0x4682B4, { emissive: 0x1a2a3c, emissiveIntensity: 0.4 });
    
    const towers = [
      [-9, -5, 26], [0, -5, 38], [9, -5, 20], [-9, 5, 32], [0, 5, 44], [9, 5, 24],
    ]; // [dx, dz, height]
    
    towers.forEach((t, i) => {
      const bx = cx + t[0];
      const bz = cz + t[1];
      const h = t[2];
      
      // Main tower
      const tower = addBox(group, bx, 0, bz, 5, h, 5, mat, true);
      markSelectable(tower, 'cbd');
      
      // Add cartoonish top/spire
      const spireHeight = 4;
      const spire = addBox(group, bx, h + spireHeight / 2, bz, 2, spireHeight, 2, accentMat);
      
      // Add window grid (cartoon-like pattern)
      const windowSize = 0.6;
      const windowSpacing = 1.2;
      for (let wy = 2; wy < h - 2; wy += windowSpacing) {
        for (let wx = -1.8; wx <= 1.8; wx += windowSpacing) {
          // All 4 sides
          addBox(group, bx + wx, wy, bz + 2.6, windowSize, windowSize, 0.1, glassMat);
          addBox(group, bx + wx, wy, bz - 2.6, windowSize, windowSize, 0.1, glassMat);
          addBox(group, bx + 2.6, wy, bz + wx, 0.1, windowSize, windowSize, glassMat);
          addBox(group, bx - 2.6, wy, bz + wx, 0.1, windowSize, windowSize, glassMat);
        }
      }
      
      // Add horizontal accent lines
      for (let wy = 5; wy < h; wy += 8) {
        addBox(group, bx, wy, bz, 5.2, 0.3, 5.2, accentMat);
      }
    });
  }

  function buildHospital(group, cx, cz) {
    hospitalMaterial = makeStandardMaterial(COLOR.textPrim, { emissive: 0x332020, emissiveIntensity: 0.15, roughness: 0.6 });
    const roofMat = makeStandardMaterial(0xFFFFFF, { roughness: 0.8 });
    const windowMat = makeStandardMaterial(0x87CEEB, { emissive: 0x1a3a5c, emissiveIntensity: 0.5 });
    
    // Main building
    markSelectable(addBox(group, cx, 0, cz, 12, 8, 12, hospitalMaterial, true), 'hospital');
    
    // Cartoonish roof
    addBox(group, cx, 8.5, cz, 12.5, 1, 12.5, roofMat);
    
    // Red cross on roof
    const crossMat = makeStandardMaterial(COLOR.red, { emissive: COLOR.red, emissiveIntensity: 0.6 });
    markSelectable(addBox(group, cx, 9, cz + 6.1, 1.4, 4, 0.3, crossMat), 'hospital');
    markSelectable(addBox(group, cx, 9, cz + 6.1, 3.6, 1.4, 0.3, crossMat), 'hospital');
    
    // Cartoon windows
    const windowSize = 1.2;
    for (let wx = -4; wx <= 4; wx += 2.5) {
      for (let wy = 2; wy <= 6; wy += 2) {
        addBox(group, cx + wx, wy, cz + 6.1, windowSize, windowSize, 0.1, windowMat);
        addBox(group, cx + wx, wy, cz - 6.1, windowSize, windowSize, 0.1, windowMat);
      }
    }
    
    // Ambulance bay (cartoon style)
    const bayMat = makeStandardMaterial(0x4169E1, { emissive: 0x1a2a4c, emissiveIntensity: 0.3 });
    addBox(group, cx - 6, 0, cz, 3, 4, 4, bayMat);
  }

  function buildSolarFarm(group, zoneId, cx, cz) {
    solarMaterial = solarMaterial || makeStandardMaterial(STATUS_COLOR.good, { emissive: STATUS_COLOR.good, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.7 });
    const frameMat = makeStandardMaterial(0x708090, { roughness: 0.9 });
    
    [-5.1, -1.7, 1.7, 5.1].forEach(dx => {
      [-1.7, 1.7].forEach(dz => {
        const x = cx + dx, z = cz + dz;
        // Sturdier cartoon pole
        addCylinder(group, x, 0, z, 0.25, 1.6, frameMat);
        // Panel with cartoon grid lines
        const panel = new THREE.Mesh(sharedBoxGeo, solarMaterial);
        panel.scale.set(2.6, 0.2, 2.6);
        panel.position.set(x, 1.6, z);
        panel.rotation.x = -0.35;
        panel.castShadow = true; panel.receiveShadow = true;
        group.add(panel);
        markSelectable(panel, zoneId);
        
        // Add cartoon grid lines on panel
        const gridMat = makeStandardMaterial(0x4682B4, { emissive: 0x1a2a3c, emissiveIntensity: 0.3 });
        addBox(group, x, 1.72, z, 2.8, 0.05, 0.1, gridMat);
        addBox(group, x, 1.72, z, 0.1, 0.05, 2.8, gridMat);
      });
    });
  }

  function buildSubstation(group, cx, cz) {
    substationMaterial = makeStandardMaterial(STATUS_COLOR.good, { emissive: STATUS_COLOR.good, emissiveIntensity: 0.4, roughness: 0.5 });
    const metalMat = makeStandardMaterial(0x708090, { roughness: 0.7 });
    
    // Main building
    markSelectable(addBox(group, cx, 0, cz, 9, 5, 9, substationMaterial, true), 'substation');
    
    // Cartoon roof with vents
    const roofMat = makeStandardMaterial(0x696969, { roughness: 0.8 });
    addBox(group, cx, 5.3, cz, 9.5, 0.6, 9.5, roofMat);
    
    // Vents on roof
    addBox(group, cx - 2, 5.8, cz - 2, 1.5, 0.8, 1.5, metalMat);
    addBox(group, cx + 2, 5.8, cz + 2, 1.5, 0.8, 1.5, metalMat);
    
    // Cartoon pylons
    const pylonMat = makeStandardMaterial(COLOR.muted);
    [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(o => addCylinder(group, cx + o[0], 5, cz + o[1], 0.25, 4, pylonMat));
    
    // Transformer units
    addBox(group, cx - 5, 0, cz - 5, 2, 3, 2, metalMat);
    addBox(group, cx + 5, 0, cz + 5, 2, 3, 2, metalMat);
  }

  function buildReservoir(group, cx, cz) {
    const shellGeo = new THREE.BoxGeometry(10, 8, 10);
    const shellLine = new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo), new THREE.LineBasicMaterial({ color: COLOR.cyan, transparent: true, opacity: 0.55 }));
    shellLine.position.set(cx, 4, cz);
    group.add(shellLine);
    const fillMat = makeStandardMaterial(COLOR.cyan, { emissive: COLOR.cyan, emissiveIntensity: 0.3, transparent: true, opacity: 0.8 });
    reservoirFillMesh = new THREE.Mesh(sharedCylGeo, fillMat);
    reservoirFillMesh.scale.set(8.6, 1, 8.6); // height set dynamically in update()
    reservoirFillMesh.position.set(cx, 0.5, cz);
    group.add(reservoirFillMesh);
    markSelectable(reservoirFillMesh, 'reservoir');
    const hitbox = makeStandardMaterial(COLOR.elev2, { transparent: true, opacity: 0 });
    markSelectable(addBox(group, cx, 0, cz, 10, 8, 10, hitbox), 'reservoir');
  }

  function buildWindFarm(group, cx, cz) {
    const poleMat = makeStandardMaterial(0xcfd9e0, { roughness: 0.5 });
    const bladeMat = makeStandardMaterial(0xe7f3f8, { roughness: 0.4 });
    const hubMat = makeStandardMaterial(0xFFFFFF, { roughness: 0.3 });
    
    [-9, 0, 9].forEach(dx => {
      const x = cx + dx;
      // Thicker cartoon pole
      markSelectable(addCylinder(group, x, 0, cz, 0.5, 11, poleMat, true), 'wind');
      
      // Cartoon nacelle (the box behind blades)
      addBox(group, x, 11, cz, 2, 1.5, 1.5, poleMat);
      
      const hub = new THREE.Group();
      hub.position.set(x, 11, cz);
      
      // Center hub
      const centerHub = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), hubMat);
      hub.add(centerHub);
      
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(sharedBoxGeo, bladeMat);
        blade.scale.set(0.4, 5, 0.8); // Thicker, longer cartoon blades
        blade.position.set(0, 2.5, 0);
        blade.rotation.z = (b * Math.PI * 2) / 3;
        hub.add(blade);
      }
      markSelectable(hub, 'wind');
      windBlades.push(hub);
      group.add(hub);
    });
  }

  function buildMetro(group, stationCx, stationCz) {
    transitMaterial = makeStandardMaterial(STATUS_COLOR.good, { emissive: STATUS_COLOR.good, emissiveIntensity: 0.45, metalness: 0.6 });
    const stops = [CELL_X.farWest, CELL_X.westCenter, CELL_X.eastCenter, CELL_X.farEast];
    const pylonMat = makeStandardMaterial(COLOR.muted, { roughness: 0.8 });
    
    // Thicker cartoon tracks
    for (let i = 0; i < stops.length - 1; i++) {
      const midX = (stops[i] + stops[i + 1]) / 2;
      const len = Math.abs(stops[i + 1] - stops[i]) - 2;
      markSelectable(addBox(group, midX, 6, METRO_Z, len, 0.6, 2, transitMaterial), 'metro');
    }
    
    // Cartoon stations
    stops.forEach(x => {
      addCylinder(group, x, 0, METRO_Z, 0.4, 6, pylonMat);
      markSelectable(addBox(group, x, 6, METRO_Z, 2, 0.5, 2, transitMaterial), 'metro');
    });
    
    // Main station building with cartoon style
    const stationMat = makeStandardMaterial(COLOR.building, { emissive: 0x0b2430, emissiveIntensity: 0.3, roughness: 0.6 });
    const roofMat = makeStandardMaterial(0x2F4F4F, { roughness: 0.8 });
    markSelectable(addBox(group, stationCx, 0, stationCz, 8, 4, 6, stationMat, true), 'metro');
    addBox(group, stationCx, 4.3, stationCz, 8.5, 0.6, 6.5, roofMat);
    
    // Cartoon entrance
    const entranceMat = makeStandardMaterial(0x4682B4, { emissive: 0x1a2a3c, emissiveIntensity: 0.4 });
    addBox(group, stationCx, 1.5, stationCz + 3.1, 3, 3, 0.1, entranceMat);
  }

  function buildPark(group, zoneId, cx, cz) {
    const padMat = makeStandardMaterial(0x0e2a21, { roughness: 1 });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(9, 24), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, 0.03, cz);
    pad.receiveShadow = true;
    group.add(pad);
    markSelectable(pad, zoneId);
    
    const trunkMat = makeStandardMaterial(COLOR.trunk, { roughness: 0.9 });
    const leafMat = makeStandardMaterial(COLOR.leaf, { roughness: 0.8, emissive: 0x062015, emissiveIntensity: 0.3 });
    const flowerMat = makeStandardMaterial(0xFF69B4, { emissive: 0x4a1a2c, emissiveIntensity: 0.3 });
    
    // Cartoon trees with spherical foliage
    [[0, 0], [4, 2], [-4, 2], [2, -4], [-3, -3]].forEach(o => {
      const tx = cx + o[0];
      const tz = cz + o[1];
      
      // Thicker trunk
      addCylinder(group, tx, 0, tz, 0.4, 1.8, trunkMat);
      
      // Cartoon spherical foliage
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 12), leafMat);
      foliage.position.set(tx, 3.5, tz);
      group.add(foliage);
      
      // Add some cartoon flowers
      if (Math.random() > 0.5) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), flowerMat);
        flower.position.set(tx + (Math.random() - 0.5) * 2, 2, tz + (Math.random() - 0.5) * 2);
        group.add(flower);
      }
    });
    
    // Add a cartoon bench
    const benchMat = makeStandardMaterial(0x8B4513, { roughness: 0.8 });
    addBox(group, cx, 0.3, cz + 4, 2, 0.3, 0.8, benchMat);
    addBox(group, cx, 0.7, cz + 4, 2, 0.3, 0.2, benchMat);
  }

  function buildStars(group) {
    const count = 280;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 180 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = 35 + r * Math.cos(phi) * 0.5;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fd8e8, size: 0.6, transparent: true, opacity: 0.6 })));
  }

  function buildFloodOverlay(group, cx, cz) {
    // Create 3D water box instead of flat plane
    const mat = new THREE.MeshPhongMaterial({
      color: 0x2fa3c9,
      transparent: true,
      opacity: 0.6,
      shininess: 100,
      specular: 0x4fc3f7
    });
    floodOverlay = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 44), mat);
    floodOverlay.position.set(cx, 1.5, cz);
    floodOverlay.visible = false;
    floodOverlay.userData.baseY = 1.5;
    group.add(floodOverlay);
  }

  function buildFireSystem(group) {
    // Create a reusable fire particle system
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    const lifetimes = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      velocities.push({
        x: (Math.random() - 0.5) * 0.3,
        y: Math.random() * 0.2 + 0.1,
        z: (Math.random() - 0.5) * 0.3
      });
      lifetimes.push(Math.random());
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xff4500,
      size: 0.8,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    fireSystem = new THREE.Points(geometry, material);
    fireSystem.userData.velocities = velocities;
    fireSystem.userData.lifetimes = lifetimes;
    fireSystem.userData.baseY = 0;
    fireSystem.visible = false;
    group.add(fireSystem);
  }

  function buildHeatwaveSystem(group) {
    // Heat distortion particles (orange, rising)
    const particleCount = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
      velocities.push({
        x: (Math.random() - 0.5) * 0.05,
        y: 0.1 + Math.random() * 0.1,
        z: (Math.random() - 0.5) * 0.05
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 1.2,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });

    const heatwaveSystem = new THREE.Points(geometry, material);
    heatwaveSystem.userData.velocities = velocities;
    heatwaveSystem.visible = false;
    group.add(heatwaveSystem);
    return heatwaveSystem;
  }

  function buildRainSystem(group) {
    const particleCount = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 50 + 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      velocities.push({
        x: 0,
        y: -0.5 - Math.random() * 0.3,
        z: 0
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x8899aa,
      size: 0.4,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    rainSystem = new THREE.Points(geometry, material);
    rainSystem.userData.velocities = velocities;
    rainSystem.visible = false;
    group.add(rainSystem);
  }

  function buildPollutionSystem(group) {
    const particleCount = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 180;
      positions[i * 3 + 1] = Math.random() * 30 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 150;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x666655,
      size: 2,
      transparent: true,
      opacity: 0.3,
      blending: THREE.NormalBlending
    });

    pollutionSystem = new THREE.Points(geometry, material);
    pollutionSystem.visible = false;
    group.add(pollutionSystem);
  }

  function buildVehicles(group) {
    // Cartoon car colors
    const carColors = [0xFF0000, 0x0000FF, 0x00FF00, 0xFFFF00, 0xFFA500, 0x800080, 0x00CED1, 0xFF69B4];
    const wheelMat = makeStandardMaterial(0x1a1a1a, { roughness: 0.9 });
    const windowMat = makeStandardMaterial(0x87CEEB, { emissive: 0x1a3a5c, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
    const lightMat = makeStandardMaterial(0xFFFF00, { emissive: 0xFFFF00, emissiveIntensity: 0.8 });
    const tailMat = makeStandardMaterial(0xFF0000, { emissive: 0xFF0000, emissiveIntensity: 0.6 });

    // Place vehicles on roads
    const roadPositions = [];
    [-34, 0, 34].forEach(x => {
      for (let z = -60; z <= 60; z += 15) {
        roadPositions.push({ x: x + 4, z: z, dir: 'vertical' });
        roadPositions.push({ x: x - 4, z: z, dir: 'vertical' });
      }
    });
    [-18, 18].forEach(z => {
      for (let x = -70; x <= 70; x += 15) {
        roadPositions.push({ x: x, z: z + 4, dir: 'horizontal' });
        roadPositions.push({ x: x, z: z - 4, dir: 'horizontal' });
      }
    });

    roadPositions.forEach((pos, i) => {
      const carGroup = new THREE.Group();
      const carColor = carColors[i % carColors.length];
      const bodyMat = makeStandardMaterial(carColor, { roughness: 0.3, metalness: 0.6 });
      
      // Main chassis (lower body)
      const chassis = addBox(group, 0, 0.3, 0, 2, 0.6, 4, bodyMat);
      carGroup.add(chassis);
      
      // Cabin/roof (upper body)
      const cabin = addBox(group, 0, 0.9, -0.2, 1.6, 0.7, 2, bodyMat);
      carGroup.add(cabin);
      
      // Windshield (front)
      addBox(group, 0, 1.0, 0.9, 1.4, 0.5, 0.1, windowMat);
      
      // Rear window
      addBox(group, 0, 1.0, -1.3, 1.4, 0.5, 0.1, windowMat);
      
      // Side windows
      addBox(group, 0.9, 1.0, -0.2, 0.1, 0.5, 1.6, windowMat);
      addBox(group, -0.9, 1.0, -0.2, 0.1, 0.5, 1.6, windowMat);
      
      // Headlights
      addBox(group, 0.6, 0.4, 2.0, 0.3, 0.2, 0.1, lightMat);
      addBox(group, -0.6, 0.4, 2.0, 0.3, 0.2, 0.1, lightMat);
      
      // Taillights
      addBox(group, 0.6, 0.4, -2.0, 0.3, 0.2, 0.1, tailMat);
      addBox(group, -0.6, 0.4, -2.0, 0.3, 0.2, 0.1, tailMat);
      
      // Wheels (4 wheels)
      const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      
      const wheelFL = new THREE.Mesh(wheelGeo, wheelMat);
      wheelFL.position.set(0.7, 0.3, 1.2);
      carGroup.add(wheelFL);
      
      const wheelFR = new THREE.Mesh(wheelGeo, wheelMat);
      wheelFR.position.set(-0.7, 0.3, 1.2);
      carGroup.add(wheelFR);
      
      const wheelRL = new THREE.Mesh(wheelGeo, wheelMat);
      wheelRL.position.set(0.7, 0.3, -1.2);
      carGroup.add(wheelRL);
      
      const wheelRR = new THREE.Mesh(wheelGeo, wheelMat);
      wheelRR.position.set(-0.7, 0.3, -1.2);
      carGroup.add(wheelRR);
      
      // Position the car group
      carGroup.position.set(pos.x, 0, pos.z);
      if (pos.dir === 'horizontal') {
        carGroup.rotation.y = Math.PI / 2;
      }
      
      carGroup.userData.originalX = pos.x;
      carGroup.userData.originalZ = pos.z;
      carGroup.userData.dir = pos.dir;
      carGroup.userData.speed = 0.8 + Math.random() * 0.4;
      carGroup.userData.index = i;
      vehicleMeshes.push(carGroup);
      group.add(carGroup);
    });
  }

  function showFireAt(x, z) {
    if (!fireSystem) return;
    fireSystem.position.set(x, 0, z);
    fireSystem.userData.baseY = 0;
    fireSystem.visible = true;
  }

  function updateTrafficLights(deltaTime) {
    trafficLightTimer += deltaTime;
    
    // Cycle traffic lights every TRAFFIC_LIGHT_CYCLE seconds
    if (trafficLightTimer >= TRAFFIC_LIGHT_CYCLE) {
      trafficLightTimer = 0;
      
      // Toggle phases - alternate intersections
      trafficLights.forEach(light => {
        // Phase 0: vertical green -> yellow -> red
        // Phase 1: horizontal green -> yellow -> red
        if (light.phase === 0) {
          // Vertical traffic cycling
          if (light.verticalState === 'green') {
            light.verticalState = 'yellow';
            light.lights.north.greenLight.material = light.lights.north.offMat;
            light.lights.south.greenLight.material = light.lights.south.offMat;
            light.lights.north.yellowLight.material = light.lights.north.yellowMat;
            light.lights.south.yellowLight.material = light.lights.south.yellowMat;
            light.lights.north.state = 'yellow';
            light.lights.south.state = 'yellow';
          } else if (light.verticalState === 'yellow') {
            light.verticalState = 'red';
            light.lights.north.yellowLight.material = light.lights.north.offMat;
            light.lights.south.yellowLight.material = light.lights.south.offMat;
            light.lights.north.redLight.material = light.lights.north.redMat;
            light.lights.south.redLight.material = light.lights.south.redMat;
            light.lights.north.state = 'red';
            light.lights.south.state = 'red';
            // Enable horizontal when vertical is red
            light.horizontalState = 'green';
            light.lights.east.redLight.material = light.lights.east.offMat;
            light.lights.west.redLight.material = light.lights.west.offMat;
            light.lights.east.greenLight.material = light.lights.east.greenMat;
            light.lights.west.greenLight.material = light.lights.west.greenMat;
            light.lights.east.state = 'green';
            light.lights.west.state = 'green';
          } else if (light.verticalState === 'red') {
            light.verticalState = 'green';
            light.lights.north.redLight.material = light.lights.north.offMat;
            light.lights.south.redLight.material = light.lights.south.offMat;
            light.lights.north.greenLight.material = light.lights.north.greenMat;
            light.lights.south.greenLight.material = light.lights.south.greenMat;
            light.lights.north.state = 'green';
            light.lights.south.state = 'green';
            // Disable horizontal when vertical is green
            light.horizontalState = 'red';
            light.lights.east.greenLight.material = light.lights.east.offMat;
            light.lights.west.greenLight.material = light.lights.west.offMat;
            light.lights.east.redLight.material = light.lights.east.redMat;
            light.lights.west.redLight.material = light.lights.west.redMat;
            light.lights.east.state = 'red';
            light.lights.west.state = 'red';
          }
        } else {
          // Phase 1: horizontal traffic cycling (offset)
          if (light.horizontalState === 'green') {
            light.horizontalState = 'yellow';
            light.lights.east.greenLight.material = light.lights.east.offMat;
            light.lights.west.greenLight.material = light.lights.west.offMat;
            light.lights.east.yellowLight.material = light.lights.east.yellowMat;
            light.lights.west.yellowLight.material = light.lights.west.yellowMat;
            light.lights.east.state = 'yellow';
            light.lights.west.state = 'yellow';
          } else if (light.horizontalState === 'yellow') {
            light.horizontalState = 'red';
            light.lights.east.yellowLight.material = light.lights.east.offMat;
            light.lights.west.yellowLight.material = light.lights.west.offMat;
            light.lights.east.redLight.material = light.lights.east.redMat;
            light.lights.west.redLight.material = light.lights.west.redMat;
            light.lights.east.state = 'red';
            light.lights.west.state = 'red';
            // Enable vertical when horizontal is red
            light.verticalState = 'green';
            light.lights.north.redLight.material = light.lights.north.offMat;
            light.lights.south.redLight.material = light.lights.south.offMat;
            light.lights.north.greenLight.material = light.lights.north.greenMat;
            light.lights.south.greenLight.material = light.lights.south.greenMat;
            light.lights.north.state = 'green';
            light.lights.south.state = 'green';
          } else if (light.horizontalState === 'red') {
            light.horizontalState = 'green';
            light.lights.east.redLight.material = light.lights.east.offMat;
            light.lights.west.redLight.material = light.lights.west.offMat;
            light.lights.east.greenLight.material = light.lights.east.greenMat;
            light.lights.west.greenLight.material = light.lights.west.greenMat;
            light.lights.east.state = 'green';
            light.lights.west.state = 'green';
            // Disable vertical when horizontal is green
            light.verticalState = 'red';
            light.lights.north.greenLight.material = light.lights.north.offMat;
            light.lights.south.greenLight.material = light.lights.south.offMat;
            light.lights.north.redLight.material = light.lights.north.redMat;
            light.lights.south.redLight.material = light.lights.south.redMat;
            light.lights.north.state = 'red';
            light.lights.south.state = 'red';
          }
        }
      });
    }
  }

  function getDistance(car1, car2) {
    const dx = car1.position.x - car2.position.x;
    const dz = car1.position.z - car2.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function isNearTrafficLight(car) {
    for (const intersection of trafficLights) {
      const dx = Math.abs(car.position.x - intersection.x);
      const dz = Math.abs(car.position.z - intersection.z);
      
      // Check if car is approaching intersection (within 10 units)
      if (dx < 10 && dz < 10) {
        // Determine which direction the car is coming from
        let direction = null;
        if (car.userData.dir === 'vertical') {
          if (car.position.z < intersection.z) direction = 'south'; // Moving north
          else direction = 'north'; // Moving south
        } else {
          if (car.position.x < intersection.x) direction = 'west'; // Moving east
          else direction = 'east'; // Moving west
        }
        
        // Check if the relevant light is red or yellow
        if (direction && intersection.lights[direction]) {
          const lightState = intersection.lights[direction].state;
          if (lightState === 'red' || lightState === 'yellow') {
            // Only stop if car is close to intersection (within 6 units)
            if (dx < 6 && dz < 6) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function isCarAhead(car) {
    const safeDistance = 6; // Minimum distance between cars
    const congestionThreshold = 8; // Distance to check for congestion
    
    let carsAhead = 0;
    let totalCarsNearby = 0;
    
    for (const otherCar of vehicleMeshes) {
      if (otherCar === car || !otherCar.visible) continue;
      
      const dist = getDistance(car, otherCar);
      
      // Count all nearby cars for congestion detection
      if (dist < congestionThreshold) {
        totalCarsNearby++;
      }
      
      // Check if cars are on same road and direction
      if (car.userData.dir !== otherCar.userData.dir) continue;
      
      if (dist < safeDistance) {
        // Check if other car is ahead
        if (car.userData.dir === 'vertical') {
          if (Math.abs(car.position.x - otherCar.position.x) < 3) {
            if (otherCar.position.z > car.position.z) {
              carsAhead++;
            }
          }
        } else {
          if (Math.abs(car.position.z - otherCar.position.z) < 3) {
            if (otherCar.position.x > car.position.x) {
              carsAhead++;
            }
          }
        }
      }
    }
    
    // If there are too many cars nearby and cars ahead, indicate congestion
    if (totalCarsNearby > 5 && carsAhead > 0) {
      return true; // Congested - stop
    }
    
    // Normal case: stop if car directly ahead
    return carsAhead > 0;
  }

  function hideFire() {
    if (!fireSystem) return;
    fireSystem.visible = false;
  }

  function updateFireParticles() {
    if (!fireSystem || !fireSystem.visible) return;

    const positions = fireSystem.geometry.attributes.position.array;
    const velocities = fireSystem.userData.velocities;
    const lifetimes = fireSystem.userData.lifetimes;
    const baseY = fireSystem.userData.baseY;

    for (let i = 0; i < lifetimes.length; i++) {
      lifetimes[i] -= 0.02;

      if (lifetimes[i] <= 0) {
        // Reset particle
        lifetimes[i] = 1;
        positions[i * 3] = (Math.random() - 0.5) * 2;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
        velocities[i] = {
          x: (Math.random() - 0.5) * 0.3,
          y: Math.random() * 0.2 + 0.1,
          z: (Math.random() - 0.5) * 0.3
        };
      } else {
        // Update position
        positions[i * 3] += velocities[i].x;
        positions[i * 3 + 1] += velocities[i].y;
        positions[i * 3 + 2] += velocities[i].z;
      }
    }

    fireSystem.geometry.attributes.position.needsUpdate = true;
  }

  function updateHeatwaveParticles() {
    if (!heatwaveSystem || !heatwaveSystem.visible) return;

    const positions = heatwaveSystem.geometry.attributes.position.array;
    const velocities = heatwaveSystem.userData.velocities;

    for (let i = 0; i < velocities.length; i++) {
      positions[i * 3] += velocities[i].x;
      positions[i * 3 + 1] += velocities[i].y;
      positions[i * 3 + 2] += velocities[i].z;

      // Reset if too high
      if (positions[i * 3 + 1] > 30) {
        positions[i * 3 + 1] = 0;
        positions[i * 3] = (Math.random() - 0.5) * 120;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
      }
    }

    heatwaveSystem.geometry.attributes.position.needsUpdate = true;
  }

  function updateRainParticles() {
    if (!rainSystem || !rainSystem.visible) return;

    const positions = rainSystem.geometry.attributes.position.array;
    const velocities = rainSystem.userData.velocities;

    for (let i = 0; i < velocities.length; i++) {
      positions[i * 3 + 1] += velocities[i].y;

      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 50 + Math.random() * 20;
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
    }

    rainSystem.geometry.attributes.position.needsUpdate = true;
  }

  function updateVehicles(deltaTime) {
    const trafficStatus = currentTrafficStatus || 'good';
    
    // Determine how many cars to show based on traffic
    let carsToShow = 0;
    if (trafficStatus === 'critical') carsToShow = vehicleMeshes.length; // All cars
    else if (trafficStatus === 'moderate') carsToShow = Math.floor(vehicleMeshes.length * 0.6); // 60% of cars
    else carsToShow = Math.floor(vehicleMeshes.length * 0.2); // 20% of cars when good

    // Base speed: 50 units per second (smooth, natural pace)
    const baseSpeed = 50.0;
    const speedMultiplier = trafficStatus === 'critical' ? 0.2 : trafficStatus === 'moderate' ? 0.5 : 1;

    vehicleMeshes.forEach((car, index) => {
      car.visible = index < carsToShow; // Only show subset based on traffic

      if (car.visible) {
        // Check if car should stop (traffic light or car ahead)
        const shouldStop = isNearTrafficLight(car) || isCarAhead(car);
        
        // Smooth movement using delta time
        let speed = baseSpeed * car.userData.speed * speedMultiplier * deltaTime;
        
        // Stop if needed
        if (shouldStop) {
          speed = 0;
        }
        
        // Keep vehicles on their specific road lane
        if (car.userData.dir === 'vertical') {
          car.position.z += speed;
          // Reset when reaching end of road segment, keep original X position
          if (car.position.z > 60) {
            car.position.z = -60;
            car.position.x = car.userData.originalX;
          }
          if (car.position.z < -60) {
            car.position.z = 60;
            car.position.x = car.userData.originalX;
          }
        } else {
          car.position.x += speed;
          // Reset when reaching end of road segment, keep original Z position
          if (car.position.x > 70) {
            car.position.x = -70;
            car.position.z = car.userData.originalZ;
          }
          if (car.position.x < -70) {
            car.position.x = 70;
            car.position.z = car.userData.originalZ;
          }
        }
      }
    });
  }

  function buildLights(root) {
    ambientLight = new THREE.AmbientLight(0x3a5a74, 0.65);
    root.add(ambientLight);
    sunLight = new THREE.DirectionalLight(DEFAULT_SUN.color, DEFAULT_SUN.intensity);
    sunLight.position.set(70, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.updateProjectionMatrix();
    root.add(sunLight);
  }

  /* ------------------------------- init ----------------------------------- */

  function showMessage(container, html) {
    const el = document.createElement('div');
    el.className = 'city3d-message';
    el.innerHTML = html;
    container.appendChild(el);
  }

  function init(container) {
    containerEl = container;

    if (typeof THREE === 'undefined') {
      showMessage(container, '<strong>3D city unavailable.</strong><br>Three.js was not found. Add <code>vendor/three.min.js</code> and <code>vendor/OrbitControls.js</code> next to index.html, or switch the script tags to the CDN versions — see the setup instructions.');
      return;
    }

    try {
      sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
      sharedCylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
      sharedConeGeo = new THREE.ConeGeometry(0.5, 1, 16);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(COLOR.bg);
      scene.fog = new THREE.FogExp2(COLOR.bg, 0.0048);

      camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
      defaultCamPos = new THREE.Vector3(128, 100, 140);
      defaultTarget = new THREE.Vector3(0, 3, 0);
      CAMERA_PRESETS = {
        overview: { pos: new THREE.Vector3(128, 100, 140), target: new THREE.Vector3(0, 3, 0) },
        cbd: { pos: new THREE.Vector3(-17, 65, 35), target: new THREE.Vector3(-17, 15, -40) },
        solar: { pos: new THREE.Vector3(0, 50, 70), target: new THREE.Vector3(0, 6, 0) },
        reservoir: { pos: new THREE.Vector3(-61, 50, 95), target: new THREE.Vector3(-61, 5, 34) },
        hospital: { pos: new THREE.Vector3(-61, 45, -15), target: new THREE.Vector3(-61, 8, 0) }
      };
      camera.position.copy(defaultCamPos);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(renderer.domElement);

      if (typeof THREE.OrbitControls !== 'function') {
        showMessage(container, '<strong>Camera controls unavailable.</strong><br>OrbitControls.js was not found alongside three.min.js — the city will still render, but you can\'t rotate/pan/zoom it.');
      } else {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 40;
        controls.maxDistance = 300;
        controls.maxPolarAngle = Math.PI * 0.49;
        controls.target.copy(defaultTarget);
      }

      const world = new THREE.Group();
      scene.add(world);

      // Create layer groups
      layerGroups.roads = new THREE.Group();
      layerGroups.electricity = new THREE.Group();
      layerGroups.water = new THREE.Group();
      layerGroups.transit = new THREE.Group();
      layerGroups.buildings = new THREE.Group();
      world.add(layerGroups.roads);
      world.add(layerGroups.electricity);
      world.add(layerGroups.water);
      world.add(layerGroups.transit);
      world.add(layerGroups.buildings);

      buildLights(scene);
      buildGround(world);
      buildRoads(layerGroups.roads);
      buildStreetLights(layerGroups.roads);

      buildResidential(layerGroups.buildings, 'res-a', CELL_X.farWest, CELL_Z.north, COLOR.building);
      buildCBD(layerGroups.buildings, CELL_X.westCenter, CELL_Z.north);
      buildResidential(layerGroups.buildings, 'res-b', CELL_X.eastCenter, CELL_Z.north, COLOR.building);
      buildPark(layerGroups.buildings, 'park-a', CELL_X.farEast, CELL_Z.north);

      buildHospital(layerGroups.buildings, CELL_X.farWest, CELL_Z.center);
      buildSolarFarm(layerGroups.electricity, 'solar-a', CELL_X.westCenter, CELL_Z.center);
      buildSolarFarm(layerGroups.electricity, 'solar-b', CELL_X.eastCenter, CELL_Z.center);
      buildSubstation(layerGroups.electricity, CELL_X.farEast, CELL_Z.center);

      buildReservoir(layerGroups.water, CELL_X.farWest, CELL_Z.south);
      buildWindFarm(layerGroups.electricity, CELL_X.westCenter, CELL_Z.south);
      buildMetro(layerGroups.transit, CELL_X.eastCenter, CELL_Z.south);
      buildPark(layerGroups.buildings, 'park-b', CELL_X.farEast, CELL_Z.south);

      buildFloodOverlay(world, CELL_X.westCenter, (CELL_Z.center + CELL_Z.south) / 2);
      buildFireSystem(world);
      heatwaveSystem = buildHeatwaveSystem(world);
      buildRainSystem(world);
      buildPollutionSystem(world);
      buildVehicles(world);
      buildTrafficLights(world);
      buildStars(world);

      raycaster = new THREE.Raycaster();
      renderer.domElement.addEventListener('click', onClick);

      ready = true;
      resize();
      requestAnimationFrame(animate);
    } catch (err) {
      showMessage(container, '<strong>3D city failed to start.</strong><br>Your browser or device may not support WebGL. (' + (err && err.message ? err.message : 'unknown error') + ')');
      ready = false;
    }
  }

  function onClick(e) {
    if (!ready) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
    const hits = raycaster.intersectObjects(selectable, true);
    if (hits.length === 0) return;
    let obj = hits[0].object;
    while (obj && !obj.userData.zoneId) obj = obj.parent;
    if (obj && obj.userData.zoneId && clickHandler) clickHandler(obj.userData.zoneId);
  }

  /* ------------------------------- loop ------------------------------------ */

  function animate(t) {
    requestAnimationFrame(animate);
    if (!ready || !tabVisible) return;
    if (controls) controls.update();
    
    // Calculate delta time for smooth animation
    const currentTime = t || 0;
    const deltaTime = lastTime ? (currentTime - lastTime) / 1000 : 0.016; // Convert to seconds
    lastTime = currentTime;
    
    const sec = (t || 0) * 0.001;
    windBlades.forEach(hub => { hub.rotation.y = sec * 1.4; });
    if (hospitalAlertActive) hospitalMaterial.emissiveIntensity = 0.4 + Math.sin(sec * 4) * 0.3;
    if (substationAlertActive) substationMaterial.emissiveIntensity = 0.4 + Math.sin(sec * 5) * 0.35;
    if (floodOverlay && floodOverlay.visible) {
      floodOverlay.position.y = floodOverlay.userData.baseY + Math.sin(sec * 0.8) * 0.08;
      floodOverlay.material.opacity = 0.32 + Math.sin(sec * 0.5) * 0.1;
    }
    updateFireParticles();
    updateHeatwaveParticles();
    updateRainParticles();
    updateTrafficLights(deltaTime);
    updateVehicles(deltaTime);

    // Smooth camera preset transition
    if (targetCamPos && targetLookAt) {
      camera.position.lerp(targetCamPos, 0.05);
      if (controls) {
        controls.target.lerp(targetLookAt, 0.05);
        controls.update();
      }
      if (camera.position.distanceTo(targetCamPos) < 0.6) {
        targetCamPos = null;
        targetLookAt = null;
      }
    }

    renderer.render(scene, camera);
  }

  function resize() {
    if (!ready || !containerEl) return;
    const w = containerEl.clientWidth || 600;
    const h = containerEl.clientHeight || Math.round(w * 0.6);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', () => { if (tabVisible) resize(); });

  /* ------------------------------ public API -------------------------------- */

  function update(viewState) {
    if (!ready || !viewState) return;

    const ts = viewState.trafficStatus || 'good';
    roadMaterial.color.set(STATUS_COLOR[ts]);
    transitMaterial.color.set(STATUS_COLOR[ts]);
    transitMaterial.emissive.set(STATUS_COLOR[ts]);

    // Show congestion indicators when traffic is critical
    const showCongestion = ts === 'critical';
    congestionMeshes.forEach(mesh => {
      mesh.visible = showCongestion;
    });

    // Update traffic status for vehicle animation
    currentTrafficStatus = ts;

    const rs = viewState.renewableStatus || 'good';
    solarMaterial.color.set(STATUS_COLOR[rs]);
    solarMaterial.emissive.set(STATUS_COLOR[rs]);
    solarMaterial.emissiveIntensity = rs === 'good' ? 0.55 : rs === 'moderate' ? 0.35 : 0.15;

    const waterPct = Math.max(2, Math.min(100, viewState.waterPct == null ? 50 : viewState.waterPct));
    const fillH = (waterPct / 100) * 7.6 + 0.3;
    reservoirFillMesh.scale.y = fillH;
    reservoirFillMesh.position.y = fillH / 2;

    hospitalAlertActive = !!viewState.hospitalAlert;
    hospitalMaterial.color.set(hospitalAlertActive ? STATUS_COLOR.critical : COLOR.textPrim);
    hospitalMaterial.emissive.set(hospitalAlertActive ? STATUS_COLOR.critical : 0x332020);
    if (!hospitalAlertActive) hospitalMaterial.emissiveIntensity = 0.15;

    const gridStatus = viewState.gridStatus || 'good';
    substationAlertActive = gridStatus === 'critical';
    substationMaterial.color.set(STATUS_COLOR[gridStatus]);
    substationMaterial.emissive.set(STATUS_COLOR[gridStatus]);
    if (!substationAlertActive) substationMaterial.emissiveIntensity = 0.4;

    // Emergency-specific visual treatments, cleared automatically when no emergency is active
    const em = viewState.activeEmergency;
    floodOverlay.visible = em === 'flood';

    if (em === 'heatwave') {
      sunLight.color.set(0xffb37a);
      sunLight.intensity = 1.3;
      scene.fog.color.set(0x2a140c);
      scene.fog.density = 0.008;
      // Show fire at a few locations during heatwave
      showFireAt(CELL_X.westCenter, CELL_Z.north);
      // Show heatwave particles
      if (heatwaveSystem) heatwaveSystem.visible = true;
    } else {
      sunLight.color.set(DEFAULT_SUN.color);
      sunLight.intensity = DEFAULT_SUN.intensity;
      scene.fog.color.set(COLOR.bg);
      scene.fog.density = 0.0048;
      hideFire();
      if (heatwaveSystem) heatwaveSystem.visible = false;
    }

    // Rain system for storms
    if (rainSystem) {
      rainSystem.visible = em === 'flood'; // Rain during flood
    }

    // Pollution based on AQI
    if (pollutionSystem) {
      const aqi = viewState.aqiValue || 100;
      pollutionSystem.visible = aqi > 150;
      if (pollutionSystem.visible) {
        pollutionSystem.material.opacity = Math.min(0.5, (aqi - 150) / 300);
      }
    }

    ambientLight.intensity = em === 'power' ? 0.38 : 0.65;

    // Apply day/night cycle
    applyDayNightCycle();
  }

  function applyDayNightCycle() {
    const time = currentTimeOfDay;
    const isNight = time < 6 || time > 18;
    const isDawn = time >= 6 && time < 8;
    const isDusk = time >= 17 && time < 19;

    // Adjust sun position and intensity based on time
    const sunAngle = ((time - 6) / 12) * Math.PI; // 0 at 6am, PI at 6pm
    const sunHeight = Math.sin(sunAngle);
    const sunProgress = Math.max(0, Math.min(1, sunHeight));

    if (time >= 6 && time <= 18) {
      // Daytime
      sunLight.intensity = 0.3 + sunProgress * 0.75;
      sunLight.position.set(
        70 * Math.cos(sunAngle),
        100 * Math.max(0.1, sunHeight),
        50
      );
      ambientLight.intensity = 0.4 + sunProgress * 0.25;
      scene.background.setHex(COLOR.bg);
      scene.fog.color.setHex(COLOR.bg);
    } else {
      // Nighttime
      sunLight.intensity = 0.05;
      sunLight.position.set(70, -20, 50);
      ambientLight.intensity = 0.15;
      scene.background.setHex(0x020408);
      scene.fog.color.setHex(0x020408);
    }

    // Adjust building window emissive at night
    buildingMaterials.forEach(mat => {
      if (mat.userData.isBuilding) {
        mat.emissiveIntensity = isNight
          ? mat.userData.nightEmissiveIntensity
          : mat.userData.baseEmissiveIntensity;
      }
    });

    // Turn streetlights on at night
    streetLights.forEach(bulb => {
      bulb.material = isNight ? bulb.userData.bulbMatOn : bulb.userData.bulbMatOff;
    });
  }

  function setTimeOfDay(hours) {
    currentTimeOfDay = hours;
    if (ready) applyDayNightCycle();
  }

  function setLayerVisible(layerName, visible) {
    if (layerGroups[layerName]) {
      layerGroups[layerName].visible = visible;
      layers[layerName] = visible;
    }
  }

  function onTabShown() { tabVisible = true; resize(); }
  function onTabHidden() { tabVisible = false; }

  function resetCamera() {
    if (!ready) return;
    targetCamPos = null;
    targetLookAt = null;
    camera.position.copy(defaultCamPos);
    if (controls) { controls.target.copy(defaultTarget); controls.update(); }
  }

  function setCameraPreset(presetName) {
    if (!ready || !CAMERA_PRESETS || !CAMERA_PRESETS[presetName]) return;
    const p = CAMERA_PRESETS[presetName];
    targetCamPos = p.pos.clone();
    targetLookAt = p.target.clone();
  }

  function setClickHandler(fn) { clickHandler = fn; }

  return { init, update, onTabShown, onTabHidden, resetCamera, setClickHandler, setTimeOfDay, setLayerVisible, setCameraPreset };
})();
