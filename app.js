const stage = document.getElementById("threeStage");

const controls = {
  boomStroke: document.getElementById("boomStroke"),
  armStroke: document.getElementById("armStroke"),
  bucketStroke: document.getElementById("bucketStroke"),
  pushSpeed: document.getElementById("pushSpeed"),
  inputDiameter: document.getElementById("inputDiameter"),
  outputDiameter: document.getElementById("outputDiameter"),
  tubeDiameter: document.getElementById("tubeDiameter"),
  tubeLength: document.getElementById("tubeLength"),
  minorK: document.getElementById("minorK"),
  airBubble: document.getElementById("airBubble"),
  leakage: document.getElementById("leakage")
};

const outputs = {
  pressure: document.getElementById("pressureReadout"),
  force: document.getElementById("forceReadout"),
  efficiency: document.getElementById("efficiencyReadout"),
  inputStroke: document.getElementById("inputStrokeReadout"),
  outputStroke: document.getElementById("outputStrokeReadout"),
  flow: document.getElementById("flowReadout"),
  reynolds: document.getElementById("reReadout"),
  boomStrokeValue: document.getElementById("boomStrokeValue"),
  armStrokeValue: document.getElementById("armStrokeValue"),
  bucketStrokeValue: document.getElementById("bucketStrokeValue"),
  pushSpeedValue: document.getElementById("pushSpeedValue"),
  inputDiameterValue: document.getElementById("inputDiameterValue"),
  outputDiameterValue: document.getElementById("outputDiameterValue"),
  tubeDiameterValue: document.getElementById("tubeDiameterValue"),
  tubeLengthValue: document.getElementById("tubeLengthValue"),
  minorKValue: document.getElementById("minorKValue"),
  airBubbleValue: document.getElementById("airBubbleValue"),
  leakageValue: document.getElementById("leakageValue"),
  idealPressureFormula: document.getElementById("idealPressureFormula"),
  continuityFormula: document.getElementById("continuityFormula"),
  majorLossFormula: document.getElementById("majorLossFormula"),
  minorLossFormula: document.getElementById("minorLossFormula"),
  regime: document.getElementById("regimeReadout"),
  hf: document.getElementById("hfReadout"),
  hm: document.getElementById("hmReadout"),
  lossPressure: document.getElementById("lossPressureReadout"),
  idealForce: document.getElementById("idealForceReadout"),
  realForce: document.getElementById("realForceReadout"),
  hypothesis: document.getElementById("experimentHypothesis")
};

const playToggle = document.getElementById("playToggle");
const resetButton = document.getElementById("resetButton");
const sampleButton = document.getElementById("sampleButton");
const clearLog = document.getElementById("clearLog");
const exportCsv = document.getElementById("exportCsv");
const logBody = document.getElementById("logBody");
const runIdealButton = document.getElementById("runIdeal");
const runTubeButton = document.getElementById("runTube");
const runMinorButton = document.getElementById("runMinor");
const chartCanvas = document.getElementById("chartCanvas");
const chartTitle = document.getElementById("chartTitle");
const chartSummary = document.getElementById("chartSummary");
const runStatus = document.getElementById("runStatus");

const circuitMeta = {
  boom: { name: "Boom", control: "boomStroke", color: 0x0d7c8e, css: "#0d7c8e", z: -0.85 },
  arm: { name: "Forearm", control: "armStroke", color: 0xd68a12, css: "#d68a12", z: 0 },
  bucket: { name: "Bucket", control: "bucketStroke", color: 0x2f9b58, css: "#2f9b58", z: 0.85 }
};

Object.assign(circuitMeta, {
  boom: { name: "Boom", control: "boomStroke", color: 0x0d7c8e, css: "#0d7c8e", z: -0.85 },
  arm: { name: "Forearm", control: "armStroke", color: 0xd68a12, css: "#d68a12", z: 0 },
  bucket: { name: "Bucket", control: "bucketStroke", color: 0x2f9b58, css: "#2f9b58", z: 0.85 }
});

const WATER_DENSITY = 1000;
const WATER_VISCOSITY = 1.0e-3;
const GRAVITY = 9.81;
const trialLog = [];
let chartSeries = [];

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
let cameraZoom = 1;
let modelDirty = true;
const activePointers = new Map();
let isPinching = false;
let pinchBaseDistance = 0;
let pinchBaseZoom = 1;

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

