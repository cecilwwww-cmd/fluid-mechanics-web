const stage = document.getElementById("threeStage");

const controls = {
  boomStroke: document.getElementById("boomStroke"),
  armStroke: document.getElementById("armStroke"),
  bucketStroke: document.getElementById("bucketStroke"),
  pushSpeed: document.getElementById("pushSpeed"),
  inputDiameter: document.getElementById("inputDiameter"),
  outputDiameter: document.getElementById("outputDiameter"),
  tubeLength: document.getElementById("tubeLength"),
  airBubble: document.getElementById("airBubble"),
  friction: document.getElementById("friction"),
  leakage: document.getElementById("leakage")
};

const outputs = {
  pressure: document.getElementById("pressureReadout"),
  force: document.getElementById("forceReadout"),
  efficiency: document.getElementById("efficiencyReadout"),
  inputStroke: document.getElementById("inputStrokeReadout"),
  outputStroke: document.getElementById("outputStrokeReadout"),
  flow: document.getElementById("flowReadout"),
  boomStrokeValue: document.getElementById("boomStrokeValue"),
  armStrokeValue: document.getElementById("armStrokeValue"),
  bucketStrokeValue: document.getElementById("bucketStrokeValue"),
  pushSpeedValue: document.getElementById("pushSpeedValue"),
  inputDiameterValue: document.getElementById("inputDiameterValue"),
  outputDiameterValue: document.getElementById("outputDiameterValue"),
  tubeLengthValue: document.getElementById("tubeLengthValue"),
  airBubbleValue: document.getElementById("airBubbleValue"),
  frictionValue: document.getElementById("frictionValue"),
  leakageValue: document.getElementById("leakageValue"),
  pascalFormula: document.getElementById("pascalFormula"),
  continuityFormula: document.getElementById("continuityFormula"),
  strokeFormula: document.getElementById("strokeFormula")
};

const playToggle = document.getElementById("playToggle");
const resetButton = document.getElementById("resetButton");
const sampleButton = document.getElementById("sampleButton");
const clearLog = document.getElementById("clearLog");
const logBody = document.getElementById("logBody");

const circuitMeta = {
  boom: { name: "主臂", control: "boomStroke", color: 0x0d7c8e, css: "#0d7c8e", z: -0.85 },
  arm: { name: "小臂", control: "armStroke", color: 0xd68a12, css: "#d68a12", z: 0 },
  bucket: { name: "铲斗", control: "bucketStroke", color: 0x2f9b58, css: "#2f9b58", z: 0.85 }
};

let running = false;
let direction = 1;
let lastFrame = performance.now();
let state = calculateState();
let scene;
let camera;
let renderer;
let modelGroup;
let bubbleGroup;
let yaw = -0.78;
let pitch = 0.48;
let isDragging = false;
let cameraUserMoved = false;
let lastPointer = { x: 0, y: 0 };

const materials = {};

function value(id) {
  return Number(controls[id].value);
}

function selectedCircuit() {
  return document.querySelector("input[name='circuit']:checked").value;
}

function areaFromDiameterMm(diameter) {
  return Math.PI * (diameter / 2) ** 2;
}

function calculateCircuit(inputStroke, common) {
  const inputVolume = common.inputArea * inputStroke / 1000;
  const transferredVolume = inputVolume * (1 - common.leakage) * common.delay;
  const outputStroke = clamp((transferredVolume * 1000) / common.outputArea, 0, 80);
  const pressureKpa = common.idealPressureKpa * (1 - common.loss);
  const outputForce = pressureKpa * 1000 * common.outputArea * 1e-6;
  const efficiency = clamp(
    (outputForce * outputStroke) / Math.max(common.handForce * inputStroke, 1),
    0,
    1
  );

  return {
    inputStroke,
    outputStroke,
    pressureKpa,
    outputForce,
    efficiency,
    normalized: clamp(outputStroke / 42, 0, 1)
  };
}

