// Landing page hero: three phones in 3D (three.js) showing the app screenshots, floating and following
// the pointer. The middle one is a tap-through demo: tabs, a few buttons and Back switch between real
// screenshots (screens and tap areas come from the page's data-proto). Copied to web-seo/ by
// generate-web-seo.mjs. The CSS phone frames underneath stay visible until every texture has loaded,
// and remain the fallback without WebGL (the demo works on them too).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const stage = document.querySelector('.hero-stage');
const canvas = document.getElementById('hero3d');
const proto = stage ? JSON.parse(stage.dataset.proto) : null;

/** Demo navigation: where a tap at (u, v) (0–1 from the screenshot's top left) on `screen` leads. */
const demo = {
  current: proto?.start,
  history: [],
  listeners: [],
  target(u, v) {
    const spot = (proto.spots[this.current] ?? []).find(([x0, y0, x1, y1]) => u >= x0 && u <= x1 && v >= y0 && v <= y1);
    return spot?.[4];
  },
  tap(u, v) {
    const to = this.target(u, v);
    if (!to) return false;
    let next = to;
    if (to === 'back') next = this.history.pop() ?? proto.start;
    else if (proto.tabs.includes(to)) this.history = [];
    else this.history.push(this.current);
    if (next === this.current) return true;
    this.current = next;
    stage.dataset.screen = next; // for the e2e check and debugging
    this.listeners.forEach((f) => f(next));
    return true;
  },
};