function selectedExperiment() {
  return document.querySelector("input[name='experiment']:checked").value;
}

function experimentInfo(mode) {
  const info = {
    ideal: {
      name: "Ideal transmission",
      hypothesis: "Hypothesis: increasing output piston area increases output force but reduces output stroke."
    },
    tube: {
      name: "Tube flow loss",
      hypothesis: "Hypothesis: longer tubes and faster pushing increase friction head loss and reduce output pressure."
    },
    minor: {
      name: "Minor losses",
      hypothesis: "Hypothesis: connectors, bends, and narrow outlets add local losses and reduce efficiency."
    }
  };
  return info[mode] || info.ideal;
}

function frictionFactor(reynolds) {
  if (reynolds <= 0) return 0;
  if (reynolds < 2000) return 64 / reynolds;
  if (reynolds < 3000) {
    const laminar = 64 / reynolds;
    const turbulent = 0.3164 / Math.pow(reynolds, 0.25);
    const weight = (reynolds - 2000) / 1000;
    return laminar * (1 - weight) + turbulent * weight;
  }
  return 0.3164 / Math.pow(reynolds, 0.25);
}

function flowRegime(reynolds) {
  if (reynolds < 2000) return "Laminar";
  if (reynolds < 3000) return "Transitional";
  return "Turbulent";
}

function calculateCircuit(inputStroke, common) {
  const inputVolumeMl = common.inputArea * inputStroke / 1000;
  const idealOutputStroke = (inputVolumeMl * 1000) / common.outputArea;
  const outputStroke = clamp(idealOutputStroke * common.volumeCorrection, 0, 80);
  const pressureKpa = Math.max(common.outputPressureKpa, 0);
  const idealOutputForce = common.idealPressureKpa * 1000 * common.outputArea * 1e-6;
  const outputForce = pressureKpa * 1000 * common.outputArea * 1e-6;
  const efficiency = clamp(
    (outputForce * outputStroke) / Math.max(common.handForce * inputStroke, 1),
    0,
    1
  );

  return {
    inputStroke,
    idealOutputStroke,
    outputStroke,
    pressureKpa,
    idealOutputForce,
    outputForce,
    efficiency,
    normalized: clamp(outputStroke / 42, 0, 1)
  };
}

function calculateState() {
  const mode = selectedExperiment();
  const pushSpeed = value("pushSpeed");
  const inputDiameter = value("inputDiameter");
  const outputDiameter = value("outputDiameter");
  const tubeDiameter = value("tubeDiameter");
  const tubeLengthCm = value("tubeLength");
  const minorKInput = value("minorK");
  const airBubble = value("airBubble") / 100;
  const leakage = value("leakage") / 100;
  const inputArea = areaFromDiameterMm(inputDiameter);
  const outputArea = areaFromDiameterMm(outputDiameter);
  const tubeArea = areaFromDiameterMm(tubeDiameter);
  const flowRateMlS = inputArea * pushSpeed / 1000;
  const tubeVelocity = (flowRateMlS * 1e-6) / (tubeArea * 1e-6);
  const tubeLengthM = tubeLengthCm / 100;
  const tubeDiameterM = tubeDiameter / 1000;
  const reynolds = WATER_DENSITY * tubeVelocity * tubeDiameterM / WATER_VISCOSITY;
  const f = frictionFactor(reynolds);
  const hfPhysical = f * (tubeLengthM / tubeDiameterM) * (tubeVelocity ** 2) / (2 * GRAVITY);
  const hmPhysical = minorKInput * (tubeVelocity ** 2) / (2 * GRAVITY);
  const hf = mode === "ideal" ? 0 : hfPhysical;
  const hm = mode === "minor" ? hmPhysical : 0;
  const totalHeadLoss = hf + hm;
  const pressureLossKpa = WATER_DENSITY * GRAVITY * totalHeadLoss / 1000;
  const handForce = 18 + pushSpeed * 0.24;
  const idealPressureKpa = (handForce / (inputArea * 1e-6)) / 1000;
  const outputPressureKpa = Math.max(idealPressureKpa - pressureLossKpa, 0);
  const physicalVolumeCorrection = clamp((1 - leakage) * (1 - airBubble * 0.62), 0.65, 1);
  const volumeCorrection = mode === "ideal" ? 1 : physicalVolumeCorrection;
  const common = {
    inputArea,
    outputArea,
    handForce,
    idealPressureKpa,
    outputPressureKpa,
    volumeCorrection
  };
  const circuits = {
    boom: calculateCircuit(value("boomStroke"), common),
    arm: calculateCircuit(value("armStroke"), common),
    bucket: calculateCircuit(value("bucketStroke"), common)
  };
  const active = selectedCircuit();

  return {
    mode,
    active,
    circuits,
    pushSpeed,
    inputDiameter,
    outputDiameter,
    tubeDiameter,
    tubeLengthCm,
    minorKInput,
    airBubble,
    leakage,
    inputArea,
    outputArea,
    tubeArea,
    flowRateMlS,
    tubeVelocity,
    reynolds,
    frictionFactor: f,
    regime: flowRegime(reynolds),
    hf,
    hm,
    totalHeadLoss,
    pressureLossKpa,
    handForce,
    idealPressureKpa,
    outputPressureKpa,
    volumeCorrection
  };
}

