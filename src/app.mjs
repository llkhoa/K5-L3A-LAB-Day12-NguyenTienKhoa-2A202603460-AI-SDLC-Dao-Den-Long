import * as THREE from "three";
import { Game, T, dist } from "./game.mjs";
import { buildWorld } from "./render-world.mjs";
import { worldFor } from "./world.mjs";
import { GameAudio } from "./audio.mjs";
const $ = (id) => document.getElementById(id),
  canvas = $("world");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  $("intro-copy").textContent =
    "Không tạo được WebGL. Hãy bật tăng tốc đồ họa trong trình duyệt rồi tải lại.";
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#0E1430");
scene.fog = new THREE.FogExp2("#1B2350", 0.012);
const camera = new THREE.PerspectiveCamera(
  52,
  innerWidth / innerHeight,
  0.1,
  220,
);
const ambient = new THREE.AmbientLight(0xb8c6ff, 0.65);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb4c9ff, 1.5);
moon.position.set(-20, 50, -15);
scene.add(moon);
const world = new THREE.Group();
scene.add(world);
const material = (color, emissive = null) =>
  new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...(emissive ? { emissive, emissiveIntensity: 1.3 } : {}),
  });
const mats = {
  grass: material("#2F5D50"),
  sand: material("#C9B48A"),
  rock: material("#253b43"),
  wood: material("#6B4A2F"),
  gold: material("#F2C14E"),
  cloth: material("#E8E2D0"),
  red: material("#C8102E"),
  dark: material("#120A1A"),
  purple: material("#7A3CFF", "#7A3CFF"),
  glow: material("#FFF6C2", "#FFE58A"),
  unlit: material("#5B5F6E"),
  lit: material("#FFB347", "#FFB347"),
  skin: material("#d9b38d"),
};
function mesh(geo, mat, pos, parent = world) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
mats.sea = material("#12384A");
mats.cloud = material("#243e57");
mats.stunned = material("#3A3450");
mats.drifter = material("#8FA3B8");
buildWorld(world, 1, mats);
const starsGeo = new THREE.BufferGeometry();
const stars = [];
for (let i = 0; i < 350; i++) {
  const a = i * 2.399,
    r = 80 + (i % 30);
  stars.push(Math.cos(a) * r, 30 + ((i * 17) % 70), Math.sin(a) * r);
}
starsGeo.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
scene.add(
  new THREE.Points(
    starsGeo,
    new THREE.PointsMaterial({ color: 0xffefd2, size: 0.2 }),
  ),
);
const may = new THREE.Group();
scene.add(may);
mesh(
  new THREE.CylinderGeometry(0.35, 0.5, 0.9, 8),
  mats.cloth,
  [0, 0.85, 0],
  may,
);
mesh(new THREE.SphereGeometry(0.3, 10, 8), mats.skin, [0, 1.55, 0], may);
mesh(new THREE.ConeGeometry(0.75, 0.42, 16), mats.sand, [0, 1.94, 0], may);
mesh(new THREE.TorusGeometry(0.35, 0.08, 5, 12), mats.red, [0, 1.25, 0], may);
mesh(new THREE.BoxGeometry(0.14, 0.55, 0.07), mats.red, [0.25, 1, 0.38], may);
const legs = [-1, 1].map((s) =>
  mesh(
    new THREE.BoxGeometry(0.2, 0.48, 0.22),
    mats.wood,
    [s * 0.22, 0.25, 0],
    may,
  ),
);
mesh(new THREE.SphereGeometry(0.13, 8, 6), mats.lit, [0.6, 1.45, 0.15], may);
const personalLight = new THREE.PointLight("#ffb347", 7, 9, 2);
personalLight.position.set(0.6, 1.5, 0.2);
may.add(personalLight);
let game = new Game(),
  playing = false,
  paused = false,
  settingsOpen = false,
  yaw = 0,
  pitch = 0.4,
  drag = false,
  lastPointer = null,
  totalScore = 0,
  currentNight = 1,
  pendingNight = null;
