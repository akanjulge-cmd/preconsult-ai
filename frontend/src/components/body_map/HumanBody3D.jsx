import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// 26 Standard Clinical Anatomical Regions with granular zones
export const ANATOMICAL_REGIONS = [
  { id: 'head', label: 'Head & Cranium', macro: 'Head', zone: 'Whole Head', side: 'midline', view: 'front' },
  { id: 'face', label: 'Face & Sinuses', macro: 'Head', zone: 'Face & Sinuses', side: 'midline', view: 'front' },
  { id: 'neck', label: 'Neck & Cervical Spine', macro: 'Head', zone: 'Neck & Cervical', side: 'midline', view: 'front' },
  { id: 'chest', label: 'Center Mid-Chest (Breastbone)', macro: 'Chest', zone: 'Retrosternal (Mid-Chest)', side: 'midline', view: 'front' },
  { id: 'right_chest', label: 'Right Chest / Ribs', macro: 'Chest', zone: 'Right Chest', side: 'right', view: 'front' },
  { id: 'left_chest', label: 'Left Chest (Precordial / Heart)', macro: 'Chest', zone: 'Left Chest (Precordial)', side: 'left', view: 'front' },
  { id: 'epigastrium', label: 'Upper Stomach (Epigastrium)', macro: 'Abdomen', zone: 'Epigastrium', side: 'midline', view: 'front' },
  { id: 'right_upper_abdomen', label: 'Right Upper Abdomen (RUQ - Gallbladder/Liver)', macro: 'Abdomen', zone: 'Right Upper Quadrant', side: 'right', view: 'front' },
  { id: 'left_upper_abdomen', label: 'Left Upper Abdomen (LUQ - Spleen/Stomach)', macro: 'Abdomen', zone: 'Left Upper Quadrant', side: 'left', view: 'front' },
  { id: 'lower_abdomen', label: 'Lower Abdomen / Umbilical', macro: 'Abdomen', zone: 'Umbilical', side: 'midline', view: 'front' },
  { id: 'right_lower_abdomen', label: 'Right Lower Abdomen (RLQ / Appendix)', macro: 'Abdomen', zone: 'Right Lower Quadrant', side: 'right', view: 'front' },
  { id: 'left_lower_abdomen', label: 'Left Lower Abdomen (LLQ / Colon)', macro: 'Abdomen', zone: 'Left Lower Quadrant', side: 'left', view: 'front' },
  { id: 'upper_back', label: 'Upper Back & Shoulder Blades', macro: 'Back', zone: 'Upper Back & Shoulders', side: 'bilateral', view: 'back' },
  { id: 'lower_back', label: 'Lower Back (Lumbar Spine)', macro: 'Back', zone: 'Lumbar (Lower Back)', side: 'midline', view: 'back' },
  { id: 'pelvis', label: 'Pelvis & Groin', macro: 'Pelvis', zone: 'Pelvis & Groin', side: 'midline', view: 'front' },
  { id: 'right_shoulder', label: 'Right Shoulder', macro: 'Arms', zone: 'Shoulder Joint', side: 'right', view: 'front' },
  { id: 'left_shoulder', label: 'Left Shoulder', macro: 'Arms', zone: 'Shoulder Joint', side: 'left', view: 'front' },
  { id: 'right_arm', label: 'Right Arm & Elbow', macro: 'Arms', zone: 'Elbow & Forearm', side: 'right', view: 'front' },
  { id: 'left_arm', label: 'Left Arm & Elbow', macro: 'Arms', zone: 'Elbow & Forearm', side: 'left', view: 'front' },
  { id: 'right_hand', label: 'Right Hand & Wrist', macro: 'Arms', zone: 'Wrist & Hand', side: 'right', view: 'front' },
  { id: 'left_hand', label: 'Left Hand & Wrist', macro: 'Arms', zone: 'Wrist & Hand', side: 'left', view: 'front' },
  { id: 'right_thigh', label: 'Right Thigh & Hamstring', macro: 'Legs', zone: 'Thigh / Hamstring', side: 'right', view: 'front' },
  { id: 'left_thigh', label: 'Left Thigh & Hamstring', macro: 'Legs', zone: 'Thigh / Hamstring', side: 'left', view: 'front' },
  { id: 'right_knee', label: 'Right Knee Joint', macro: 'Legs', zone: 'Knee Joint', side: 'right', view: 'front' },
  { id: 'left_knee', label: 'Left Knee Joint', macro: 'Legs', zone: 'Knee Joint', side: 'left', view: 'front' },
  { id: 'right_lower_leg', label: 'Right Calf & Shin', macro: 'Legs', zone: 'Lower Leg / Calf', side: 'right', view: 'front' },
  { id: 'left_lower_leg', label: 'Left Calf & Shin', macro: 'Legs', zone: 'Lower Leg / Calf', side: 'left', view: 'front' },
  { id: 'right_foot', label: 'Right Foot & Ankle', macro: 'Legs', zone: 'Ankle & Foot', side: 'right', view: 'front' },
  { id: 'left_foot', label: 'Left Foot & Ankle', macro: 'Legs', zone: 'Ankle & Foot', side: 'left', view: 'front' },
];