function calculateState() {
  const pushSpeed = value("pushSpeed");
  const inputDiameter = value("inputDiameter");
  const outputDiameter = value("outputDiameter");
  const tubeLength = value("tubeLength");
  const airBubble = value("airBubble") / 100;
  const friction = value("friction") / 100;
  const leakage = value("leakage") / 100;
  const inputArea = areaFromDiameterMm(inputDiameter);
  const outputArea = areaFromDiameterMm(outputDiameter);
  const flowRate = inputArea * pushSpeed / 1000;
  const loss = clamp(friction + leakage + tubeLength * 0.0008 + airBubble * 0.82, 0, 0.78);
  const delay = 1 - airBubble * 0.62;
  const handForce = 18 + pushSpeed * 0.24;
  const idealPressureKpa = (handForce / (inputArea * 1e-6)) / 1000;
  const common = {
    inputArea,
    outputArea,
    airBubble,
    friction,
    leakage,
    delay,
    loss,
    handForce,
    idealPressureKpa
  };

  const circuits = {
    boom: calculateCircuit(value("boomStroke"), common),
    arm: calculateCircuit(value("armStroke"), common),
    bucket: calculateCircuit(value("bucketStroke"), common)
  };
  const active = selectedCircuit();

  return {
    active,
    circuits,
    pushSpeed,
    inputDiameter,
    outputDiameter,
    tubeLength,
    airBubble,
    friction,
    leakage,
    inputArea,
    outputArea,
    flowRate,
    loss
  };
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function syncReadouts() {
  state = calculateState();
  const active = state.circuits[state.active];

  outputs.pressure.textContent = `${active.pressureKpa.toFixed(2)} kPa`;
  outputs.force.textContent = `${active.outputForce.toFixed(2)} N`;
  outputs.efficiency.textContent = `${Math.round(active.efficiency * 100)}%`;
  outputs.inputStroke.textContent = `${active.inputStroke.toFixed(1)} mm`;
  outputs.outputStroke.textContent = `${active.outputStroke.toFixed(1)} mm`;
  outputs.flow.textContent = `${state.flowRate.toFixed(1)} mL/s`;
  outputs.boomStrokeValue.textContent = `${state.circuits.boom.inputStroke.toFixed(1)} mm`;
  outputs.armStrokeValue.textContent = `${state.circuits.arm.inputStroke.toFixed(1)} mm`;
  outputs.bucketStrokeValue.textContent = `${state.circuits.bucket.inputStroke.toFixed(1)} mm`;
  outputs.pushSpeedValue.textContent = `${state.pushSpeed.toFixed(0)} mm/s`;
  outputs.inputDiameterValue.textContent = `${state.inputDiameter.toFixed(1)} mm`;
  outputs.outputDiameterValue.textContent = `${state.outputDiameter.toFixed(1)} mm`;
  outputs.tubeLengthValue.textContent = `${state.tubeLength.toFixed(0)} cm`;
  outputs.airBubbleValue.textContent = `${Math.round(state.airBubble * 100)}%`;
  outputs.frictionValue.textContent = `${Math.round(state.friction * 100)}%`;
  outputs.leakageValue.textContent = `${Math.round(state.leakage * 100)}%`;
  outputs.pascalFormula.textContent = `P = ${active.pressureKpa.toFixed(2)} kPa (${circuitMeta[state.active].name})`;
  outputs.continuityFormula.textContent = `Q = ${state.inputArea.toFixed(0)} mm² × ${state.pushSpeed.toFixed(0)} mm/s`;
  outputs.strokeFormula.textContent = `s₂ = ${(state.inputArea / state.outputArea).toFixed(2)} × s₁ × 损失修正`;
}

function initThree() {
  if (!window.THREE) {
    stage.innerHTML = '<div class="webgl-error">Three.js 未加载，请检查 vendor/three.min.js。</div>';
    return false;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6fbfc);
  camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  materials.ground = new THREE.MeshStandardMaterial({ color: 0xe5edf0, roughness: 0.88 });
  materials.grid = new THREE.LineBasicMaterial({ color: 0xb4c3ca, transparent: true, opacity: 0.55 });
  materials.board = new THREE.MeshStandardMaterial({ color: 0xd9c39a, roughness: 0.72 });
  materials.boardEdge = new THREE.MeshStandardMaterial({ color: 0xb99b67, roughness: 0.78 });
  materials.wood = new THREE.MeshStandardMaterial({ color: 0xd8bd8c, roughness: 0.66 });
  materials.woodDark = new THREE.MeshStandardMaterial({ color: 0xa7804e, roughness: 0.76 });
  materials.pin = new THREE.MeshStandardMaterial({ color: 0xd57e21, roughness: 0.45, metalness: 0.08 });
  materials.bolt = new THREE.MeshStandardMaterial({ color: 0x62686a, roughness: 0.36, metalness: 0.5 });
  materials.glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, transparent: true, opacity: 0.38 });
  materials.water = new THREE.MeshStandardMaterial({ color: 0x8ed8e3, roughness: 0.22, transparent: true, opacity: 0.72 });
  materials.ram = new THREE.MeshStandardMaterial({ color: 0xd9e3e8, roughness: 0.26, metalness: 0.38 });
  materials.bubble = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.82 });

  for (const [id, meta] of Object.entries(circuitMeta)) {
    materials[`${id}Tube`] = new THREE.MeshStandardMaterial({
      color: meta.color,
      roughness: 0.28,
      transparent: true,
      opacity: id === state.active ? 0.92 : 0.45
    });
    materials[`${id}Cylinder`] = new THREE.MeshStandardMaterial({
      color: meta.color,
      roughness: 0.34,
      metalness: 0.05
    });
  }

  addLights();
  addGround();
  modelGroup = new THREE.Group();
  bubbleGroup = new THREE.Group();
  scene.add(modelGroup);
  scene.add(bubbleGroup);
  attachPointerControls();
  resizeRenderer();
  return true;
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xf2fbff, 0xb6a887, 2.0));

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-4.5, 7, 4.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  scene.add(key);
}

function addGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(13, 8), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);

  for (let x = -6.5; x <= 6.5; x += 0.5) {
    addGridLine(new THREE.Vector3(x, -0.025, -4), new THREE.Vector3(x, -0.025, 4));
  }
  for (let z = -4; z <= 4; z += 0.5) {
    addGridLine(new THREE.Vector3(-6.5, -0.025, z), new THREE.Vector3(6.5, -0.025, z));
  }
}

function addGridLine(a, b) {
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
  scene.add(new THREE.Line(geometry, materials.grid));
}

function attachPointerControls() {
  renderer.domElement.addEventListener("pointerdown", (event) => {
    isDragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    yaw -= dx * 0.006;
    pitch = clamp(pitch + dy * 0.004, 0.18, 1.08);
    cameraUserMoved = true;
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  renderer.domElement.addEventListener("pointerup", () => {
    isDragging = false;
  });
}

function resizeRenderer() {
  if (!renderer) return;
  const rect = stage.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
}

function updateCamera() {
  const radius = camera.aspect < 0.8 ? 10.5 : 7.6;
  const viewYaw = camera.aspect < 0.8 && !cameraUserMoved ? -1.15 : yaw;
  const target = new THREE.Vector3(-0.35, 1.15, 0.1);
  camera.position.set(
    target.x + Math.sin(viewYaw) * Math.cos(pitch) * radius,
    target.y + 1.1 + Math.sin(pitch) * radius,
    target.z + Math.cos(viewYaw) * Math.cos(pitch) * radius
  );
  camera.lookAt(target);
}

function renderModel(time) {
  try {
    clearGroup(modelGroup);
    clearGroup(bubbleGroup);
    refreshCircuitMaterials();
    const ports = drawWoodHydraulicExcavator();
    drawHydraulicRackAndTubes(ports, time);
    updateCamera();
    renderer.render(scene, camera);
  } catch (error) {
    stage.innerHTML = `<div class="webgl-error">3D 渲染错误：${error.message}</div>`;
    renderer = null;
    throw error;
  }
}

function refreshCircuitMaterials() {
  for (const id of Object.keys(circuitMeta)) {
    materials[`${id}Tube`].opacity = id === state.active ? 0.92 : 0.42;
  }
}

function drawWoodHydraulicExcavator() {
  addBaseBoard();
  addMast();

  const boomT = state.circuits.boom.normalized;
  const armT = state.circuits.arm.normalized;
  const bucketT = state.circuits.bucket.normalized;

  const basePivot = new THREE.Vector3(0.72, 1.58, 0);
  const boomAngle = 2.9 - boomT * 0.35;
  const boomLen = 2.45;
  const boomEnd = pointFrom(basePivot, boomLen, boomAngle);

  const armAngle = 3.88 + armT * 0.46 - boomT * 0.08;
  const armLen = 1.72;
  const armEnd = pointFrom(boomEnd, armLen, armAngle);

  const bucketAngle = 3.75 + bucketT * 0.86;
  const bucketTip = pointFrom(armEnd, 0.68, bucketAngle);

  addParallelLink(basePivot, boomEnd, 0.13, 0.2, materials.wood);
  addParallelLink(boomEnd, armEnd, 0.12, 0.2, materials.wood);
  addBucketAssembly(armEnd, bucketTip, bucketAngle, bucketT);
  addPin(basePivot, 0.12);
  addPin(boomEnd, 0.11);
  addPin(armEnd, 0.1);

  const ports = {
    boom: addActuator(
      "boom",
      new THREE.Vector3(0.2, 0.78, -0.34),
      mixVectors(basePivot, boomEnd, 0.56).add(new THREE.Vector3(0, -0.06, -0.34)),
      state.circuits.boom.normalized
    ),
    arm: addActuator(
      "arm",
      mixVectors(basePivot, boomEnd, 0.42).add(new THREE.Vector3(0, -0.06, 0.34)),
      mixVectors(boomEnd, armEnd, 0.5).add(new THREE.Vector3(0, 0.02, 0.34)),
      state.circuits.arm.normalized
    ),
    bucket: addActuator(
      "bucket",
      mixVectors(boomEnd, armEnd, 0.7).add(new THREE.Vector3(0, 0.02, -0.3)),
      mixVectors(armEnd, bucketTip, 0.48).add(new THREE.Vector3(0, 0.04, -0.3)),
      state.circuits.bucket.normalized
    )
  };

  return ports;
}

function addBaseBoard() {
  addBox(new THREE.Vector3(0.4, 0.05, 0), new THREE.Vector3(6.7, 0.1, 3.15), materials.board, modelGroup);
  addBox(new THREE.Vector3(0.4, 0.12, 0), new THREE.Vector3(6.55, 0.04, 3.0), materials.boardEdge, modelGroup);
  addBox(new THREE.Vector3(2.15, 0.28, 0), new THREE.Vector3(1.85, 0.12, 2.35), materials.board, modelGroup);
  addBox(new THREE.Vector3(2.15, 0.62, -1.17), new THREE.Vector3(1.85, 0.58, 0.08), materials.boardEdge, modelGroup);
  addBox(new THREE.Vector3(2.15, 0.62, 1.17), new THREE.Vector3(1.85, 0.58, 0.08), materials.boardEdge, modelGroup);
}

function addMast() {
  addBox(new THREE.Vector3(0.78, 0.33, -0.36), new THREE.Vector3(0.52, 0.1, 0.32), materials.boardEdge, modelGroup);
  addBox(new THREE.Vector3(0.78, 0.33, 0.36), new THREE.Vector3(0.52, 0.1, 0.32), materials.boardEdge, modelGroup);
  addBox(new THREE.Vector3(0.62, 0.96, -0.36), new THREE.Vector3(0.16, 1.32, 0.12), materials.wood, modelGroup);
  addBox(new THREE.Vector3(0.92, 0.96, -0.36), new THREE.Vector3(0.16, 1.32, 0.12), materials.wood, modelGroup);
  addBox(new THREE.Vector3(0.62, 0.96, 0.36), new THREE.Vector3(0.16, 1.32, 0.12), materials.wood, modelGroup);
  addBox(new THREE.Vector3(0.92, 0.96, 0.36), new THREE.Vector3(0.16, 1.32, 0.12), materials.wood, modelGroup);
  addCylinderBetween(new THREE.Vector3(0.52, 1.58, -0.48), new THREE.Vector3(1.02, 1.58, 0.48), 0.035, materials.bolt, modelGroup);
}

function addParallelLink(start, end, height, width, material) {
  for (const z of [-0.22, 0.22]) {
    addBeam(start.clone().setZ(z), end.clone().setZ(z), height, width, material);
  }
  addCrossBolt(start, 0.33);
  addCrossBolt(end, 0.33);
}

function addBucketAssembly(pivot, tip, angle, amount) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.54, 0.62), materials.wood);
  body.position.set(0.28, -0.12, 0);
  body.rotation.z = -0.28;
  body.castShadow = true;
  group.add(body);

  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.72), materials.woodDark);
  lip.position.set(0.63, -0.42, 0);
  group.add(lip);

  for (let i = 0; i < 6; i += 1) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.055), materials.woodDark);
    tooth.position.set(0.66, -0.55, -0.28 + i * 0.112);
    tooth.rotation.z = 0.28;
    group.add(tooth);
  }

  group.position.copy(pivot);
  group.rotation.z = angle - amount * 0.25;
  modelGroup.add(group);
  addPin(pivot, 0.09);
}