const lanternMeshes = new Map(),
  moteMeshes = new Map(),
  shadeMeshes = new Map(),
  drifterMeshes = new Map(),
  charmMeshes = new Map();
let frameTimes = [],
  last = performance.now(),
  accumulator = 0;
let settings;
try {
  settings = {
    volume: 0.35,
    sensitivity: 1,
    ...JSON.parse(localStorage.getItem("dao-den-long-settings") ?? "{}"),
  };
} catch {
  settings = { volume: 0.35, sensitivity: 1 };
}
const audio = new GameAudio(settings);
const sound = (freq, duration) => audio.tone(freq, duration);
function clearEntities() {
  for (const map of [
    lanternMeshes,
    moteMeshes,
    shadeMeshes,
    drifterMeshes,
    charmMeshes,
  ]) {
    for (const m of map.values()) {
      scene.remove(m);
      m.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
    }
    map.clear();
  }
}
function lantern(l) {
  const g = new THREE.Group();
  g.position.set(...l.pos);
  mesh(
    new THREE.CylinderGeometry(0.12, 0.2, 3.8, 8),
    mats.wood,
    [0, 1.9, 0],
    g,
  );
  mesh(new THREE.BoxGeometry(2.1, 0.15, 0.2), mats.wood, [0, 3.8, 0], g);
  const shell = mesh(
    new THREE.SphereGeometry(0.65, 12, 8),
    mats.unlit,
    [0, 3.1, 0],
    g,
  );
  shell.scale.y = 1.2;
  mesh(new THREE.ConeGeometry(0.9, 0.4, 8), mats.gold, [0, 4.05, 0], g);
  const light = new THREE.PointLight("#ffb347", 0, 15, 2);
  light.position.set(0, 3, 0);
  g.add(light);
  const zone = mesh(
    new THREE.RingGeometry(5.9, 6, 64),
    new THREE.MeshBasicMaterial({
      color: "#ffb347",
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    }),
    [0, 0.04, 0],
    g,
  );
  zone.rotation.x = -Math.PI / 2;
  zone.visible = false;
  g.userData = { shell, light, zone };
  scene.add(g);
  return g;
}
function syncEntities(t) {
  for (const l of game.lanterns) {
    if (!lanternMeshes.has(l.id)) lanternMeshes.set(l.id, lantern(l));
    const g = lanternMeshes.get(l.id);
    g.userData.shell.material = l.lit ? mats.lit : mats.unlit;
    g.userData.light.intensity = l.lit ? 24 : 0;
    g.userData.zone.visible = l.lit;
  }
  for (const c of game.charms) {
    if (!charmMeshes.has(c.id)) {
      const g = new THREE.Group();
      mesh(new THREE.BoxGeometry(0.55, 0.8, 0.08), mats.gold, [0, 0, 0], g);
      mesh(new THREE.BoxGeometry(0.43, 0.68, 0.1), mats.red, [0, 0, 0.01], g);
      scene.add(g);
      charmMeshes.set(c.id, g);
    }
    const g = charmMeshes.get(c.id);
    g.visible = c.available;
    g.position.set(c.pos[0], c.pos[1] + 0.8 + Math.sin(t * 2) * 0.1, c.pos[2]);
    g.rotation.y = t * 0.8;
  }
  for (const [id, g] of drifterMeshes)
    if (!game.drifters.some((d) => d.id === id)) {
      scene.remove(g);
      g.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      drifterMeshes.delete(id);
    }
  for (const d of game.drifters) {
    if (!drifterMeshes.has(d.id)) {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const s = mesh(
          new THREE.SphereGeometry(0.25, 6, 4),
          mats.drifter,
          [0, 0, -i * 0.35],
          g,
        );
        s.scale.set(1, 0.35, 1.6);
      }
      scene.add(g);
      drifterMeshes.set(d.id, g);
    }
    const g = drifterMeshes.get(d.id);
    g.position.set(d.pos[0], d.pos[1] + Math.sin(t * 5) * 0.1, d.pos[2]);
    g.rotation.y = Math.atan2(
      game.player.pos[0] - d.pos[0],
      game.player.pos[2] - d.pos[2],
    );
  }
  const ids = new Set(game.motes.map((m) => m.id));
  for (const [id, m] of moteMeshes)
    if (!ids.has(id)) {
      scene.remove(m);
      moteMeshes.delete(id);
    }
  for (const m of game.motes) {
    if (!moteMeshes.has(m.id)) {
      const g = new THREE.Group();
      mesh(new THREE.SphereGeometry(0.13, 6, 6), mats.glow, [0, 0, 0], g);
      const halo = mesh(
        new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshBasicMaterial({
          color: "#FFE58A",
          transparent: true,
          opacity: 0.13,
          depthWrite: false,
        }),
        [0, 0, 0],
        g,
      );
      g.userData.halo = halo;
      scene.add(g);
      moteMeshes.set(m.id, g);
    }
    const g = moteMeshes.get(m.id);
    g.position.set(
      m.pos[0],
      m.pos[1] + 0.55 + Math.sin(t * 2 + Number(m.id.slice(1))) * 0.14,
      m.pos[2],
    );
  }
  for (const s of game.shades) {
    if (!shadeMeshes.has(s.id)) {
      const g = new THREE.Group();
      mesh(new THREE.IcosahedronGeometry(0.65, 1), mats.dark, [0, 0, 0], g);
      mesh(
        new THREE.TorusGeometry(0.65, 0.05, 5, 16),
        mats.purple,
        [0, 0, 0],
        g,
      );
      for (const x of [-0.2, 0.2])
        mesh(
          new THREE.SphereGeometry(0.07, 6, 6),
          mats.purple,
          [x, 0.12, 0.57],
          g,
        );
      scene.add(g);
      shadeMeshes.set(s.id, g);
    }
    const g = shadeMeshes.get(s.id);
    g.position.set(...s.pos);
    g.rotation.y = Math.atan2(
      game.player.pos[0] - s.pos[0],
      game.player.pos[2] - s.pos[2],
    );
    g.scale.setScalar(s.state === "stunned" ? 0.75 : 1);
    g.children[0].material = s.state === "stunned" ? mats.stunned : mats.dark;
  }
}
const keys = new Set(),
  queued = new Set();
