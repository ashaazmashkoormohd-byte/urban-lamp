import * as THREE from 'three';
import { PlayerState } from '../types/game';

export interface ThirdPersonCameraInstance {
  update: (delta: number, playerState: PlayerState, collisionBoxes: THREE.Box3[]) => void;
  handleMouseMove: (movementX: number, movementY: number) => void;
  handleWheel: (deltaY: number) => void;
  getYaw: () => number;
  getPitch: () => number;
  setInvertY: (invert: boolean) => void;
  setInvertX: (invert: boolean) => void;
  setSensitivity: (val: number) => void;
  dispose: () => void;
}

export function createThirdPersonCamera(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement
): ThirdPersonCameraInstance {
  // Camera spherical coordinates
  let yaw = 0;
  let pitch = 0.22; // Slightly looking down at character from above
  let targetDistance = 6.2;
  let currentDistance = 6.2;

  let invertY = false;
  let invertX = false;
  let sensitivity = 0.0024;

  const minDistance = 2.5;
  const maxDistance = 14.0;
  const minPitch = -Math.PI / 3.4; // Looking up towards sky
  const maxPitch = Math.PI / 2.8;  // Looking down from above

  const cameraTargetOffset = new THREE.Vector3(0, 1.6, 0); // Aimed at character's upper torso/head
  const currentCameraPos = new THREE.Vector3();
  const currentLookAt = new THREE.Vector3();

  // Raycaster for obstacle collision avoidance
  const raycaster = new THREE.Raycaster();

  const handleMouseMove = (movementX: number, movementY: number) => {
    // Normal mouse X: moving mouse RIGHT (movementX > 0) turns camera RIGHT (yaw increases)
    const dx = invertX ? -movementX : movementX;
    yaw += dx * sensitivity;

    // Normal mouse Y: moving mouse UP (movementY < 0) looks UP towards the sky (pitch decreases towards negative angle)
    const dy = invertY ? -movementY : movementY;
    pitch += dy * sensitivity;
    pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
  };

  const handleWheel = (deltaY: number) => {
    targetDistance += deltaY * 0.004;
    targetDistance = Math.max(minDistance, Math.min(maxDistance, targetDistance));
  };

  const update = (
    delta: number,
    playerState: PlayerState,
    collisionBoxes: THREE.Box3[]
  ) => {
    // Smooth distance zoom damping
    currentDistance += (targetDistance - currentDistance) * Math.min(1, delta * 10);

    // Target position on player
    const playerTarget = new THREE.Vector3(
      playerState.x,
      playerState.y,
      playerState.z
    ).add(cameraTargetOffset);

    // Ideal camera position based on yaw, pitch, and distance
    // In Three.js: Cam forward is (sin(yaw), 0, -cos(yaw)).
    // Camera is positioned BEHIND the character:
    // cameraOffset = -forward * horizontalDistance + (0, verticalDistance, 0)
    const horizontalDistance = currentDistance * Math.cos(pitch);
    const verticalDistance = currentDistance * Math.sin(pitch);

    const idealOffset = new THREE.Vector3(
      -Math.sin(yaw) * horizontalDistance,
      verticalDistance,
      Math.cos(yaw) * horizontalDistance
    );

    const idealCameraPos = playerTarget.clone().add(idealOffset);

    // Camera Collision Avoidance
    // Check if the ray from playerTarget to idealCameraPos hits any building collision box
    let safeDistance = currentDistance;
    const rayDir = idealCameraPos.clone().sub(playerTarget).normalize();
    const ray = new THREE.Ray(playerTarget, rayDir);

    for (let i = 0; i < collisionBoxes.length; i++) {
      const box = collisionBoxes[i];
      const hitPoint = new THREE.Vector3();
      if (ray.intersectBox(box, hitPoint)) {
        const hitDist = playerTarget.distanceTo(hitPoint) - 0.45; // Standoff cushion
        if (hitDist > 0.8 && hitDist < safeDistance) {
          safeDistance = hitDist;
        }
      }
    }

    // Recalculate camera position with safe distance
    const safeHorizontal = safeDistance * Math.cos(pitch);
    const safeVertical = safeDistance * Math.sin(pitch);
    const safePos = playerTarget.clone().add(
      new THREE.Vector3(
        -Math.sin(yaw) * safeHorizontal,
        safeVertical,
        Math.cos(yaw) * safeHorizontal
      )
    );

    // Smooth exponential damping on camera movement
    currentCameraPos.lerp(safePos, Math.min(1, delta * 14));
    currentLookAt.lerp(playerTarget, Math.min(1, delta * 16));

    camera.position.copy(currentCameraPos);
    camera.lookAt(currentLookAt);
  };

  const getYaw = () => yaw;
  const getPitch = () => pitch;
  const setInvertY = (invert: boolean) => { invertY = invert; };
  const setInvertX = (invert: boolean) => { invertX = invert; };
  const setSensitivity = (val: number) => { sensitivity = val; };
  const dispose = () => {};

  return {
    update,
    handleMouseMove,
    handleWheel,
    getYaw,
    getPitch,
    setInvertY,
    setInvertX,
    setSensitivity,
    dispose,
  };
}