function addActuator(id, anchor, moving, normalized) {
  const directionVector = new THREE.Vector3().subVectors(moving, anchor);
  const unit = directionVector.clone().normalize();
  const totalLength = directionVector.length();
  const shellLength = totalLength * (0.48 + normalized * 0.08);
  const shellEnd = anchor.clone().add(unit.clone().multiplyScalar(shellLength));
  const material = id === state.active ? materials[`${id}Cylinder`] : materials.bolt;

  addCylinderBetween(anchor, shellEnd, 0.06, material, modelGroup);
  addCylinderBetween(shellEnd, moving, 0.032, materials.ram, modelGroup);
  addPin(anchor, 0.065);
  addPin(moving, 0.065);
  return anchor.clone().add(unit.clone().multiplyScalar(0.06));
}

function drawHydraulicRackAndTubes(ports, time) {
  for (const [id, meta] of Object.entries(circuitMeta)) {
    const inputBase = new THREE.Vector3(2.25, 0.62, meta.z);
    const fill = state.circuits[id].inputStroke / 60;
    addRackSyringe(inputBase, fill, id);
    drawTube(id, inputBase.clone().add(new THREE.Vector3(-0.58, 0, 0)), ports[id], time);
  }
}

function addRackSyringe(base, fill, id) {
  const radius = 0.105;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.92, 32, 1, true), materials.glass);
  body.rotation.z = Math.PI / 2;
  body.position.copy(base);
  body.castShadow = true;
  modelGroup.add(body);

  const waterLength = 0.74 * clamp(fill, 0.03, 1);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, waterLength, 24), materials.water);
  water.rotation.z = Math.PI / 2;
  water.position.copy(base).add(new THREE.Vector3(-0.37 + waterLength / 2, 0, 0));
  modelGroup.add(water);

  const plungerX = base.x + 0.58 - fill * 0.42;
  addBox(new THREE.Vector3(plungerX, base.y, base.z), new THREE.Vector3(0.08, 0.35, 0.08), materials.bolt, modelGroup);
  addBox(new THREE.Vector3(plungerX + 0.23, base.y, base.z), new THREE.Vector3(0.36, 0.035, 0.035), materials.bolt, modelGroup);
  addCylinderBetween(
    base.clone().add(new THREE.Vector3(-0.54, 0, 0)),
    base.clone().add(new THREE.Vector3(-0.72, 0, 0)),
    0.028,
    materials[`${id}Cylinder`],
    modelGroup
  );
}