// Helper to map mesh names from regional_male.glb to application region IDs
function mapNodeNameToRegion(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('hypochondriac') && n.endsWith('.r')) return 'right_upper_abdomen';
  if (n.includes('hypochondriac') && n.endsWith('.l')) return 'left_upper_abdomen';
  if (n.includes('epigastric')) return 'epigastrium';
  if (n.includes('umbilical') || n.includes('hypogastric')) return 'lower_abdomen';
  if (n.includes('inguinal') && n.endsWith('.r')) return 'right_lower_abdomen';
  if (n.includes('inguinal') && n.endsWith('.l')) return 'left_lower_abdomen';
  if (n.includes('lateral region of abdomen.r')) return 'right_upper_abdomen';
  if (n.includes('lateral region of abdomen.l')) return 'left_upper_abdomen';

  if ((n.includes('pectoral') || n.includes('thorax')) && n.endsWith('.r')) return 'right_chest';
  if ((n.includes('pectoral') || n.includes('thorax')) && n.endsWith('.l')) return 'left_chest';
  if (n.includes('presternal') || n.includes('mammary')) return 'chest';

  if (n.includes('deltoid') && n.endsWith('.r')) return 'right_shoulder';
  if (n.includes('deltoid') && n.endsWith('.l')) return 'left_shoulder';

  if ((n.includes('arm') || n.includes('forearm') || n.includes('elbow') || n.includes('cubital')) && n.endsWith('.r')) return 'right_arm';
  if ((n.includes('arm') || n.includes('forearm') || n.includes('elbow') || n.includes('cubital')) && n.endsWith('.l')) return 'left_arm';

  if ((n.includes('hand') || n.includes('palm') || n.includes('wrist')) && n.endsWith('.r')) return 'right_hand';
  if ((n.includes('hand') || n.includes('palm') || n.includes('wrist')) && n.endsWith('.l')) return 'left_hand';

  if ((n.includes('thigh') || n.includes('femoral')) && n.endsWith('.r')) return 'right_thigh';
  if ((n.includes('thigh') || n.includes('femoral')) && n.endsWith('.l')) return 'left_thigh';

  if ((n.includes('knee') || n.includes('popliteal')) && n.endsWith('.r')) return 'right_knee';
  if ((n.includes('knee') || n.includes('popliteal')) && n.endsWith('.l')) return 'left_knee';

  if (n.includes('leg') && n.endsWith('.r')) return 'right_lower_leg';
  if (n.includes('leg') && n.endsWith('.l')) return 'left_lower_leg';

  if ((n.includes('foot') || n.includes('ankle') || n.includes('heel') || n.includes('sole')) && n.endsWith('.r')) return 'right_foot';
  if ((n.includes('foot') || n.includes('ankle') || n.includes('heel') || n.includes('sole')) && n.endsWith('.l')) return 'left_foot';

  if (n.includes('scapul') || n.includes('interscapul') || n.includes('infrascapul')) return 'upper_back';
  if (n.includes('lumbar') || n.includes('vertebral')) return 'lower_back';

  if (n.includes('frontal') || n.includes('parietal') || n.includes('occipital') || n.includes('hairs of head')) return 'head';
  if (n.includes('buccal') || n.includes('nasal') || n.includes('oral') || n.includes('mental') || n.includes('orbital')) return 'face';
  if (n.includes('neck') || n.includes('sternocleidomastoid') || n.includes('carotid')) return 'neck';

  if (n.includes('hip') || n.includes('gluteal') || n.includes('pubic') || n.includes('sacral') || n.includes('urogenital')) return 'pelvis';

  return null;
}

