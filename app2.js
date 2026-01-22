import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let balls = [];
let selectedBall = null;
let activeModal = false;

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let starLayers = [];



// Remove the old sky color highlightMaterial and replace with dynamic highlighting
function createHighlightMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.8, // Stronger glow when selected
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 1
  });
}

init();
loadData();

/* -------------------- INIT -------------------- */
/* -------------------- INIT -------------------- */
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0e11);
  scene.fog = new THREE.Fog(0x0e0e11, 25, 60);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 22);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "manipulation";

  controls = new OrbitControls(camera, renderer.domElement);

// Core behavior
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// Zoom (pinch)
controls.enableZoom = true;
controls.zoomSpeed = 0.8;

// Pan (move camera)
controls.enablePan = true;
controls.panSpeed = 1.2;
controls.screenSpacePanning = true;

// Rotate
controls.rotateSpeed = 0.6;

// Limits
controls.minDistance = 8;
controls.maxDistance = 60;

// Desktop
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};

// ✅ MOBILE — THIS IS THE IMPORTANT PART
controls.touches = {
  ONE: THREE.TOUCH.PAN,     // 1 finger = move
  TWO: THREE.TOUCH.DOLLY_ROTATE // 2 fingers = pinch + rotate
};

  // Reduce ambient light intensity or remove it
  scene.add(new THREE.AmbientLight(0xffffff, 0.3)); // Reduced from 1.2
  
  // Add directional light from camera position (front lighting)
  const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
  frontLight.position.copy(camera.position);
  scene.add(frontLight);
  
  // Add another light from above
  const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
  topLight.position.set(0, 10, 0);
  scene.add(topLight);

  createStars();

  window.addEventListener("resize", onResize);
  window.addEventListener("pointerdown", onPointerDown);

  animate();
}

/* -------------------- STARS (BACKGROUND) -------------------- */


function createStars() {
  // Very dense starfield
  createStarLayer(2500, 0.1, 0, 0.0008);     // Very distant tiny stars
  createStarLayer(1200, 0.2, 0, 0.0015);     // Distant small stars
  createStarLayer(600, 0.35, 0, 0.002);      // Medium stars
  createStarLayer(300, 0.6, 0, 0.0025);      // Closest bright stars
}

function createStarLayer(count, size, zBase, speed) {
  const positions = new Float32Array(count * 3);

  // Create stars in a large spherical volume around the origin
  // Using exponential distribution for more stars in distance
  for (let i = 0; i < count; i++) {
    // Exponential distribution - more stars at distance
    const radius = 50 + Math.pow(Math.random(), 2) * 150; // More stars farther away
    
    // Even distribution on sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1); // Better sphere distribution
    
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Add some variation to star colors
  const colorVariation = Math.random() * 0.3 + 0.7;
  const starColor = new THREE.Color(
    0.9 + Math.random() * 0.1,
    0.8 + Math.random() * 0.2,
    0.9 + Math.random() * 0.1
  );

  const mat = new THREE.PointsMaterial({
    color: starColor,
    size,
    transparent: true,
    opacity: 0.6 + Math.random() * 0.2, // Random opacity
    depthWrite: false,
    fog: false
  });

  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -10;
  stars.material.depthTest = false;

  stars.userData.speed = speed;
  stars.userData.originalPositions = positions.slice();
  stars.userData.time = 0;
  stars.userData.waveFactor = 0.2 + Math.random() * 0.3; // Random wave intensity

  scene.add(stars);
  starLayers.push(stars);
}

/* -------------------- DATA -------------------- */
async function loadData(filter = "all") {
  const res = await fetch("data.json");
  const data = await res.json();

  const filtered = filter === "all"
    ? data
    : data.filter(d => d.type === filter);

  clearBalls();
  createBalls(filtered);
}

/* -------------------- BALLS -------------------- */
function createBalls(items) {
  items.forEach(item => {
    // Load texture
    const previewImage = item.type === "red" ? "./images/red.png" : "./images/white.png";
    const tex = new THREE.TextureLoader().load(previewImage);
    
    // Add a subtle glow/emissive effect to the texture
    const color = item.type === "red" ? 0xff6b6b : 0xf8f9fa; // Brighter colors
    
    const geo = new THREE.CircleGeometry(1, 64);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      emissive: color, // Add emissive color
      emissiveIntensity: 0.2, // Subtle glow
      roughness: 0.0, // Less rough for shinier appearance
      metalness: 0.0 // Slight metallic sheen
    });

    const ball = new THREE.Mesh(geo, mat);

    ball.position.set(
      (Math.random() - 0.5) * 14,
      Math.random() * 3 + 1.2,
      (Math.random() - 0.5) * 6
    );

    ball.renderOrder = 1;
    ball.material.depthWrite = false;

    ball.userData = {
      ...item,
      originalMaterial: mat,
      originalEmissiveIntensity: 0.2,
      highlightColor: item.type === "red" ? 0xff4444 : 0xffffff // Different highlight per type
    };

    balls.push(ball);
    scene.add(ball);
  });
}

function clearBalls() {
  balls.forEach(b => scene.remove(b));
  balls = [];
}

