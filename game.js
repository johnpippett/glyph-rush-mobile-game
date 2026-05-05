const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const waveEl = document.querySelector("#wave");
const chargeEl = document.querySelector("#charge");
const hpBar = document.querySelector("#hpBar");
const overlay = document.querySelector("#overlay");
const startBtn = document.querySelector("#startBtn");
const pauseBtn = document.querySelector("#pauseBtn");

const state = {
  running: false,
  paused: false,
  score: 0,
  wave: 1,
  hp: 100,
  charge: 100,
  last: 0,
  shootTimer: 0,
  spawnTimer: 0,
  shake: 0,
  player: { x: 0, y: 0, r: 18, tx: 0, ty: 0, aimX: 0, aimY: -1 },
  bullets: [],
  enemies: [],
  pickups: [],
  particles: [],
  touches: new Map(),
};

let width = 0;
let height = 0;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!state.running) resetPlayer();
}

function resetPlayer() {
  state.player.x = width * 0.5;
  state.player.y = height * 0.72;
  state.player.tx = state.player.x;
  state.player.ty = state.player.y;
}

function newRun() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.wave = 1;
  state.hp = 100;
  state.charge = 100;
  state.last = performance.now();
  state.shootTimer = 0;
  state.spawnTimer = 0;
  state.shake = 0;
  state.bullets = [];
  state.enemies = [];
  state.pickups = [];
  state.particles = [];
  resetPlayer();
  overlay.hidden = true;
  pauseBtn.textContent = "Pause";
  requestAnimationFrame(loop);
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const pad = 40;
  const enemy = {
    x: side === 0 ? -pad : side === 1 ? width + pad : Math.random() * width,
    y: side === 2 ? -pad : side === 3 ? height + pad : Math.random() * height,
    r: 14 + Math.random() * 12,
    hp: 2 + Math.floor(state.wave / 3),
    speed: 48 + state.wave * 5 + Math.random() * 26,
    hue: Math.random() > 0.35 ? "#ff5b6b" : "#f0d45b",
  };
  state.enemies.push(enemy);
}

function fire(dt) {
  if (!state.touches.size || state.charge <= 0) return;
  state.shootTimer -= dt;
  if (state.shootTimer > 0) return;
  state.shootTimer = Math.max(0.08, 0.17 - state.wave * 0.004);
  state.charge = Math.max(0, state.charge - 1.7);
  const p = state.player;
  state.bullets.push({
    x: p.x + p.aimX * 22,
    y: p.y + p.aimY * 22,
    vx: p.aimX * 680,
    vy: p.aimY * 680,
    life: 0.8,
  });
}

function burst() {
  if (state.charge < 80) return;
  state.charge = 0;
  state.shake = 0.22;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    if (dist(e, state.player) < 210) killEnemy(i, e);
  }
  addParticles(state.player.x, state.player.y, "#36d6c6", 42, 5);
}

function killEnemy(index, enemy) {
  state.score += 10 + state.wave;
  state.enemies.splice(index, 1);
  addParticles(enemy.x, enemy.y, enemy.hue, 18, 3);
  if (Math.random() < 0.22) {
    state.pickups.push({
      x: enemy.x,
      y: enemy.y,
      r: 10,
      kind: Math.random() < 0.58 ? "charge" : "heal",
      life: 7,
    });
  }
  if (state.score >= state.wave * 140) state.wave += 1;
}

function addParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = (40 + Math.random() * 90) * speed;
    state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.45, color });
  }
}