function drawTube(id, start, end, time) {
  const lift = id === "boom" ? 1.55 : id === "arm" ? 1.1 : 0.8;
  const curve = new THREE.CatmullRomCurve3([
    start,
    start.clone().add(new THREE.Vector3(-0.45, lift, 0.2)),
    mixVectors(start, end, 0.45).add(new THREE.Vector3(0.25, lift + 0.3, id === "arm" ? 0.65 : -0.25)),
    end.clone().add(new THREE.Vector3(0.15, 0.18, 0)),
    end
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 54, id === state.active ? 0.035 : 0.025, 12, false), materials[`${id}Tube`]);
  tube.castShadow = true;
  modelGroup.add(tube);

  const bubbleCount = Math.round(state.airBubble * 14);
  if (id !== state.active) return;
  for (let i = 0; i < bubbleCount; i += 1) {
    const p = curve.getPoint(((i + 0.25) / Math.max(bubbleCount, 1) + time * 0.00008) % 1);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.028 + (i % 2) * 0.008, 12, 8), materials.bubble);
    bubble.position.copy(p);
    bubbleGroup.add(bubble);
  }
}

function addBeam(start, end, height, depth, material) {
  const length = start.distanceTo(end);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, depth), material);
  mesh.position.copy(mixVectors(start, end, 0.5));
  mesh.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  modelGroup.add(mesh);
}