if (stage && proto) {
  // CSS phones: the same demo on the middle phone's <img>.
  const img = stage.querySelector('.phones .phone:nth-child(2) img');
  img?.addEventListener('click', (e) => {
    const r = img.getBoundingClientRect();
    demo.tap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  img?.addEventListener('pointermove', (e) => {
    const r = img.getBoundingClientRect();
    img.style.cursor = demo.target((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) ? 'pointer' : '';
  });
  demo.listeners.push((id) => {
    if (img) img.src = proto.screens[id];
  });
}

if (stage && canvas) {
  try {
    main();
  } catch {
    // No WebGL: the CSS phones stay.
  }
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A rounded-rectangle plane whose UVs span the whole rectangle, so a screenshot fills it. */
function screenGeometry(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 12);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

function main() {
  const shots = JSON.parse(stage.dataset.shots);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  // A studio environment for the titanium and glass to reflect; without it metal renders flat black.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xf26a2e, 14, 8);
  rim.position.set(0, -0.4, -1.2);
  scene.add(rim);

  // iPhone 17 Pro proportions (71.9 × 150 × 8.75 mm), scaled to a 0.74-wide body. The display is
  // 1206 × 2622 like the screenshots, with a thin even black border and the Dynamic Island.
  const W = 0.74;
  const H = 1.557;
  const D = 0.088;
  const R = 0.117; // body corner radius
  const BEVEL = 0.01;
  const SW = 0.696; // screen
  const SH = SW * (2622 / 1206);
  const SR = 0.095;
  const front = D / 2;

  const titanium = new THREE.MeshPhysicalMaterial({
    color: 0x9a948d,
    metalness: 1,
    roughness: 0.3,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  });
  const blackGlass = new THREE.MeshPhysicalMaterial({
    color: 0x050505,
    metalness: 0,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  });
  const frameGeo = new THREE.ExtrudeGeometry(roundedRect(W - 2 * BEVEL, H - 2 * BEVEL, R - BEVEL), {
    depth: D - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 5,
    curveSegments: 24,
  });
  frameGeo.translate(0, 0, -(D - 2 * BEVEL) / 2);
  // The front glass sits inside a hair-thin titanium rim.
  const faceGeo = new THREE.ShapeGeometry(roundedRect(W - 0.012, H - 0.012, R - 0.006), 24);
  const screenGeo = screenGeometry(SW, SH, SR);
  const islandGeo = new THREE.ShapeGeometry(roundedRect(SW * 0.31, SW * 0.092, SW * 0.046), 12);
  const islandMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  // A faint reflection across the glass, stronger toward the top left.
  const sheenGeo = screenGeometry(W - 0.012, H - 0.012, R - 0.006);
  const sheenMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.05,
    clearcoat: 1,
  });

  // Side buttons as [side, top, length] in fractions of the body height: Action button and volume on
  // the left, side button and Camera Control on the right.
  const BUTTONS = [
    [-1, 0.2, 0.045],
    [-1, 0.29, 0.07],
    [-1, 0.39, 0.07],
    [1, 0.31, 0.11],
    [1, 0.6, 0.06],
  ];
  const buttonGeos = BUTTONS.map(([, , len]) => new RoundedBoxGeometry(0.012, len * H, 0.026, 3, 0.005));

  function buildPhone(tex) {
    const phone = new THREE.Group();
    phone.add(new THREE.Mesh(frameGeo, titanium));
    const face = new THREE.Mesh(faceGeo, blackGlass);
    face.position.z = front + 0.0005;
    phone.add(face);
    const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.z = front + 0.001;
    phone.add(screen);
    phone.userData.screen = screen;
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(0, SH / 2 - SW * 0.0275 - SW * 0.046, front + 0.0015);
    phone.add(island);
    const sheen = new THREE.Mesh(sheenGeo, sheenMat);
    sheen.position.z = front + 0.002;
    phone.add(sheen);
    BUTTONS.forEach(([side, top, len], i) => {
      const b = new THREE.Mesh(buttonGeos[i], titanium);
      b.position.set(side * (W / 2 + 0.002), H / 2 - (top + len / 2) * H, 0);
      phone.add(b);
    });
    return phone;
  }

  const layout = [
    { x: -0.84, y: -0.1, z: -0.4, ry: 0.5, rz: 0.07 },
    { x: 0, y: 0, z: 0, ry: 0, rz: 0 },
    { x: 0.84, y: -0.1, z: -0.4, ry: -0.5, rz: -0.07 },
  ];
  const group = new THREE.Group();
  scene.add(group);

  let loaded = 0;
  const loader = new THREE.TextureLoader();
  const phones = shots.map((src, i) => {
    const l = layout[i];
    const tex = loader.load(src, () => {
      if (++loaded === shots.length) {
        stage.classList.add('gl');
        render();
      }
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const phone = buildPhone(tex);
    phone.position.set(l.x, l.y, l.z);
    phone.rotation.set(0, l.ry, l.rz);
    group.add(phone);
    return phone;
  });

  // The demo on the middle phone: textures for every screen, a quick crossfade between them.
  // Loaded once the page is idle (or on the first tap), so they don't hold up the first paint.
  const demoTex = {};
  const demoTexture = (id) => {
    if (!demoTex[id]) {
      const tex = loader.load(proto.screens[id], () => requestAnimationFrame(render));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      demoTex[id] = tex;
    }
    return demoTex[id];
  };
  const preloadDemo = () => Object.keys(proto.screens).forEach(demoTexture);
  addEventListener('load', () => setTimeout(preloadDemo, 1500), { once: true });
  const middle = phones[1];
  const baseScreen = middle.userData.screen;
  const fade = new THREE.Mesh(
    screenGeo,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false }),
  );
  fade.position.z = front + 0.0012;
  middle.add(fade);
  let fadeStart = -1;
  demo.listeners.push((id) => {
    if (reduce) {
      baseScreen.material.map = demoTexture(id);
      baseScreen.material.needsUpdate = true;
      requestAnimationFrame(render); // a draw outside a frame may never reach the screen
      return;
    }
    fade.material.map = demoTexture(id);
    fade.material.needsUpdate = true;
    fadeStart = performance.now();
    press = 1;
    if (!visible) requestAnimationFrame(render);
  });
  let press = 0;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  /** (u, v) on the middle phone's screen under the pointer, or null. */
  function screenPoint(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(baseScreen)[0];
    return hit?.uv ? [hit.uv.x, 1 - hit.uv.y] : null;
  }
  // While the pointer is on the demo phone the tilt eases off, so buttons stay put under the cursor.
  let overScreen = false;
  canvas.addEventListener('pointerleave', () => (overScreen = false));
  canvas.addEventListener('click', (e) => {
    const p = screenPoint(e);
    if (p) demo.tap(p[0], p[1]);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = screenPoint(e);
    overScreen = !!p;
    canvas.style.cursor = p && demo.target(p[0], p[1]) ? 'pointer' : '';
  });

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit about ±1.3 wide (see halfW) and ±0.9 tall, whichever the stage's shape makes tighter.
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // On a narrow (portrait) stage, frame the demo phone and let the side phones peek in.
    const halfW = camera.aspect < 1 ? 0.65 : 1.3;
    camera.position.set(0, 0, Math.max(0.9 / t, halfW / (t * camera.aspect)));
    camera.updateProjectionMatrix();
    render();
  }

  const pointer = { x: 0, y: 0 };
  if (!reduce) {
    addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = (e.clientY / innerHeight) * 2 - 1;
    });
  }

  const clock = new THREE.Clock();
  function render() {
    renderer.render(scene, camera);
  }
  function frame() {
    if (!visible) return;
    const t = clock.getElapsedTime();
    phones.forEach((p, i) => {
      // The demo phone holds still under the pointer.
      const bob = Math.sin(t * 0.9 + i * 1.7) * 0.035;
      p.position.y += (layout[i].y + (overScreen && p === middle ? 0 : bob) - p.position.y) * 0.2;
    });
    if (fadeStart >= 0) {
      const k = Math.min(1, (performance.now() - fadeStart) / 220);
      fade.material.opacity = k;
      if (k === 1) {
        baseScreen.material.map = fade.material.map;
        baseScreen.material.needsUpdate = true;
        fade.material.opacity = 0;
        fadeStart = -1;
      }
    }
    press *= 0.85;
    middle.scale.setScalar(1 - press * 0.015);
    const tilt = overScreen ? 0.15 : 1;
    group.rotation.y += ((pointer.x * 0.28 + Math.sin(t * 0.25) * 0.08) * tilt - group.rotation.y) * 0.05;
    group.rotation.x += (pointer.y * 0.12 * tilt - group.rotation.x) * 0.05;
    render();
    requestAnimationFrame(frame);
  }

  // Animate only while the hero is on screen.
  let visible = false;
  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting && !reduce;
    if (visible && !was) requestAnimationFrame(frame);
  }).observe(stage);
  new ResizeObserver(resize).observe(stage);
  resize();
}
