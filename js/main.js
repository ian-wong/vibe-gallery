import * as THREE from 'three';
import { PROJECTS } from './data.js';

const gsap = window.gsap;

// ───────────────────────── config ─────────────────────────
const RADIUS = 10;
const COLS = 14;                      // cells around the full 360°
const ROWS = 5;                       // vertical bands
const CELL_PHI = (Math.PI * 2) / COLS;
const CELL_THETA = THREE.MathUtils.degToRad(18);
const THETA_START = Math.PI / 2 - (ROWS / 2) * CELL_THETA;

const DRAG_SPEED = 0.0021;
const EASE = 0.075;                   // lenis-style lerp factor
const LAT_LIMIT = THREE.MathUtils.degToRad(34);

// ───────────────────────── three setup ─────────────────────────
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d0d);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = 'YXZ';

// ───────────────────────── card textures ─────────────────────────
const TEX_W = 1280;
const TEX_H = 800;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCard(ctx, p, img, highlight) {
  const W = TEX_W, H = TEX_H;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = highlight ? '#4d0e0e' : '#121212';
  ctx.fillRect(0, 0, W, H);

  // hairline cell border
  ctx.strokeStyle = highlight ? '#6b2020' : '#2a2a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // client name — top left
  ctx.fillStyle = '#f0ede6';
  ctx.font = '700 34px Archivo, Helvetica, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(p.client, 52, 72);

  // project title — top right (mono, tracked out)
  ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#d8d4cc';
  ctx.textAlign = 'right';
  ctx.fillText(p.title.split('').join(' '), W - 52, 74);

  // centred image
  const size = 430;
  const ix = (W - size) / 2;
  const iy = (H - size) / 2 + 8;
  if (img) {
    ctx.drawImage(img, ix, iy, size, size);
  } else {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(ix, iy, size, size);
  }

  // tags — bottom left
  ctx.font = '500 21px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  let tx = 52;
  const ty = H - 64;
  p.tags.forEach((tag, i) => {
    const tw = ctx.measureText(tag).width;
    const padX = 18, pillH = 44;
    ctx.fillStyle = highlight && i === 0 ? '#8c1d1d' : 'rgba(255,255,255,.10)';
    roundedRect(ctx, tx, ty - pillH / 2, tw + padX * 2, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = '#d8d4cc';
    ctx.fillText(tag, tx + padX, ty + 2);
    tx += tw + padX * 2 + 12;
  });

  // year — bottom right
  ctx.fillStyle = '#8d8a84';
  ctx.textAlign = 'right';
  ctx.fillText(p.year, W - 52, ty + 2);
}

// ───────────────────────── build the sphere grid ─────────────────────────
const group = new THREE.Group();
scene.add(group);

const cards = [];
const imageCache = new Map();

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

let fontsReady = false;
const pendingRedraw = [];

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    // offset each row so the same project never stacks vertically
    const p = PROJECTS[(col + row * 5) % PROJECTS.length];
    // feature the highlighted project once, in the middle band where it's visible
    const highlight = p.highlight && row === Math.floor(ROWS / 2) && col < COLS - 2;

    const texCanvas = document.createElement('canvas');
    texCanvas.width = TEX_W;
    texCanvas.height = TEX_H;
    const ctx = texCanvas.getContext('2d');
    drawCard(ctx, p, null, highlight);

    const tex = new THREE.CanvasTexture(texCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1; // un-mirror for inside-the-sphere viewing

    const geo = new THREE.SphereGeometry(
      RADIUS, 24, 16,
      col * CELL_PHI, CELL_PHI,
      THETA_START + row * CELL_THETA, CELL_THETA
    );
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { project: p, ctx, tex, highlight };
    group.add(mesh);
    cards.push(mesh);

    loadImage(p.img).then((img) => {
      const redraw = () => { drawCard(ctx, p, img, highlight); tex.needsUpdate = true; };
      fontsReady ? redraw() : pendingRedraw.push(redraw);
    });
  }
}

// redraw everything once webfonts are in so card text uses the real faces
document.fonts.ready.then(() => {
  fontsReady = true;
  cards.forEach((m) => {
    const { project, ctx, tex, highlight } = m.userData;
    const cached = imageCache.get(project.img);
    if (cached) cached.then((img) => { drawCard(ctx, project, img, highlight); tex.needsUpdate = true; });
  });
  pendingRedraw.length = 0;
});

// ───────────────────────── drag / scroll with inertia ─────────────────────────
const rot = { lon: 0, lat: 0 };          // rendered rotation
const target = { lon: 0, lat: 0 };       // where we're easing to

let dragging = false;
let detailOpen = false;
let downX = 0, downY = 0, lastX = 0, lastY = 0;
let velX = 0, velY = 0;
let moved = 0;

canvas.addEventListener('pointerdown', (e) => {
  if (detailOpen) return;
  dragging = true;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
  downX = lastX = e.clientX;
  downY = lastY = e.clientY;
  velX = velY = 0;
  moved = 0;
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) { hoverCheck(e); return; }
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  target.lon += dx * DRAG_SPEED;
  target.lat += dy * DRAG_SPEED;
  velX = dx;
  velY = dy;
  clampLat();
});

canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove('dragging');
  // fling
  target.lon += velX * DRAG_SPEED * 14;
  target.lat += velY * DRAG_SPEED * 14;
  clampLat();
  if (moved < 6) handleClick(e);
});

window.addEventListener('wheel', (e) => {
  if (detailOpen) return;
  target.lon -= e.deltaX * 0.00045;
  target.lat -= e.deltaY * 0.00045;
  clampLat();
}, { passive: true });

