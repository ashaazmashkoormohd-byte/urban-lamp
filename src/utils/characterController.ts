import * as THREE from 'three';
import { PlayerControls, PlayerState } from '../types/game';
import { soundFx } from './audio';

export interface CharacterControllerInstance {
  group: THREE.Group;
  state: PlayerState;
  update: (delta: number, controls: PlayerControls, cameraYaw: number, collisionBoxes: THREE.Box3[]) => void;
  setPosition: (x: number, y: number, z: number) => void;
  dispose: () => void;
}

export function createCharacterController(): CharacterControllerInstance {
  const group = new THREE.Group();

  // Materials for Cybernetic Field Engineer with Exoskeleton Suit
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25,
  });

  const undersuitMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.8,
    metalness: 0.2,
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.2,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x28d9ec,
    emissive: 0x28d9ec,
    emissiveIntensity: 1.5,
    roughness: 0.1,
    metalness: 0.9,
  });

  const coreReactorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.8,
    roughness: 0.1,
  });

  const thrusterFlameMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.9,
  });

  // Reusable Box & Cylinder geometries
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

  // 1. Pelvis / Waist
  const pelvis = new THREE.Group();
  pelvis.position.y = 1.0;
  const pelvisMesh = new THREE.Mesh(boxGeo, armorMat);
  pelvisMesh.scale.set(0.65, 0.35, 0.45);
  pelvisMesh.castShadow = true;
  pelvis.add(pelvisMesh);

  // Belt & Utility packs
  const beltMesh = new THREE.Mesh(boxGeo, goldTrimMat);
  beltMesh.scale.set(0.72, 0.1, 0.5);
  pelvis.add(beltMesh);

  // 2. Torso & Chest Plate
  const torso = new THREE.Group();
  torso.position.y = 0.3;
  const torsoChest = new THREE.Mesh(boxGeo, armorMat);
  torsoChest.scale.set(0.85, 0.75, 0.55);
  torsoChest.position.y = 0.35;
  torsoChest.castShadow = true;
  torso.add(torsoChest);

  // Undersuit abdomen
  const abdomen = new THREE.Mesh(boxGeo, undersuitMat);
  abdomen.scale.set(0.6, 0.3, 0.45);
  abdomen.position.y = -0.05;
  torso.add(abdomen);

  // Glowing Plasma Arc Reactor Core
  const reactorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), coreReactorMat);
  reactorCore.rotation.x = Math.PI / 2;
  reactorCore.position.set(0, 0.4, 0.3);
  torso.add(reactorCore);

  // Backpack Jet Thrusters
  const jetpack = new THREE.Mesh(boxGeo, armorMat);
  jetpack.scale.set(0.6, 0.65, 0.3);
  jetpack.position.set(0, 0.4, -0.38);
  torso.add(jetpack);

  // Dual Thruster Nozzles & Exhaust Flame
  const leftNozzle = new THREE.Mesh(cylGeo, goldTrimMat);
  leftNozzle.scale.set(0.16, 0.25, 0.16);
  leftNozzle.position.set(-0.2, 0.05, -0.4);
  torso.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(cylGeo, goldTrimMat);
  rightNozzle.scale.set(0.16, 0.25, 0.16);
  rightNozzle.position.set(0.2, 0.05, -0.4);
  torso.add(rightNozzle);

  const leftFlame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), thrusterFlameMat);
  leftFlame.rotation.x = Math.PI;
  leftFlame.position.set(-0.2, -0.2, -0.4);
  leftFlame.visible = false;
  torso.add(leftFlame);

  const rightFlame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), thrusterFlameMat);
  rightFlame.rotation.x = Math.PI;
  rightFlame.position.set(0.2, -0.2, -0.4);
  rightFlame.visible = false;
  torso.add(rightFlame);

  // 3. Head & Tactical Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.85, 0);

  const helmet = new THREE.Mesh(boxGeo, armorMat);
  helmet.scale.set(0.44, 0.48, 0.46);
  helmet.castShadow = true;
  headGroup.add(helmet);

  const visor = new THREE.Mesh(boxGeo, visorMat);
  visor.scale.set(0.4, 0.18, 0.15);
  visor.position.set(0, 0.04, 0.22);
  headGroup.add(visor);

  // Antenna
  const antenna = new THREE.Mesh(cylGeo, goldTrimMat);
  antenna.scale.set(0.04, 0.35, 0.04);
  antenna.position.set(-0.2, 0.32, -0.1);
  headGroup.add(antenna);

  torso.add(headGroup);
  pelvis.add(torso);

  // 4. Arms
  // Left Arm
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.54, 0.65, 0);

  const leftShoulder = new THREE.Mesh(boxGeo, goldTrimMat);
  leftShoulder.scale.set(0.3, 0.28, 0.34);
  leftArmGroup.add(leftShoulder);

  const leftUpperArm = new THREE.Mesh(boxGeo, armorMat);
  leftUpperArm.scale.set(0.22, 0.42, 0.22);
  leftUpperArm.position.y = -0.28;
  leftArmGroup.add(leftUpperArm);

  const leftForearm = new THREE.Mesh(boxGeo, undersuitMat);
  leftForearm.scale.set(0.2, 0.4, 0.2);
  leftForearm.position.y = -0.65;
  leftArmGroup.add(leftForearm);

  const leftHand = new THREE.Mesh(boxGeo, goldTrimMat);
  leftHand.scale.set(0.15, 0.18, 0.22);
  leftHand.position.y = -0.9;
  leftArmGroup.add(leftHand);

  torso.add(leftArmGroup);

  // Right Arm
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.54, 0.65, 0);

  const rightShoulder = new THREE.Mesh(boxGeo, goldTrimMat);
  rightShoulder.scale.set(0.3, 0.28, 0.34);
  rightArmGroup.add(rightShoulder);

  const rightUpperArm = new THREE.Mesh(boxGeo, armorMat);
  rightUpperArm.scale.set(0.22, 0.42, 0.22);
  rightUpperArm.position.y = -0.28;
  rightArmGroup.add(rightUpperArm);

  const rightForearm = new THREE.Mesh(boxGeo, undersuitMat);
  rightForearm.scale.set(0.2, 0.4, 0.2);
  rightForearm.position.y = -0.65;
  rightArmGroup.add(rightForearm);

  const rightHand = new THREE.Mesh(boxGeo, goldTrimMat);
  rightHand.scale.set(0.15, 0.18, 0.22);
  rightHand.position.y = -0.9;
  rightArmGroup.add(rightHand);

  torso.add(rightArmGroup);

  // 5. Legs
  // Left Leg
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.22, 0, 0);

  const leftThigh = new THREE.Mesh(boxGeo, armorMat);
  leftThigh.scale.set(0.26, 0.48, 0.28);
  leftThigh.position.y = -0.26;
  leftThigh.castShadow = true;
  leftLegGroup.add(leftThigh);

  const leftShin = new THREE.Mesh(boxGeo, undersuitMat);
  leftShin.scale.set(0.24, 0.46, 0.26);
  leftShin.position.y = -0.68;
  leftShin.castShadow = true;
  leftLegGroup.add(leftShin);

  const leftBoot = new THREE.Mesh(boxGeo, goldTrimMat);
  leftBoot.scale.set(0.26, 0.2, 0.44);
  leftBoot.position.set(0, -0.92, 0.08);
  leftBoot.castShadow = true;
  leftLegGroup.add(leftBoot);

  pelvis.add(leftLegGroup);

  // Right Leg
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.22, 0, 0);

  const rightThigh = new THREE.Mesh(boxGeo, armorMat);
  rightThigh.scale.set(0.26, 0.48, 0.28);
  rightThigh.position.y = -0.26;
  rightThigh.castShadow = true;
  rightLegGroup.add(rightThigh);

  const rightShin = new THREE.Mesh(boxGeo, undersuitMat);
  rightShin.scale.set(0.24, 0.46, 0.26);
  rightShin.position.y = -0.68;
  rightShin.castShadow = true;
  rightLegGroup.add(rightShin);

  const rightBoot = new THREE.Mesh(boxGeo, goldTrimMat);
  rightBoot.scale.set(0.26, 0.2, 0.44);
  rightBoot.position.set(0, -0.92, 0.08);
  rightBoot.castShadow = true;
  rightLegGroup.add(rightBoot);

  pelvis.add(rightLegGroup);

  group.add(pelvis);

  // Contact Shadow disk below character
  const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.4,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);

  // State & Physics variables
  const state: PlayerState = {
    x: 0,
    y: 0,
    z: 14,
    yaw: Math.PI, // Facing forward towards North (-Z) into the city
    isGrounded: true,
    isSprinting: false,
    isMoving: false,
    actionState: 'idle',
  };

  let velocityY = 0;
  const gravity = -28;
  const walkSpeed = 9.5;
  const sprintSpeed = 16.5;
  const jumpForce = 11.5;

  let animCycle = 0;
  let footstepTimer = 0;

  // Collision helper against Box3
  const playerRadius = 0.55;
  const playerHeight = 1.95;

  const checkCollision = (testX: number, testZ: number, collisionBoxes: THREE.Box3[]): boolean => {
    // City boundary check (-110 to 110 on X, -90 to 90 on Z)
    if (Math.abs(testX) > 105 || Math.abs(testZ) > 85) return true;

    const playerBox = new THREE.Box3(
      new THREE.Vector3(testX - playerRadius, state.y + 0.1, testZ - playerRadius),
      new THREE.Vector3(testX + playerRadius, state.y + playerHeight, testZ + playerRadius)
    );

    for (let i = 0; i < collisionBoxes.length; i++) {
      if (playerBox.intersectsBox(collisionBoxes[i])) {
        return true;
      }
    }
    return false;
  };

  const update = (
    delta: number,
    controls: PlayerControls,
    cameraYaw: number,
    collisionBoxes: THREE.Box3[]
  ) => {
    // Calculate movement vector relative to camera yaw
    let moveForward = 0;
    let moveRight = 0;

    if (controls.forward) moveForward += 1;
    if (controls.backward) moveForward -= 1;
    if (controls.right) moveRight += 1;
    if (controls.left) moveRight -= 1;

    const isMoving = moveForward !== 0 || moveRight !== 0;
    const isSprinting = isMoving && controls.sprint;
    const speed = isSprinting ? sprintSpeed : walkSpeed;

    state.isMoving = isMoving;
    state.isSprinting = isSprinting;

    // Movement direction in world coordinates relative to camera orientation
    let targetYaw = state.yaw;

    if (isMoving) {
      // Normalize directional inputs so diagonals don't move faster
      const inputLength = Math.hypot(moveForward, moveRight);
      const normForward = moveForward / inputLength;
      const normRight = moveRight / inputLength;

      // In Three.js world space:
      // Camera forward vector in horizontal plane: (sin(cameraYaw), 0, -cos(cameraYaw))
      // Camera right vector in horizontal plane: (cos(cameraYaw), 0, sin(cameraYaw))
      const moveDirX = Math.sin(cameraYaw) * normForward + Math.cos(cameraYaw) * normRight;
      const moveDirZ = -Math.cos(cameraYaw) * normForward + Math.sin(cameraYaw) * normRight;

      // Character 3D model native forward is +Z (0, 0, 1).
      // When rotated by rotation.y = rotY, (0, 0, 1) becomes (sin(rotY), cos(rotY)).
      // Align character model rotation to the movement direction:
      targetYaw = Math.atan2(moveDirX, moveDirZ);

      // Smooth turn interpolation
      const diff = THREE.MathUtils.euclideanModulo(targetYaw - state.yaw + Math.PI, Math.PI * 2) - Math.PI;
      state.yaw += diff * Math.min(1, delta * 14);

      const vx = moveDirX * speed;
      const vz = moveDirZ * speed;

      const newX = state.x + vx * delta;
      const newZ = state.z + vz * delta;

      // Independent axis collision resolution (allows smooth sliding along walls)
      if (!checkCollision(newX, state.z, collisionBoxes)) {
        state.x = newX;
      }
      if (!checkCollision(state.x, newZ, collisionBoxes)) {
        state.z = newZ;
      }

      // Footstep sound triggering
      footstepTimer += delta * (isSprinting ? 2.5 : 1.7);
      if (footstepTimer >= 0.7 && state.isGrounded) {
        soundFx.playFootstep();
        footstepTimer = 0;
      }
    }

    // Vertical Physics (Jump & Gravity)
    if (controls.jump && state.isGrounded) {
      velocityY = jumpForce;
      state.isGrounded = false;
      soundFx.playJump();
    }

    if (!state.isGrounded) {
      velocityY += gravity * delta;
      state.y += velocityY * delta;

      if (state.y <= 0) {
        state.y = 0;
        velocityY = 0;
        state.isGrounded = true;
      }
    }

    // Thruster visual effects
    const showJets = !state.isGrounded || isSprinting;
    leftFlame.visible = showJets;
    rightFlame.visible = showJets;
    if (showJets) {
      const flicker = 0.8 + Math.random() * 0.4;
      leftFlame.scale.set(flicker, flicker, flicker);
      rightFlame.scale.set(flicker, flicker, flicker);
    }

    // Determine Action State
    if (!state.isGrounded) {
      state.actionState = 'jumping';
    } else if (isSprinting) {
      state.actionState = 'running';
    } else if (isMoving) {
      state.actionState = 'walking';
    } else {
      state.actionState = 'idle';
    }

    // Animation Blending
    if (state.actionState === 'walking' || state.actionState === 'running') {
      const pace = state.actionState === 'running' ? 14 : 8;
      animCycle += delta * pace;

      const swing = Math.sin(animCycle);
      leftLegGroup.rotation.x = swing * 0.65;
      rightLegGroup.rotation.x = -swing * 0.65;

      leftArmGroup.rotation.x = -swing * 0.6;
      rightArmGroup.rotation.x = swing * 0.6;

      // Slight torso bob
      torso.position.y = 0.3 + Math.abs(Math.sin(animCycle * 2)) * 0.05;
      torso.rotation.x = state.actionState === 'running' ? 0.2 : 0.08;
    } else if (state.actionState === 'jumping') {
      leftLegGroup.rotation.x = -0.3;
      rightLegGroup.rotation.x = -0.5;
      leftArmGroup.rotation.x = 0.6;
      rightArmGroup.rotation.x = 0.6;
      torso.rotation.x = 0.15;
    } else {
      // Idle Breathing
      animCycle += delta * 2;
      leftLegGroup.rotation.x = 0;
      rightLegGroup.rotation.x = 0;
      leftArmGroup.rotation.x = Math.sin(animCycle) * 0.05;
      rightArmGroup.rotation.x = -Math.sin(animCycle) * 0.05;
      torso.position.y = 0.3 + Math.sin(animCycle) * 0.02;
      torso.rotation.x = 0;
    }

    // Update Transform of Mesh Group
    group.position.set(state.x, state.y, state.z);
    group.rotation.y = state.yaw;

    // Contact shadow opacity based on height
    shadowMesh.material.opacity = Math.max(0.08, 0.45 - state.y * 0.12);
  };

  const setPosition = (x: number, y: number, z: number) => {
    state.x = x;
    state.y = y;
    state.z = z;
    group.position.set(x, y, z);
  };

  const dispose = () => {
    armorMat.dispose();
    undersuitMat.dispose();
    goldTrimMat.dispose();
    visorMat.dispose();
    coreReactorMat.dispose();
    thrusterFlameMat.dispose();
    shadowMat.dispose();
  };

  return {
    group,
    state,
    update,
    setPosition,
    dispose,
  };
}