function syncReadouts() {
  state = calculateState();
  const active = state.circuits[state.active];
  outputs.pressure.textContent = `${active.pressureKpa.toFixed(2)} kPa`;
  outputs.force.textContent = `${active.outputForce.toFixed(2)} N`;
  outputs.efficiency.textContent = `${Math.round(active.efficiency * 100)}%`;
  outputs.inputStroke.textContent = `${active.inputStroke.toFixed(1)} mm`;
  outputs.outputStroke.textContent = `${active.outputStroke.toFixed(1)} mm`;
  outputs.flow.textContent = `${state.flowRateMlS.toFixed(1)} mL/s`;
  outputs.reynolds.textContent = `${Math.round(state.reynolds)}`;
  outputs.boomStrokeValue.textContent = `${state.circuits.boom.inputStroke.toFixed(1)} mm`;
  outputs.armStrokeValue.textContent = `${state.circuits.arm.inputStroke.toFixed(1)} mm`;
  outputs.bucketStrokeValue.textContent = `${state.circuits.bucket.inputStroke.toFixed(1)} mm`;
  outputs.pushSpeedValue.textContent = `${state.pushSpeed.toFixed(0)} mm/s`;
  outputs.inputDiameterValue.textContent = `${state.inputDiameter.toFixed(1)} mm`;
  outputs.outputDiameterValue.textContent = `${state.outputDiameter.toFixed(1)} mm`;
  outputs.tubeDiameterValue.textContent = `${state.tubeDiameter.toFixed(2)} mm`;
  outputs.tubeLengthValue.textContent = `${state.tubeLengthCm.toFixed(0)} cm`;
  outputs.minorKValue.textContent = `${state.minorKInput.toFixed(1)}`;
  outputs.airBubbleValue.textContent = `${Math.round(state.airBubble * 100)}%`;
  outputs.leakageValue.textContent = `${(state.leakage * 100).toFixed(1)}%`;
  outputs.idealPressureFormula.innerHTML = `<i>P</i><sub>in</sub> = ${state.idealPressureKpa.toFixed(2)} kPa`;
  outputs.continuityFormula.innerHTML = `<i>Q</i> = ${state.inputArea.toFixed(0)} mm<sup>2</sup> &times; ${state.pushSpeed.toFixed(0)} mm/s`;
  outputs.majorLossFormula.innerHTML = `<i>h</i><sub>f</sub> = ${state.hf.toFixed(4)} m, <i>Re</i> = ${Math.round(state.reynolds)}`;
  outputs.minorLossFormula.innerHTML = `<i>h</i><sub>L,minor</sub> = ${state.hm.toFixed(4)} m, <i>K</i> = ${state.minorKInput.toFixed(1)}`;
  outputs.regime.textContent = state.regime;
  outputs.hf.textContent = `${state.hf.toFixed(4)} m`;
  outputs.hm.textContent = `${state.hm.toFixed(4)} m`;
  outputs.lossPressure.textContent = `${state.pressureLossKpa.toFixed(3)} kPa`;
  outputs.idealForce.textContent = `${active.idealOutputForce.toFixed(2)} N`;
  outputs.realForce.textContent = `${active.outputForce.toFixed(2)} N`;
  outputs.hypothesis.textContent = experimentInfo(state.mode).hypothesis;
}