function input() {
  const pressed = (code) => keys.has(code) || queued.has(code);
  const result = {
    move: [
      Number(keys.has("KeyA") || keys.has("ArrowLeft")) -
        Number(keys.has("KeyD") || keys.has("ArrowRight")),
      Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown")),
    ],
    cam_yaw_deg: (yaw * 180) / Math.PI,
    jump: pressed("Space"),
    interact: pressed("KeyE"),
    pulse: pressed("KeyQ"),
    dash: pressed("ShiftLeft") || pressed("ShiftRight"),
    pause: false,
  };
  queued.clear();
  return result;
}
addEventListener("keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (["Escape", "KeyP"].includes(e.code) && !e.repeat && playing) {
    togglePause();
    return;
  }
  if (!e.repeat && playing && !paused) queued.add(e.code);
  keys.add(e.code);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  queued.clear();
  if (playing && !paused) togglePause();
});
canvas.addEventListener("pointerdown", (e) => {
  drag = true;
  lastPointer = [e.clientX, e.clientY];
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => (drag = false));
canvas.addEventListener("pointermove", (e) => {
  if (drag && lastPointer) {
    yaw -= (e.clientX - lastPointer[0]) * 0.006 * settings.sensitivity;
    pitch = Math.max(
      0.15,
      Math.min(0.9, pitch + (e.clientY - lastPointer[1]) * 0.003),
    );
    lastPointer = [e.clientX, e.clientY];
  }
});
function toast(text) {
  $("notice").textContent = text;
  setTimeout(() => {
    if ($("notice").textContent === text) $("notice").textContent = "";
  }, 2400);
}
function start(scenario = {}, night = currentNight) {
  currentNight = night;
  game = new Game({ seed: 42, night, scenario });
  buildWorld(world, night, mats);
  pendingNight = null;
  playing = true;
  paused = false;
  keys.clear();
  queued.clear();
  accumulator = 0;
  yaw = 0;
  clearEntities();
  $("overlay").hidden = true;
  $("dialog").hidden = true;
  $("hud").hidden = false;
  audio.start();
  sound(523, 0.3);
}
function dialog(title, copy) {
  $("dialog-title").textContent = title;
  $("dialog-copy").textContent = copy;
  $("dialog").hidden = false;
  $("settings-fields").hidden = true;
  $("resume").hidden = false;
  $("resume").textContent = "Tiếp tục";
  $("retry").hidden = !playing || game.state === "won";
  $("dialog-settings").hidden = false;
  $("next-night").hidden = true;
}
function setPaused(value) {
  if (
    (game.state === "playing" && value) ||
    (game.state === "paused" && !value)
  ) {
    game.input.pause = false;
    game.step({ pause: true });
    game.input.pause = false;
  }
  paused = value;
  keys.clear();
  queued.clear();
}
function togglePause() {
  if (!playing || ["won", "lost"].includes(game.state)) return;
  setPaused(!paused);
  if (paused) dialog("Một chút nghỉ chân", "Ánh đèn sẽ đợi bạn trở lại.");
  else $("dialog").hidden = true;
}
function end() {
  paused = true;
  const won = game.state === "won";
  if (won) totalScore += game.score;
  dialog(
    won
      ? currentNight === 3
        ? "Bình Minh"
        : "Ánh sáng đã trở về"
      : "Đêm vẫn còn dài",
    `${won ? (currentNight === 3 ? "Cả ba hòn đảo đã thức dậy trong ánh sáng." : "Một hòn đảo đã được thắp sáng. Hòn đảo tiếp theo đang đợi Mây.") : "Hãy thử lại, mỗi đốm sáng đều đáng quý."} Điểm Đêm: ${game.score}. Tổng các Đêm đã thắng: ${totalScore}.`,
  );
  $("resume").hidden = true;
  $("next-night").hidden = !won || currentNight === 3;
  audio.cue(won ? "won" : "lost");
}
function introduce(night) {
  pendingNight = night;
  paused = true;
  const messages = [
    "Đêm đã phủ xuống Đảo Bến. Gom đom đóm và thắp lại năm ngọn đèn.",
    "Qua cầu tre, theo những bục nhảy. Hãy coi chừng Gió Lạc đang rình những đốm sáng.",
    "Leo theo dốc, đến tháp chuông. Khi gió nổi, hãy giữ vững bước chân.",
  ];
  dialog(
    `Đêm ${night} — ${worldFor(night).name}`,
    `Ông Đăng: “${messages[night - 1]}”`,
  );
  $("retry").hidden = true;
  $("dialog-settings").hidden = true;
  $("resume").textContent = "Vào đảo";
}
$("play").onclick = () => {
  totalScore = 0;
  introduce(1);
};
$("next-night").onclick = () => introduce(currentNight + 1);
$("retry").onclick = () => start();
$("pause-button").onclick = togglePause;
$("resume").onclick = () => {
  if (pendingNight) {
    start({}, pendingNight);
    return;
  }
  if (settingsOpen) {
    settingsOpen = false;
    if (playing && paused)
      dialog("Một chút nghỉ chân", "Sẵn sàng tiếp tục hành trình?");
    else $("dialog").hidden = true;
  } else {
    setPaused(false);
    $("dialog").hidden = true;
  }
};
$("menu").onclick = () => {
  playing = false;
  paused = false;
  settingsOpen = false;
  pendingNight = null;
  currentNight = 1;
  totalScore = 0;
  game = new Game();
  buildWorld(world, 1, mats);
  clearEntities();
  $("dialog").hidden = true;
  $("overlay").hidden = false;
  $("hud").hidden = true;
};
function showSettings() {
  settingsOpen = true;
  if (playing && game.state === "playing") setPaused(true);
  dialog("Cài đặt", "Điều chỉnh cho chuyến đi của bạn.");
  $("settings-fields").hidden = false;
  $("dialog-settings").hidden = true;
  $("volume").value = settings.volume;
  $("sensitivity").value = settings.sensitivity;
}
$("settings").onclick = showSettings;
$("dialog-settings").onclick = showSettings;
for (const id of ["volume", "sensitivity"])
  $(id).oninput = (e) => {
    settings[id] = Number(e.target.value);
    try {
      localStorage.setItem("dao-den-long-settings", JSON.stringify(settings));
    } catch {
      toast("Trình duyệt không cho lưu cài đặt.");
    }
  };
function hud() {
  const p = game.player;
  $("flames").textContent =
    "✦".repeat(Math.max(0, p.flames)) + "·".repeat(3 - Math.max(0, p.flames));
  const seconds = Math.ceil(game.timeTicks / 60);
  $("clock").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  $("clock").parentElement.classList.toggle("danger", seconds <= 30);
  $("night-name").textContent =
    `ĐÊM ${currentNight} · ${game.map.name.toUpperCase()}`;
  $("lit").textContent =
    `${game.lanterns.filter((l) => l.lit).length} / ${game.lanterns.length}`;
  $("score").textContent = `${game.score} điểm`;
  $("carried-count").textContent = `${p.carried} / 10`;
  if ($("slots").dataset.count !== String(p.carried)) {
    $("slots").innerHTML = Array.from(
      { length: 10 },
      (_, i) => `<i class="${i < p.carried ? "full" : ""}"></i>`,
    ).join("");
    $("slots").dataset.count = String(p.carried);
  }
  $("pulse-cd").textContent =
    p.pulseCD > 0 ? `${(p.pulseCD / 60).toFixed(1)}s` : "3 đom đóm";
  $("dash-cd").textContent =
    p.charm > 0
      ? `Bùa Gió ${Math.ceil(p.charm / 60)}s`
      : p.dashCD > 0
        ? `${(p.dashCD / 60).toFixed(1)}s`
        : "Sẵn sàng";
  const near = game.lanterns
    .filter((l) => !l.lit)
    .sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos))[0];
  $("prompt").hidden = !near || dist(near.pos, p.pos) > 2;
  if (near) {
    $("prompt").textContent = `E — Nạp ánh sáng (${near.deposited}/10)`;
    const projected = new THREE.Vector3(...near.pos)
      .add(new THREE.Vector3(0, 3, 0))
      .project(camera);
    const off =
      Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || projected.z > 1;
    const angle =
      Math.atan2(near.pos[0] - p.pos[0], near.pos[2] - p.pos[2]) - yaw;
    const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
    const arrow = arrows[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
    $("direction").textContent =
      `${off ? arrow + " " : ""}${near.id} · ${Math.round(dist(near.pos, p.pos))} m`;
  } else $("direction").textContent = "";
}
function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - last) / 1000, 0.1);
  frameTimes.push(now - last);
  if (frameTimes.length > 600) frameTimes.shift();
  last = now;
  const t = now / 1000;
  if (playing && !paused) {
    accumulator += elapsed;
    while (accumulator >= 1 / 60) {
      const controls = input();
      if (controls.jump && !game.input.jump && game.player.grounded)
        audio.cue("jump");
      const events = game.step(controls);
      audio.music(game.sim_tick);
      if (game.sim_tick % 60 === 0 && game.timeTicks <= 600)
        audio.cue("countdown");
      if (game.windEnabled && game.sim_tick % 1800 === 1680) {
        audio.cue("wind");
        toast("Lá đang bay — gió mạnh sắp tới!");
      }
      accumulator -= 1 / 60;
      for (const e of events) {
        if (
          [
            "dash",
            "shade_spawned",
            "charm_picked",
            "drifter_steal",
            "drifter_drop",
          ].includes(e.name)
        )
          audio.cue(e.name);
        if (e.name === "mote_picked") sound(880, 0.08);
        if (e.name === "lantern_lit") {
          sound(659, 0.5);
          toast("Một ngọn đèn đã sáng!");
        }
        if (e.name === "pulse") {
          sound(330, 0.3);
          pulseRing.position.set(...game.player.pos);
          pulseRing.position.y += 0.15;
          pulseAge = 0;
        }
        if (e.name === "player_hit") {
          sound(147, 0.2);
          toast(
            e.data.by === "fall"
              ? "Mây đang tìm đường trở lại đảo…"
              : "Bóng Mực chạm vào Mây!",
          );
        }
      }
      if (["won", "lost"].includes(game.state)) {
        end();
        break;
      }
    }
  }
  updateLeaves(t);
  syncEntities(t);
  may.position.set(...game.player.pos);
  may.rotation.y = Math.atan2(...game.player.facing);
  may.visible =
    !game.player.respawn && !(game.player.invuln > 0 && Math.floor(t * 12) % 2);
  const walking = Math.hypot(game.player.vel[0], game.player.vel[2]) > 0;
  legs.forEach(
    (l, i) =>
      (l.rotation.x = walking ? Math.sin(t * 12 + i * Math.PI) * 0.5 : 0),
  );
  ambient.intensity =
    0.15 +
    (0.55 * game.lanterns.filter((l) => l.lit).length) / game.lanterns.length;
  if (playing) {
    const p = game.player.pos;
    const target = new THREE.Vector3(
      p[0] - Math.sin(yaw) * 13,
      p[1] + 3 + pitch * 5,
      p[2] - Math.cos(yaw) * 13,
    );
    camera.position.lerp(target, 0.12);
    camera.lookAt(p[0], p[1] + 1.2, p[2]);
    hud();
  } else {
    camera.position.set(40 + Math.sin(t * 0.03) * 3, 29, 44);
    camera.lookAt(0, 1, 0);
  }
  if (pulseAge < 1) {
    pulseAge += elapsed;
    pulseRing.visible = true;
    pulseRing.scale.setScalar(Math.min(5, pulseAge * 12));
    pulseRing.material.opacity = 1 - pulseAge;
  } else pulseRing.visible = false;
  renderer.render(scene, camera);
}
const leaves = new THREE.Group();
scene.add(leaves);
for (let i = 0; i < 12; i++) {
  const leaf = mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    mats.gold,
    [0, 0, 0],
    leaves,
  );
  leaf.scale.set(2, 0.3, 1);
}
function updateLeaves(t) {
  leaves.visible =
    playing &&
    game.windEnabled &&
    (game.wind.active || game.sim_tick % 1800 >= 1680);
  if (leaves.visible)
    leaves.children.forEach((leaf, i) => {
      leaf.position.set(
        game.player.pos[0] + ((t * 5 + i * 2) % 14) - 7,
        game.player.pos[1] + 0.5 + (i % 5) * 0.5,
        game.player.pos[2] + Math.sin(i * 2.4) * 5,
      );
      leaf.rotation.y = t + i;
    });
}
const pulseRing = mesh(
  new THREE.RingGeometry(0.9, 1, 64),
  new THREE.MeshBasicMaterial({
    color: "#ffe58a",
    transparent: true,
    side: THREE.DoubleSide,
  }),
  [0, 0.1, 0],
  scene,
);
pulseRing.rotation.x = -Math.PI / 2;
let pulseAge = 2;
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
requestAnimationFrame(frame);
// Opt-in test bridge is available only with ?test=1; it uses the same Game instance.
if (new URLSearchParams(location.search).has("test"))
  window.__lab = {
    start,
    get game() {
      return game;
    },
    get fps() {
      return 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length);
    },
    get renderer() {
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
    },
    get totalScore() {
      return totalScore;
    },
    resetFps: () => {
      frameTimes = [];
    },
    snapshot: () => game.snapshot(),
    step: (change) => game.step(change),
    pause: () => {
      paused = true;
    },
    render: () => renderer.render(scene, camera),
  };