function update(dt) {
  const p = state.player;
  p.x += (p.tx - p.x) * Math.min(1, dt * 10);
  p.y += (p.ty - p.y) * Math.min(1, dt * 10);
  p.x = clamp(p.x, 22, width - 22);
  p.y = clamp(p.y, 92, height - 84);
  state.charge = Math.min(100, state.charge + dt * 7);
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = Math.max(0.24, 1.15 - state.wave * 0.055);
    spawnEnemy();
  }
  fire(dt);

  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < width + 40 && b.y > -40 && b.y < height + 40);

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.x += Math.cos(a) * e.speed * dt;
    e.y += Math.sin(a) * e.speed * dt;
    if (dist(e, p) < e.r + p.r) {
      state.hp -= 16;
      state.shake = 0.18;
      addParticles(e.x, e.y, "#ff5b6b", 14, 2);
      state.enemies.splice(i, 1);
      if (state.hp <= 0) endRun();
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    for (let j = state.bullets.length - 1; j >= 0; j -= 1) {
      const b = state.bullets[j];
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
        e.hp -= 1;
        state.bullets.splice(j, 1);
        addParticles(b.x, b.y, "#f7fbff", 5, 1);
        if (e.hp <= 0) killEnemy(i, e);
        break;
      }
    }
  }

  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const item = state.pickups[i];
    item.life -= dt;
    if (dist(item, p) < item.r + p.r) {
      if (item.kind === "heal") state.hp = Math.min(100, state.hp + 22);
      else state.charge = Math.min(100, state.charge + 38);
      addParticles(item.x, item.y, item.kind === "heal" ? "#34d27f" : "#36d6c6", 15, 2);
      state.pickups.splice(i, 1);
    } else if (item.life <= 0) {
      state.pickups.splice(i, 1);
    }
  }

  for (const part of state.particles) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vx *= 0.9;
    part.vy *= 0.9;
    part.life -= dt;
  }
  state.particles = state.particles.filter((part) => part.life > 0);
  state.shake = Math.max(0, state.shake - dt);
  updateHud();
}

function draw() {
  const shakeX = (Math.random() - 0.5) * state.shake * 18;
  const shakeY = (Math.random() - 0.5) * state.shake * 18;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawWorld();
  for (const item of state.pickups) drawPickup(item);
  for (const b of state.bullets) drawBullet(b);
  for (const e of state.enemies) drawEnemy(e);
  drawPlayer();
  for (const part of state.particles) drawParticle(part);
  ctx.restore();
}

function drawWorld() {
  ctx.fillStyle = "#10151f";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  const grid = 42;
  for (let x = (performance.now() * 0.012) % grid; x < width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.aimY, p.aimX));
  ctx.fillStyle = "#36d6c6";
  ctx.shadowColor = "#36d6c6";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-15, -15);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-15, 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(e) {
  ctx.fillStyle = e.hue;
  ctx.shadowColor = e.hue;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.arc(e.x - e.r * 0.25, e.y - e.r * 0.2, e.r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullet(b) {
  ctx.strokeStyle = "#f7fbff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025);
  ctx.stroke();
}

function drawPickup(item) {
  ctx.fillStyle = item.kind === "heal" ? "#34d27f" : "#36d6c6";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(item.x, item.y - 13);
  ctx.lineTo(item.x + 12, item.y);
  ctx.lineTo(item.x, item.y + 13);
  ctx.lineTo(item.x - 12, item.y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawParticle(part) {
  ctx.globalAlpha = Math.max(0, part.life);
  ctx.fillStyle = part.color;
  ctx.beginPath();
  ctx.arc(part.x, part.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  waveEl.textContent = String(state.wave);
  chargeEl.textContent = `${Math.round(state.charge)}%`;
  hpBar.style.transform = `scaleX(${Math.max(0, state.hp) / 100})`;
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.033, (now - state.last) / 1000 || 0);
  state.last = now;
  if (!state.paused) update(dt);
  draw();
  requestAnimationFrame(loop);
}

function endRun() {
  state.running = false;
  overlay.hidden = false;
  overlay.querySelector("h1").textContent = `Run over. Score ${state.score}.`;
  overlay.querySelector("p").textContent = "Start again and use a two-finger tap when charge is full to clear nearby glyphs.";
  startBtn.textContent = "Restart";
}

function setPointer(e) {
  const p = state.player;
  const x = e.clientX;
  const y = e.clientY;
  state.touches.set(e.pointerId, { x, y });
  p.tx = x;
  p.ty = y;
  const dx = x - p.x;
  const dy = y - p.y;
  const mag = Math.hypot(dx, dy) || 1;
  p.aimX = dx / mag;
  p.aimY = dy / mag;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  setPointer(e);
  if (state.touches.size >= 2) burst();
});
canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerup", (e) => state.touches.delete(e.pointerId));
canvas.addEventListener("pointercancel", (e) => state.touches.delete(e.pointerId));

pauseBtn.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  state.last = performance.now();
});

startBtn.addEventListener("click", newRun);
window.addEventListener("resize", resize);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

resize();
draw();