function initThree() {
  if (!window.THREE) {
    stage.innerHTML = '<div class="webgl-error">Three.js failed to load. Please check vendor/three.min.js.</div>';
    return false;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6fbfc);
  camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  setRenderPixelRatio();
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
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    renderer.domElement.setPointerCapture(event.pointerId);
    if (activePointers.size === 1) {
      isDragging = true;
      isPinching = false;
      lastPointer = { x: event.clientX, y: event.clientY };
    } else if (activePointers.size === 2) {
      isDragging = false;
      isPinching = true;
      const points = Array.from(activePointers.values());
      pinchBaseDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      pinchBaseZoom = cameraZoom;
    }
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (isPinching && activePointers.size >= 2) {
      const points = Array.from(activePointers.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (pinchBaseDistance > 0) {
        cameraZoom = clamp(pinchBaseZoom * (pinchBaseDistance / distance), 0.48, 2.2);
      }
      cameraUserMoved = true;
      return;
    }

    if (isDragging && activePointers.size === 1) {
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;
      yaw -= dx * 0.006;
      pitch = clamp(pitch + dy * 0.004, 0.18, 1.08);
      cameraUserMoved = true;
      lastPointer = { x: event.clientX, y: event.clientY };
    }
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size === 0) {
      isDragging = false;
      isPinching = false;
    } else if (activePointers.size === 1) {
      isDragging = true;
      isPinching = false;
      const remaining = Array.from(activePointers.values())[0];
      lastPointer = { x: remaining.x, y: remaining.y };
    }
  });

  renderer.domElement.addEventListener("pointercancel", (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size === 0) {
      isDragging = false;
      isPinching = false;
    }
  });

  renderer.domElement.addEventListener("wheel", (event) => {
    event.preventDefault();
    cameraZoom = clamp(cameraZoom * Math.exp(event.deltaY * 0.001), 0.48, 2.2);
    cameraUserMoved = true;
  }, { passive: false });
}

function renderSceneOnly() {
  if (!renderer) return;
  updateCamera();
  renderer.render(scene, camera);
}

function markModelDirty() {
  modelDirty = true;
  syncReadouts();
}

function setRenderPixelRatio() {
  if (!renderer) return;
  const rect = stage.getBoundingClientRect();
  const limit = rect.width < 700 ? 1.15 : 1.65;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, limit));
}

function resizeRenderer() {
  if (!renderer) return;
  setRenderPixelRatio();
  const rect = stage.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
  renderSceneOnly();
}

function updateCamera() {
  const radius = (camera.aspect < 0.8 ? 22 : 7.6) * cameraZoom;
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
    stage.innerHTML = `<div class="webgl-error">3D rendering error: ${error.message}</div>`;
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
    modelDirty = true;
  }

  if (modelDirty) {
    syncReadouts();
    if (renderer) renderModel(now);
    modelDirty = false;
  } else {
    renderSceneOnly();
  }
  requestAnimationFrame(tick);
}

function recordSample() {
  state = calculateState();
  const active = state.circuits[state.active];
  const trial = {
    mode: experimentInfo(state.mode).name,
    variable: "manual",
    value: "-",
    circuit: circuitMeta[state.active].name,
    inputDiameter: state.inputDiameter.toFixed(1),
    outputDiameter: state.outputDiameter.toFixed(1),
    tubeDiameter: state.tubeDiameter.toFixed(2),
    tubeLengthCm: state.tubeLengthCm.toFixed(0),
    pushSpeed: state.pushSpeed.toFixed(0),
    minorK: state.minorKInput.toFixed(1),
    flowRateMlS: state.flowRateMlS.toFixed(2),
    tubeVelocity: state.tubeVelocity.toFixed(3),
    reynolds: Math.round(state.reynolds),
    regime: state.regime,
    hf: state.hf.toFixed(5),
    hm: state.hm.toFixed(5),
    pressureLossKpa: state.pressureLossKpa.toFixed(3),
    idealForce: active.idealOutputForce.toFixed(2),
    realForce: active.outputForce.toFixed(2),
    outputStroke: active.outputStroke.toFixed(2),
    efficiency: `${Math.round(active.efficiency * 100)}%`
  };
  addTrial(trial);
}