export default function HumanBody3D({
  selectedRegionId = null,
  onSelectRegion,
  confirmedLocations = [],
  reducedMotion = false,
}) {
  const mountRef = useRef(null);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [floatingLabel, setFloatingLabel] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Three.js internal references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshesMapRef = useRef(new Map());
  const bodyGroupRef = useRef(null);

  // Interaction controls
  const isDraggingRef = useRef(false);
  const previousMousePosRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0 });
  const currentRotationRef = useRef({ x: 0, y: 0 });
  const targetZoomRef = useRef(7.2);
  const currentZoomRef = useRef(7.2);
  const animFrameIdRef = useRef(null);

  // Pristine Clinical Medical Materials
  const materials = useMemo(() => {
    return {
      base: new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // Slate-400 clean anatomical skin
        roughness: 0.45,
        metalness: 0.15,
        emissive: 0x1e293b,
        emissiveIntensity: 0.08,
      }),
      hover: new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Clinical medical blue
        roughness: 0.25,
        metalness: 0.2,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.55,
      }),
      selected: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.18,
        metalness: 0.3,
        emissive: 0x06b6d4, // Glowing cyan/teal
        emissiveIntensity: 0.9,
      }),
      confirmed: new THREE.MeshStandardMaterial({
        color: 0x059669,
        roughness: 0.25,
        metalness: 0.2,
        emissive: 0x10b981,
        emissiveIntensity: 0.7,
      }),
    };
  }, []);

  // Set Camera View Preset
  const handleSetView = useCallback((viewName) => {
    if (reducedMotion) {
      if (viewName === 'front') targetRotationRef.current = { x: 0, y: 0 };
      if (viewName === 'back') targetRotationRef.current = { x: Math.PI, y: 0 };
      if (viewName === 'left') targetRotationRef.current = { x: -Math.PI / 2, y: 0 };
      if (viewName === 'right') targetRotationRef.current = { x: Math.PI / 2, y: 0 };
      if (viewName === 'reset') {
        targetRotationRef.current = { x: 0, y: 0 };
        targetZoomRef.current = 7.2;
      }
      currentRotationRef.current = { ...targetRotationRef.current };
      currentZoomRef.current = targetZoomRef.current;
      return;
    }

    if (viewName === 'front') targetRotationRef.current = { x: 0, y: 0 };
    else if (viewName === 'back') targetRotationRef.current = { x: Math.PI, y: 0 };
    else if (viewName === 'left') targetRotationRef.current = { x: -Math.PI / 2, y: 0 };
    else if (viewName === 'right') targetRotationRef.current = { x: Math.PI / 2, y: 0 };
    else if (viewName === 'reset') {
      targetRotationRef.current = { x: 0, y: 0 };
      targetZoomRef.current = 7.2;
    }
  }, [reducedMotion]);

  // Three.js Scene Setup & Model Ingestion
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 540;
    const height = mount.clientHeight || 560;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Crisp calm light slate canvas
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, targetZoomRef.current);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and soft shadow map
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Clinical Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(5, 8, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.9);
    fillLight.position.set(-5, 6, 6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(0, 6, -6);
    scene.add(rimLight);

    // Floor contact shadow disc
    const floorGeo = new THREE.CircleGeometry(2.4, 32);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.12,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -3.4;
    scene.add(floorMesh);

    // 5. Body Group
    const bodyGroup = new THREE.Group();
    scene.add(bodyGroup);
    bodyGroupRef.current = bodyGroup;
    meshesMapRef.current.clear();

    // 6. Ingest GLTF 3D Anatomical Asset
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(
      '/models/human_anatomy.glb',
      (gltf) => {
        const root = gltf.scene;

        // Compute model bounding box to scale & center precisely
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Normalize height to ~6.4 units
        const scaleFactor = 6.4 / Math.max(size.y, 0.01);
        root.scale.setScalar(scaleFactor);
        root.position.x = -center.x * scaleFactor;
        root.position.y = -center.y * scaleFactor - 0.2;
        root.position.z = -center.z * scaleFactor;

        // Map anatomical nodes
        root.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            node.material = materials.base.clone();

            const mappedId = mapNodeNameToRegion(node.name);
            if (mappedId) {
              node.userData.regionId = mappedId;
              if (!meshesMapRef.current.has(mappedId)) {
                meshesMapRef.current.set(mappedId, []);
              }
              meshesMapRef.current.get(mappedId).push(node);
            }
          }
        });

        bodyGroup.add(root);
        setModelLoaded(true);
      },
      undefined,
      (err) => {
        console.warn('GLTF Model load note (falling back to procedural medical geometry):', err);
        createProceduralMedicalAnatomy(bodyGroup, materials, meshesMapRef.current);
        setModelLoaded(true);
      }
    );

    // Fallback procedural anatomy if GLB is delayed
    function createProceduralMedicalAnatomy(group, mats, map) {
      function addPart(id, geo, pos, scale = [1, 1, 1]) {
        const mesh = new THREE.Mesh(geo, mats.base.clone());
        mesh.position.set(...pos);
        mesh.scale.set(...scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.regionId = id;
        group.add(mesh);
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(mesh);
        return mesh;
      }

      // Head, Neck, Chest, Abdominal quadrants, Extremities
      addPart('head', new THREE.SphereGeometry(0.5, 24, 24), [0, 2.7, 0], [1, 1.25, 1.1]);
      addPart('face', new THREE.BoxGeometry(0.55, 0.65, 0.35), [0, 2.5, 0.4]);
      addPart('neck', new THREE.CylinderGeometry(0.24, 0.28, 0.45, 20), [0, 2.0, 0]);
      addPart('right_chest', new THREE.BoxGeometry(0.55, 0.75, 0.55), [-0.35, 1.45, 0.05]);
      addPart('left_chest', new THREE.BoxGeometry(0.55, 0.75, 0.55), [0.35, 1.45, 0.05]);
      addPart('chest', new THREE.BoxGeometry(0.3, 0.75, 0.58), [0, 1.45, 0.06]);
      addPart('epigastrium', new THREE.BoxGeometry(0.4, 0.45, 0.5), [0, 0.85, 0.05]);
      addPart('right_upper_abdomen', new THREE.BoxGeometry(0.5, 0.45, 0.5), [-0.45, 0.85, 0.05]);
      addPart('left_upper_abdomen', new THREE.BoxGeometry(0.5, 0.45, 0.5), [0.45, 0.85, 0.05]);
      addPart('lower_abdomen', new THREE.BoxGeometry(0.45, 0.45, 0.5), [0, 0.38, 0.05]);
      addPart('right_lower_abdomen', new THREE.BoxGeometry(0.45, 0.45, 0.5), [-0.45, 0.38, 0.05]);
      addPart('left_lower_abdomen', new THREE.BoxGeometry(0.45, 0.45, 0.5), [0.45, 0.38, 0.05]);
      addPart('pelvis', new THREE.CylinderGeometry(0.65, 0.55, 0.55, 24), [0, -0.15, 0]);

      // Arms & Shoulders
      addPart('right_shoulder', new THREE.SphereGeometry(0.3, 16, 16), [-0.95, 1.7, 0]);
      addPart('left_shoulder', new THREE.SphereGeometry(0.3, 16, 16), [0.95, 1.7, 0]);
      addPart('right_arm', new THREE.CylinderGeometry(0.18, 0.15, 1.3, 16), [-1.15, 0.95, 0]);
      addPart('left_arm', new THREE.CylinderGeometry(0.18, 0.15, 1.3, 16), [1.15, 0.95, 0]);
      addPart('right_hand', new THREE.BoxGeometry(0.22, 0.38, 0.15), [-1.2, 0.1, 0]);
      addPart('left_hand', new THREE.BoxGeometry(0.22, 0.38, 0.15), [1.2, 0.1, 0]);

      // Legs
      addPart('right_thigh', new THREE.CylinderGeometry(0.32, 0.25, 1.4, 20), [-0.45, -1.15, 0]);
      addPart('left_thigh', new THREE.CylinderGeometry(0.32, 0.25, 1.4, 20), [0.45, -1.15, 0]);
      addPart('right_knee', new THREE.SphereGeometry(0.24, 16, 16), [-0.45, -1.95, 0.05]);
      addPart('left_knee', new THREE.SphereGeometry(0.24, 16, 16), [0.45, -1.95, 0.05]);
      addPart('right_lower_leg', new THREE.CylinderGeometry(0.22, 0.18, 1.35, 16), [-0.45, -2.7, 0]);
      addPart('left_lower_leg', new THREE.CylinderGeometry(0.22, 0.18, 1.35, 16), [0.45, -2.7, 0]);
      addPart('right_foot', new THREE.BoxGeometry(0.25, 0.2, 0.65), [-0.45, -3.4, 0.15]);
      addPart('left_foot', new THREE.BoxGeometry(0.25, 0.2, 0.65), [0.45, -3.4, 0.15]);

      // Back
      addPart('upper_back', new THREE.BoxGeometry(1.2, 0.75, 0.25), [0, 1.45, -0.25]);
      addPart('lower_back', new THREE.BoxGeometry(1.0, 0.85, 0.25), [0, 0.65, -0.25]);
    }

    // 7. Interactive Animation Loop with Smooth Interpolation
    let lastTime = performance.now();
    const animate = (time) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Auto-rotation when toggled
      if (autoRotate && !isDraggingRef.current) {
        targetRotationRef.current.x += 0.008;
      }

      // Smooth camera interpolation
      const damp = reducedMotion ? 1.0 : Math.min(1.0, delta * 12);
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * damp;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * damp;
      currentZoomRef.current += (targetZoomRef.current - currentZoomRef.current) * damp;

      if (bodyGroupRef.current) {
        bodyGroupRef.current.rotation.y = currentRotationRef.current.x;
        bodyGroupRef.current.rotation.x = currentRotationRef.current.y;
      }

      if (cameraRef.current) {
        cameraRef.current.position.z = currentZoomRef.current;
      }

      renderer.render(scene, camera);
    };
    animFrameIdRef.current = requestAnimationFrame(animate);

    // 8. Resize Observer
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current?.domElement && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, [materials, reducedMotion, autoRotate]);

  // Update Mesh Highlight State on Selection or Hover Change
  useEffect(() => {
    const meshesMap = meshesMapRef.current;
    if (!meshesMap) return;

    meshesMap.forEach((meshList, regionId) => {
      const isSelected = selectedRegionId === regionId;
      const isHovered = hoveredRegion === regionId;
      const isConfirmed = confirmedLocations.some(
        (loc) => loc.region === regionId || loc.id === regionId
      );

      let targetMat = materials.base;
      if (isSelected) targetMat = materials.selected;
      else if (isConfirmed) targetMat = materials.confirmed;
      else if (isHovered) targetMat = materials.hover;

      meshList.forEach((m) => {
        if (m && m.material) {
          m.material.color.copy(targetMat.color);
          m.material.emissive.copy(targetMat.emissive);
          m.material.emissiveIntensity = targetMat.emissiveIntensity;
        }
      });
    });

    // Update floating label when a region is selected
    if (selectedRegionId) {
      const reg = ANATOMICAL_REGIONS.find((r) => r.id === selectedRegionId);
      if (reg) {
        setFloatingLabel(reg.label.toUpperCase());
      }
    }
  }, [selectedRegionId, hoveredRegion, confirmedLocations, materials]);

  // Raycasting Helper
  const getIntersections = useCallback((event) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return [];
    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const checkList = [];
    meshesMapRef.current.forEach((meshList) => {
      meshList.forEach((m) => checkList.push(m));
    });

    return raycaster.intersectObjects(checkList, true);
  }, []);

  // Mouse & Touch Drag Rotation Event Handlers
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    previousMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (isDraggingRef.current) {
      const deltaX = e.clientX - previousMousePosRef.current.x;
      const deltaY = e.clientY - previousMousePosRef.current.y;
      previousMousePosRef.current = { x: e.clientX, y: e.clientY };

      targetRotationRef.current.x += deltaX * 0.009;
      // Clamp vertical pitch between -35deg and +35deg
      targetRotationRef.current.y = Math.max(-0.6, Math.min(0.6, targetRotationRef.current.y + deltaY * 0.008));
    } else {
      // Raycasting hover check
      const hits = getIntersections(e);
      if (hits.length > 0) {
        let obj = hits[0].object;
        let rId = obj.userData?.regionId;
        while (!rId && obj.parent && obj.parent !== sceneRef.current) {
          obj = obj.parent;
          rId = obj.userData?.regionId;
        }
        if (rId && rId !== hoveredRegion) {
          setHoveredRegion(rId);
        }
      } else {
        if (hoveredRegion !== null) setHoveredRegion(null);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
  };

  // Click / Tap on 3D Model
  const handleClick = (e) => {
    const hits = getIntersections(e);
    if (hits.length > 0) {
      let obj = hits[0].object;
      let rId = obj.userData?.regionId;
      while (!rId && obj.parent && obj.parent !== sceneRef.current) {
        obj = obj.parent;
        rId = obj.userData?.regionId;
      }
      if (rId) {
        const regionObj = ANATOMICAL_REGIONS.find((r) => r.id === rId);
        if (regionObj && onSelectRegion) {
          onSelectRegion(regionObj);
          setFloatingLabel(regionObj.label.toUpperCase());
        }
      }
    }
  };

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.006;
    targetZoomRef.current = Math.max(4.5, Math.min(13.0, targetZoomRef.current + zoomDelta));
  };

  // Zoom Button Controls
  const handleZoomIn = () => {
    targetZoomRef.current = Math.max(4.5, targetZoomRef.current - 1.2);
  };
  const handleZoomOut = () => {
    targetZoomRef.current = Math.min(13.0, targetZoomRef.current + 1.2);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
      {/* 3D Viewport Box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '680px',
          height: '560px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
          borderRadius: '24px',
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onWheel={handleWheel}
      >
        {/* Three.js Canvas Container */}
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {/* Floating Region Label (When Selected or Hovered) */}
        {floatingLabel && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1.5px solid #0284c7',
              borderRadius: '9999px',
              padding: '0.45rem 1.25rem',
              color: '#0f172a',
              fontSize: '0.9rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.2)',
              pointerEvents: 'none',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7' }}></span>
            <span>{floatingLabel}</span>
          </div>
        )}

        {/* Interactive Controls Overlay Toolbar (Top Left) */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="secondary"
            onClick={() => setAutoRotate(!autoRotate)}
            style={{
              minHeight: '36px',
              minWidth: '36px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
              background: autoRotate ? '#eff6ff' : '#ffffff',
              borderColor: autoRotate ? '#0284c7' : '#e2e8f0',
              color: autoRotate ? '#0284c7' : '#334155',
            }}
            title="Toggle Auto Rotation"
          >
            ↻ Rotate
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleZoomIn}
            style={{
              minHeight: '36px',
              minWidth: '36px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.95rem',
              borderRadius: '8px',
            }}
            title="Zoom In"
          >
            ＋ Zoom
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleZoomOut}
            style={{
              minHeight: '36px',
              minWidth: '36px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.95rem',
              borderRadius: '8px',
            }}
            title="Zoom Out"
          >
            − Zoom
          </button>
        </div>

        {/* Camera Views Preset Toolbar (Top Right) */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            gap: '0.35rem',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {['Front', 'Back', 'Left', 'Right', 'Reset'].map((v) => (
            <button
              key={v}
              type="button"
              className="secondary"
              onClick={() => handleSetView(v.toLowerCase())}
              style={{
                minHeight: '34px',
                minWidth: 'auto',
                padding: '0.3rem 0.65rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '8px',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Bottom Interaction Guide Hint */}
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#64748b',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.85)',
            padding: '0.25rem 0.85rem',
            borderRadius: '9999px',
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          🖱️ Drag to rotate 360° &bull; Scroll to zoom &bull; Click any body area to select
        </div>
      </div>

      {/* Accessible "Choose from list instead" Dropdown & Hackathon Shortcuts */}
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label htmlFor="accessible-body-select" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
            ♿ Prefer a list? Choose from body areas directly:
          </label>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>26 clinical zones mapped</span>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            id="accessible-body-select"
            value={selectedRegionId || ''}
            onChange={(e) => {
              const regObj = ANATOMICAL_REGIONS.find((r) => r.id === e.target.value);
              if (regObj && onSelectRegion) {
                onSelectRegion(regObj);
                setFloatingLabel(regObj.label.toUpperCase());
                if (regObj.view) handleSetView(regObj.view);
              }
            }}
            style={{
              flex: 1,
              minWidth: '240px',
              minHeight: '44px',
              background: '#ffffff',
              color: '#0f172a',
              border: '1.5px solid #cbd5e1',
              borderRadius: '10px',
              padding: '0.5rem 0.85rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">-- Choose Anatomical Region from List --</option>
            <optgroup label="Head & Neck">
              <option value="head">Head & Cranium</option>
              <option value="face">Face & Sinuses</option>
              <option value="neck">Neck & Cervical Spine</option>
            </optgroup>
            <optgroup label="Chest & Thorax">
              <option value="chest">Center Mid-Chest (Breastbone)</option>
              <option value="right_chest">Right Chest / Ribs</option>
              <option value="left_chest">Left Chest (Precordial / Heart)</option>
            </optgroup>
            <optgroup label="Abdomen (4 Quadrants & Epigastrium)">
              <option value="right_upper_abdomen">Right Upper Abdomen (RUQ - Gallbladder/Liver)</option>
              <option value="left_upper_abdomen">Left Upper Abdomen (LUQ - Spleen/Stomach)</option>
              <option value="epigastrium">Upper Stomach (Epigastrium)</option>
              <option value="lower_abdomen">Lower Abdomen / Umbilical</option>
              <option value="right_lower_abdomen">Right Lower Abdomen (RLQ / Appendix)</option>
              <option value="left_lower_abdomen">Left Lower Abdomen (LLQ / Colon)</option>
            </optgroup>
            <optgroup label="Back & Spine">
              <option value="upper_back">Upper Back & Shoulder Blades</option>
              <option value="lower_back">Lower Back (Lumbar Spine)</option>
              <option value="pelvis">Pelvis & Groin</option>
            </optgroup>
            <optgroup label="Upper Extremities (Arms & Hands)">
              <option value="right_shoulder">Right Shoulder</option>
              <option value="left_shoulder">Left Shoulder</option>
              <option value="right_arm">Right Arm & Elbow</option>
              <option value="left_arm">Left Arm & Elbow</option>
              <option value="right_hand">Right Hand & Wrist</option>
              <option value="left_hand">Left Hand & Wrist</option>
            </optgroup>
            <optgroup label="Lower Extremities (Legs & Feet)">
              <option value="right_thigh">Right Thigh & Hamstring</option>
              <option value="left_thigh">Left Thigh & Hamstring</option>
              <option value="right_knee">Right Knee Joint</option>
              <option value="left_knee">Left Knee Joint</option>
              <option value="right_lower_leg">Right Calf & Shin</option>
              <option value="left_lower_leg">Left Calf & Shin</option>
              <option value="right_foot">Right Foot & Ankle</option>
              <option value="left_foot">Left Foot & Ankle</option>
            </optgroup>
          </select>

          {/* Hackathon Judge 1-Click Scenario Shortcuts */}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const ruq = ANATOMICAL_REGIONS.find((r) => r.id === 'right_upper_abdomen');
              if (onSelectRegion && ruq) onSelectRegion(ruq);
              setFloatingLabel('RIGHT UPPER ABDOMEN');
              handleSetView('front');
            }}
            style={{
              padding: '0.4rem 0.85rem',
              minHeight: '44px',
              fontSize: '0.82rem',
              borderColor: '#0284c7',
              color: '#0284c7',
              fontWeight: 800,
              background: '#f0f9ff',
            }}
            title="Select Right Upper Abdomen (Scenario A Routine)"
          >
            ⚡ Scenario A: RUQ Abdomen
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const leftChest = ANATOMICAL_REGIONS.find((r) => r.id === 'left_chest');
              if (onSelectRegion && leftChest) onSelectRegion(leftChest);
              setFloatingLabel('LEFT PRECORDIAL CHEST');
              handleSetView('front');
            }}
            style={{
              padding: '0.4rem 0.85rem',
              minHeight: '44px',
              fontSize: '0.82rem',
              borderColor: '#e11d48',
              color: '#e11d48',
              fontWeight: 800,
              background: '#fff1f2',
            }}
            title="Select Left Chest (Scenario B Red-Flag)"
          >
            🚨 Scenario B: Left Chest
          </button>
        </div>
      </div>
    </div>
  );
}