/* -------------------- INTERACTION -------------------- */
/* -------------------- INTERACTION -------------------- */
function onPointerDown(e) {
  if (activeModal) return;

  // Prevent default to avoid any touch behaviors
  e.preventDefault();
  
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(balls);

  if (hits.length) {
    // Add a small delay to prevent immediate closing
    setTimeout(() => {
      openModal(hits[0].object);
    }, 50);
  }
}

/* -------------------- MODAL -------------------- */
function openModal(ball) {
  if (selectedBall) {
    selectedBall.material = selectedBall.userData.originalMaterial;
    selectedBall.material.emissiveIntensity = selectedBall.userData.originalEmissiveIntensity;
  }

  selectedBall = ball;
  activeModal = true;
  controls.enabled = false;

  // Create highlight material with grape-type specific color
  const highlightMat = createHighlightMaterial(ball.userData.highlightColor);
  
  // Store the highlight material for later removal
  ball.userData.highlightMaterial = highlightMat;
  ball.material = highlightMat;

  // Add pulsing animation
  ball.userData.pulseSpeed = 0.02;
  ball.userData.pulseIntensity = 0.3;
  ball.userData.pulseTime = 0;

  // Set modal content with new format
  document.getElementById("modalImage").src = ball.userData.image;
  
  // Update modal title and info with formatted text
  const formattedText = `
    <div class="modal-info-line"><strong>Grape name:</strong> ${ball.userData.name}</div></br>
    <div class="modal-info-line"><strong>Type:</strong> ${ball.userData.type.charAt(0).toUpperCase() + ball.userData.type.slice(1)}</div></br>
    <div class="modal-info-line"><strong>Type:</strong>  ${ball.userData.origin} </div></br>
    <div class="modal-info-line"><strong>About:</strong> ${ball.userData.additional_information}</div>
  `;
  
  document.getElementById("modalInfo").innerHTML = formattedText;

  const overlay = document.getElementById("modalOverlay");
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeModal() {
  // Prevent multiple rapid calls
  if (!activeModal) return;
  
  const overlay = document.getElementById("modalOverlay");
  overlay.classList.remove("open");

  setTimeout(() => {
    overlay.hidden = true;

    if (selectedBall) {
      selectedBall.material = selectedBall.userData.originalMaterial;
      if (selectedBall.userData.originalEmissiveIntensity !== undefined) {
        selectedBall.material.emissiveIntensity = selectedBall.userData.originalEmissiveIntensity;
      }
      
      // Clean up pulse data
      delete selectedBall.userData.pulseSpeed;
      delete selectedBall.userData.pulseIntensity;
      delete selectedBall.userData.pulseTime;
    }

    selectedBall = null;
    activeModal = false;
    controls.enabled = true;
  }, 250);
}

document.getElementById("modalClose").onclick = closeModal;
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target.id === "modalOverlay") closeModal();
});

window.addEventListener("keydown", e => {
  if (e.key === "Escape" && activeModal) closeModal();
});

/* -------------------- FILTER -------------------- */
document.querySelectorAll("button[data-filter]").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll("button").forEach(b =>
      b.classList.remove("active")
    );
    btn.classList.add("active");
    loadData(btn.dataset.filter);
  };
});

/* -------------------- ANIMATION -------------------- */
function animate() {
  requestAnimationFrame(animate);

  balls.forEach(ball => {
    ball.lookAt(camera.position);
    
    // Add pulsing effect for selected ball
    if (ball === selectedBall && ball.userData.pulseTime !== undefined) {
      ball.userData.pulseTime += ball.userData.pulseSpeed;
      const pulse = Math.sin(ball.userData.pulseTime) * ball.userData.pulseIntensity + 0.8;
      ball.material.emissiveIntensity = pulse;
      ball.scale.setScalar(1 + (pulse - 0.8) * 0.1); // Subtle scale pulsing
    }
  });

  controls.update();
  
  // Animate stars with parallax effect
  starLayers.forEach((layer, index) => {
    const time = Date.now() * 0.001 * layer.userData.speed;
    layer.userData.time = time;
    
    const positions = layer.geometry.attributes.position.array;
    const originalPositions = layer.userData.originalPositions;
    const waveFactor = layer.userData.waveFactor || 0.25;
    
    for (let i = 0; i < positions.length; i += 3) {
      const starId = i / 3;
      const offset = starId * 0.01;
      
      const waveX = 
        Math.sin(time + offset) * waveFactor +
        Math.cos(time * 0.7 + offset * 1.7) * waveFactor * 0.5;
      
      const waveY = 
        Math.cos(time + offset * 1.3) * waveFactor +
        Math.sin(time * 1.2 + offset * 2.1) * waveFactor * 0.5;
      
      const waveZ = 
        Math.sin(time * 0.8 + offset * 2.5) * waveFactor +
        Math.cos(time * 1.5 + offset * 1.9) * waveFactor * 0.5;
      
      positions[i] = originalPositions[i] + waveX;
      positions[i + 1] = originalPositions[i + 1] + waveY;
      positions[i + 2] = originalPositions[i + 2] + waveZ;
    }
    
    layer.geometry.attributes.position.needsUpdate = true;
  });

  renderer.render(scene, camera);
}

/* -------------------- RESIZE -------------------- */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