function addBox(position, size, material, group) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addPin(position, radius) {
  const pin = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), materials.pin);
  pin.position.copy(position);
  pin.castShadow = true;
  modelGroup.add(pin);
}

function addCrossBolt(position, width) {
  addCylinderBetween(
    position.clone().add(new THREE.Vector3(0, 0, -width)),
    position.clone().add(new THREE.Vector3(0, 0, width)),
    0.035,
    materials.bolt,
    modelGroup
  );
}

function addCylinderBetween(start, end, radius, material, group) {
  const directionVector = new THREE.Vector3().subVectors(end, start);
  const length = directionVector.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), material);
  mesh.position.copy(mixVectors(start, end, 0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), directionVector.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function pointFrom(origin, length, angle) {
  return new THREE.Vector3(
    origin.x + Math.cos(angle) * length,
    origin.y + Math.sin(angle) * length,
    origin.z
  );
}

function mixVectors(a, b, t) {
  return new THREE.Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t
  );
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
  }
}

function tick(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (running) {
    const activeControl = controls[circuitMeta[state.active].control];
    const next = Number(activeControl.value) + direction * state.pushSpeed * dt;
    if (next >= 60) {
      activeControl.value = 60;
      direction = -1;
    } else if (next <= 0) {
      activeControl.value = 0;
      direction = 1;
    } else {
      activeControl.value = next;
    }
  }

  syncReadouts();
  if (renderer) renderModel(now);
  requestAnimationFrame(tick);
}

function recordSample() {
  const active = state.circuits[state.active];
  const row = document.createElement("tr");
  const cells = [
    circuitMeta[state.active].name,
    active.pressureKpa.toFixed(2),
    active.outputForce.toFixed(2),
    active.outputStroke.toFixed(1),
    `${Math.round(active.efficiency * 100)}%`
  ];
  for (const cell of cells) {
    const td = document.createElement("td");
    td.textContent = cell;
    row.appendChild(td);
  }
  logBody.prepend(row);
}

for (const input of Object.values(controls)) {
  input.addEventListener("input", syncReadouts);
}

for (const input of document.querySelectorAll("input[name='circuit']")) {
  input.addEventListener("change", () => {
    direction = 1;
    syncReadouts();
  });
}

playToggle.addEventListener("click", () => {
  running = !running;
  playToggle.textContent = running ? "暂停" : "运行";
  playToggle.classList.toggle("is-running", running);
});

resetButton.addEventListener("click", () => {
  running = false;
  direction = 1;
  controls.boomStroke.value = 18;
  controls.armStroke.value = 16;
  controls.bucketStroke.value = 22;
  playToggle.textContent = "运行";
  playToggle.classList.remove("is-running");
  syncReadouts();
});

sampleButton.addEventListener("click", recordSample);
clearLog.addEventListener("click", () => {
  logBody.textContent = "";
});

window.addEventListener("resize", resizeRenderer);

syncReadouts();
if (initThree()) {
  renderModel(performance.now());
  requestAnimationFrame(tick);
}