function formatVariableName(variable) {
  const labels = {
    "d_out/mm": "<i>d</i><sub>out</sub> / mm",
    "L/cm": "<i>L</i> / cm",
    "K": "<i>K</i>",
    "manual": "manual"
  };
  return labels[variable] || variable;
}

function addTrial(trial) {
  trialLog.unshift(trial);
  const row = document.createElement("tr");
  const cells = [
    trial.mode,
    trial.variable,
    trial.value,
    trial.reynolds,
    trial.pressureLossKpa,
    trial.idealForce,
    trial.realForce,
    trial.efficiency
  ];
  cells.forEach((cell, index) => {
    const td = document.createElement("td");
    if (index === 1) {
      td.innerHTML = formatVariableName(cell);
    } else {
      td.textContent = cell;
    }
    row.appendChild(td);
  });
  logBody.prepend(row);
}

function exportTrialCsv() {
  if (!trialLog.length) return;
  const headers = Object.keys(trialLog[0]);
  const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    headers.join(","),
    ...trialLog.map((trial) => headers.map((key) => escapeCsv(trial[key])).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hydraulic-excavator-trials.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function setExperimentMode(mode) {
  const radio = document.querySelector(`input[name='experiment'][value='${mode}']`);
  if (radio) radio.checked = true;
}

function setActiveCircuit(circuit) {
  const radio = document.querySelector(`input[name='circuit'][value='${circuit}']`);
  if (radio) radio.checked = true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function animateStroke(control, targetStroke) {
  const steps = 24;
  control.value = 0;
  markModelDirty();
  await sleep(40);
  for (let i = 1; i <= steps; i += 1) {
    control.value = targetStroke * (i / steps);
    markModelDirty();
    await sleep(28);
  }
}

function setBusy(isBusy) {
  for (const button of [runIdealButton, runTubeButton, runMinorButton, sampleButton, exportCsv, clearLog]) {
    button.disabled = isBusy;
  }
}

function clearExperimentData() {
  trialLog.length = 0;
  logBody.textContent = "";
  chartSeries = [];
  drawChart();
}

function trialFromState(variable, valueLabel) {
  state = calculateState();
  const active = state.circuits[state.active];
  return {
    mode: experimentInfo(state.mode).name,
    variable,
    value: valueLabel,
    circuit: circuitMeta[state.active].name,
    inputDiameter: state.inputDiameter.toFixed(1),
    outputDiameter: state.outputDiameter.toFixed(1),
    tubeDiameter: state.tubeDiameter.toFixed(2),
    tubeLengthCm: state.tubeLengthCm.toFixed(0),
    pushSpeed: state.pushSpeed.toFixed(0),
    minorK: state.minorKInput.toFixed(1),
    flowRateMlS: state.flowRateMlS.toFixed(2),
    tubeVelocity: state.tubeVelocity.toFixed(3),
    reynolds: Math.round(state.reynolds),
    regime: state.regime,
    hf: state.hf.toFixed(5),
    hm: state.hm.toFixed(5),
    pressureLossKpa: state.pressureLossKpa.toFixed(3),
    idealForce: active.idealOutputForce.toFixed(2),
    realForce: active.outputForce.toFixed(2),
    outputStroke: active.outputStroke.toFixed(2),
    efficiency: `${Math.round(active.efficiency * 100)}%`
  };
}

function resizeChartCanvas() {
  if (!chartCanvas) return;
  const rect = chartCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(Math.round(rect.width * ratio), 600);
  const height = Math.max(Math.round(rect.height * ratio), 260);
  if (chartCanvas.width !== width || chartCanvas.height !== height) {
    chartCanvas.width = width;
    chartCanvas.height = height;
  }
}

function drawChart() {
  if (!chartCanvas) return;
  resizeChartCanvas();
  const ctx = chartCanvas.getContext("2d");
  const width = chartCanvas.width;
  const height = chartCanvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = { left: 64, right: 28, top: 30, bottom: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  ctx.strokeStyle = "#cbd8df";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + plotH);
  ctx.lineTo(pad.left + plotW, pad.top + plotH);
  ctx.stroke();

  if (!chartSeries.length || !chartSeries[0].points.length) {
    ctx.fillStyle = "#5f7180";
    ctx.font = "18px Segoe UI, Arial";
    ctx.fillText("Click Run Experiment to generate data curves.", pad.left + 20, pad.top + 60);
    return;
  }

  const allPoints = chartSeries.flatMap((series) => series.points);
  const minX = Math.min(...allPoints.map((p) => p.x));
  const maxX = Math.max(...allPoints.map((p) => p.x));
  const minY = 0;
  const maxY = Math.max(...allPoints.map((p) => p.y)) * 1.12 || 1;
  const xScale = (x) => pad.left + ((x - minX) / Math.max(maxX - minX, 1)) * plotW;
  const yScale = (y) => pad.top + plotH - ((y - minY) / Math.max(maxY - minY, 1)) * plotH;

  ctx.fillStyle = "#5f7180";
  ctx.font = "13px Segoe UI, Arial";
  for (let i = 0; i <= 4; i += 1) {
    const y = minY + (maxY - minY) * (i / 4);
    const py = yScale(y);
    ctx.strokeStyle = "#edf3f6";
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + plotW, py);
    ctx.stroke();
    ctx.fillText(y.toFixed(maxY > 20 ? 0 : 2), 12, py + 4);
  }

  ctx.fillStyle = "#5f7180";
  ctx.fillText(chartSeries[0].xLabel || "Variable", pad.left + plotW / 2 - 30, height - 14);
  ctx.save();
  ctx.translate(18, pad.top + plotH / 2 + 35);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(chartSeries[0].yLabel || "Value", 0, 0);
  ctx.restore();

  for (const series of chartSeries) {
    ctx.strokeStyle = series.color;
    ctx.fillStyle = series.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    series.points.forEach((point, index) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    for (const point of series.points) {
      ctx.beginPath();
      ctx.arc(xScale(point.x), yScale(point.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let legendX = pad.left + 8;
  for (const series of chartSeries) {
    ctx.fillStyle = series.color;
    ctx.fillRect(legendX, 12, 18, 4);
    ctx.fillStyle = "#17222a";
    ctx.font = "13px Segoe UI, Arial";
    ctx.fillText(series.name, legendX + 24, 17);
    legendX += ctx.measureText(series.name).width + 58;
  }
}

async function runAutomatedExperiment(mode) {
  setBusy(true);
  clearExperimentData();
  setExperimentMode(mode);
  setActiveCircuit("boom");
  const activeControl = controls.boomStroke;
  const original = {
    outputDiameter: controls.outputDiameter.value,
    tubeLength: controls.tubeLength.value,
    minorK: controls.minorK.value
  };
  const config = {
    ideal: {
      title: "Experiment 1: Output diameter vs hydraulic force",
      summary: "Ideal prediction verifies Pascal's law: larger output area produces larger force while stroke decreases.",
      variable: "d_out/mm",
      values: [12, 16, 20, 24, 28, 32],
      setValue: (v) => { controls.outputDiameter.value = v; },
      label: (v) => `${v} mm`,
      xLabel: "Output diameter (mm)",
      yLabel: "Output force (N)",
      makeSeries: (points) => [
        { name: "Ideal force", color: "#0d7c8e", xLabel: "Output diameter (mm)", yLabel: "Force (N)", points: points.map((p) => ({ x: p.x, y: p.idealForce })) },
        { name: "Real force", color: "#d68a12", xLabel: "Output diameter (mm)", yLabel: "Force (N)", points: points.map((p) => ({ x: p.x, y: p.realForce })) }
      ]
    },
    tube: {
      title: "Experiment 2: Tube length vs pressure loss",
      summary: "Tube friction loss increases with length, reducing output force compared with the ideal prediction.",
      variable: "L/cm",
      values: [20, 50, 80, 110, 140, 180],
      setValue: (v) => { controls.tubeLength.value = v; },
      label: (v) => `${v} cm`,
      xLabel: "Tube length (cm)",
      yLabel: "Pressure loss (kPa)",
      makeSeries: (points) => [
        { name: "Pressure loss", color: "#bd5447", xLabel: "Tube length (cm)", yLabel: "Pressure loss (kPa)", points: points.map((p) => ({ x: p.x, y: p.pressureLoss })) }
      ]
    },
    minor: {
      title: "Experiment 3: Connector K vs efficiency",
      summary: "Minor losses from connectors and bends reduce useful output work and system efficiency.",
      variable: "K",
      values: [0, 0.6, 1.2, 2.0, 3.0, 4.0],
      setValue: (v) => { controls.minorK.value = v; },
      label: (v) => `${v.toFixed(1)}`,
      xLabel: "Connector loss coefficient K",
      yLabel: "Efficiency (%)",
      makeSeries: (points) => [
        { name: "Efficiency", color: "#2f9b58", xLabel: "Connector loss coefficient K", yLabel: "Efficiency (%)", points: points.map((p) => ({ x: p.x, y: p.efficiency })) }
      ]
    }
  }[mode];

  chartTitle.textContent = config.title;
  chartSummary.textContent = "Running automated trial...";
  runStatus.textContent = "Running";

  const points = [];
  for (const value of config.values) {
    config.setValue(value);
    await animateStroke(activeControl, 52);
    state = calculateState();
    const active = state.circuits[state.active];
    const trial = trialFromState(config.variable, config.label(value));
    addTrial(trial);
    points.push({
      x: value,
      idealForce: Number(trial.idealForce),
      realForce: Number(trial.realForce),
      pressureLoss: Number(trial.pressureLossKpa),
      efficiency: Number(trial.efficiency.replace("%", ""))
    });
    chartSeries = config.makeSeries(points);
    drawChart();
    await sleep(130);
  }

  controls.outputDiameter.value = original.outputDiameter;
  controls.tubeLength.value = original.tubeLength;
  controls.minorK.value = original.minorK;
  markModelDirty();
  chartSummary.textContent = config.summary;
  runStatus.textContent = `Completed ${config.values.length} trials`;
  setBusy(false);
}

for (const input of Object.values(controls)) {
  input.addEventListener("input", markModelDirty);
}

for (const input of document.querySelectorAll("input[name='circuit']")) {
  input.addEventListener("change", () => {
    direction = 1;
    markModelDirty();
  });
}

for (const input of document.querySelectorAll("input[name='experiment']")) {
  input.addEventListener("change", () => {
    direction = 1;
    markModelDirty();
  });
}

playToggle.addEventListener("click", () => {
  running = !running;
  playToggle.textContent = running ? "Pause" : "Run";
  playToggle.classList.toggle("is-running", running);
});

resetButton.addEventListener("click", () => {
  running = false;
  direction = 1;
  controls.boomStroke.value = 18;
  controls.armStroke.value = 16;
  controls.bucketStroke.value = 22;
  playToggle.textContent = "Run";
  playToggle.classList.remove("is-running");
  markModelDirty();
});

sampleButton.addEventListener("click", recordSample);
runIdealButton.addEventListener("click", () => runAutomatedExperiment("ideal"));
runTubeButton.addEventListener("click", () => runAutomatedExperiment("tube"));
runMinorButton.addEventListener("click", () => runAutomatedExperiment("minor"));
playToggle.addEventListener("click", () => {
  playToggle.textContent = running ? "Pause" : "Run";
});
resetButton.addEventListener("click", () => {
  playToggle.textContent = "Run";
});
exportCsv.addEventListener("click", exportTrialCsv);
clearLog.addEventListener("click", () => {
  logBody.textContent = "";
  trialLog.length = 0;
  chartSeries = [];
  chartTitle.textContent = "Run an experiment to generate curves";
  chartSummary.textContent = "The chart will compare ideal and real hydraulic predictions after an automated run.";
  runStatus.textContent = "Ready";
  drawChart();
});

window.addEventListener("resize", () => {
  resizeRenderer();
  drawChart();
});

syncReadouts();
drawChart();
if (initThree()) {
  renderModel(performance.now());
  requestAnimationFrame(tick);
}