function clampLat() {
  target.lat = THREE.MathUtils.clamp(target.lat, -LAT_LIMIT, LAT_LIMIT);
}

// ───────────────────────── raycasting ─────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pick(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(cards);
  return hits.length ? hits[0].object : null;
}

let hovered = null;
function hoverCheck(e) {
  if (detailOpen) return;
  const hit = pick(e);
  if (hit !== hovered) {
    if (hovered) gsap.to(hovered.material.color, { r: 1, g: 1, b: 1, duration: 0.3 });
    hovered = hit;
    if (hovered) gsap.to(hovered.material.color, { r: 1.25, g: 1.25, b: 1.25, duration: 0.3 });
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }
}

function handleClick(e) {
  const hit = pick(e);
  if (hit) openDetail(hit.userData.project);
}

// ───────────────────────── detail page ─────────────────────────
const detail = document.getElementById('detail');
const detailScroll = document.getElementById('detail-scroll');
const els = {
  client: document.getElementById('detail-client-label'),
  title: document.getElementById('detail-title'),
  tags: document.getElementById('detail-tags'),
  year: document.getElementById('detail-year'),
  hero: document.getElementById('detail-hero-img'),
  blurb: document.getElementById('detail-blurb'),
  extraImgs: document.getElementById('detail-extra-imgs'),
  related: document.getElementById('related-grid'),
  liveBtn: document.getElementById('detail-live-btn'),
};

function populateDetail(p) {
  document.documentElement.style.setProperty('--detail-accent', p.accent);
  document.documentElement.style.setProperty('--detail-ink', p.ink);
  els.client.textContent = p.client;
  els.title.textContent = p.title;
  els.year.textContent = p.year;
  els.tags.innerHTML = p.tags.map((t) => `<span>${t}</span>`).join('');
  if (p.link) {
    els.liveBtn.href = p.link;
    els.liveBtn.style.display = '';
  } else {
    els.liveBtn.style.display = 'none';
  }
  els.hero.src = p.images[0] || p.img;
  els.extraImgs.innerHTML = p.images
    .slice(1)
    .map((src) => `<figure class="detail-img"><img src="${src}" alt="${p.title}" /></figure>`)
    .join('');
  els.blurb.textContent = p.blurb;

  const others = PROJECTS.filter((o) => o.id !== p.id).slice(0, 3);
  els.related.innerHTML = others
    .map(
      (o) => `
      <div class="related-card" data-id="${o.id}">
        <img src="${o.img}" alt="${o.title}" />
        <div class="rc-meta"><span>● ${o.title}</span><span class="rc-client">${o.client}</span></div>
      </div>`
    )
    .join('');
  els.related.querySelectorAll('.related-card').forEach((card) => {
    card.addEventListener('click', () => {
      const next = PROJECTS.find((o) => o.id === card.dataset.id);
      swapDetail(next);
    });
  });
}

function openDetail(p) {
  if (detailOpen) return;
  detailOpen = true;
  populateDetail(p);
  detailScroll.scrollTop = 0;
  document.body.classList.add('detail-open');
  detail.setAttribute('aria-hidden', 'false');

  gsap.timeline()
    .set(detail, { visibility: 'visible' })
    .to(camera, { fov: 40, duration: 1, ease: 'power3.inOut', onUpdate: () => camera.updateProjectionMatrix() }, 0)
    .fromTo(detail, { yPercent: 100, y: 0 }, { yPercent: 0, duration: 0.95, ease: 'power4.inOut' }, 0.05)
    .fromTo(
      '.detail-title',
      { yPercent: 35, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out' },
      0.55
    );
}

function swapDetail(p) {
  gsap.timeline()
    .to('.detail-inner, .related', { autoAlpha: 0, duration: 0.25, ease: 'power2.in' })
    .add(() => { populateDetail(p); detailScroll.scrollTop = 0; })
    .to('.detail-inner, .related', { autoAlpha: 1, duration: 0.4, ease: 'power2.out' });
}

function closeDetail() {
  if (!detailOpen) return;
  document.body.classList.remove('detail-open');
  gsap.timeline()
    .to(detail, { yPercent: 100, duration: 0.85, ease: 'power4.inOut' }, 0)
    .to(camera, { fov: 56, duration: 1, ease: 'power3.inOut', onUpdate: () => camera.updateProjectionMatrix() }, 0)
    .set(detail, { visibility: 'hidden' })
    .add(() => {
      detail.setAttribute('aria-hidden', 'true');
      detailOpen = false;
    });
}

document.getElementById('detail-close').addEventListener('click', closeDetail);
document.getElementById('logo-home').addEventListener('click', closeDetail);
document.getElementById('see-all').addEventListener('click', closeDetail);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

// ───────────────────────── render loop ─────────────────────────
function animate() {
  requestAnimationFrame(animate);
  rot.lon += (target.lon - rot.lon) * EASE;
  rot.lat += (target.lat - rot.lat) * EASE;
  camera.rotation.y = rot.lon;
  camera.rotation.x = rot.lat;
  renderer.render(scene, camera);
}
animate();

// intro — drift in from a wider, rotated view
camera.fov = 78;
camera.updateProjectionMatrix();
rot.lon = -0.55;
target.lon = 0;
gsap.to(camera, {
  fov: 56,
  duration: 1.8,
  ease: 'expo.out',
  delay: 0.15,
  onUpdate: () => camera.updateProjectionMatrix(),
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
