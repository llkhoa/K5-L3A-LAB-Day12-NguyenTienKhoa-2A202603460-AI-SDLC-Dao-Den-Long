import { worldFor, floorAt, blocked } from "./world.mjs";
export const T = Object.freeze({
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  night2_duration_s: 270,
  night3_duration_s: 300,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
});
export const DT = 1 / 60;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const round = (n) => Math.round(n * 1000) / 1000;
const posOut = (p) => p.map(round);
const idSort = (a, b) => a.id.localeCompare(b.id, "en", { numeric: true });
export function ring(n, r, c = [0, 0, 0], offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((offset + (i * 360) / n) * Math.PI) / 180;
    return [c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)];
  });
}
function direction(a, b) {
  const d = dist(a, b);
  return d > 1e-10 ? [(b[0] - a[0]) / d, (b[2] - a[2]) / d] : [1, 0];
}
export class Game {
  constructor({ seed = 1, night = 1, scenario = {} } = {}) {
    this.night = night;
    this.rng = seed >>> 0;
    this.tick = 0;
    this.sim_tick = 0;
    this.state = "playing";
    this.score = 0;
    this.events = [];
    this.map = worldFor(night);
    this.timeTicks = (scenario.time_left_s ?? this.map.duration) * 60;
    this.input = {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };
    this.spawn = night === 3 ? [0, 0, -30] : [0, 0, 0];
    this.player = {
      pos: [...this.spawn],
      vel: [0, 0, 0],
      carried: 0,
      flames: T.flames,
      grounded: true,
      invuln: 0,
      pulseCD: 0,
      respawn: 0,
      facing: [0, 1],
      dashCD: 0,
      dashTicks: 0,
      charm: 0,
      launch: null,
      successful_lights: scenario.player?.successful_lights ?? 0,
      ...structuredClone(scenario.player ?? {}),
    };
    this.player.grounded =
      this.player.pos[1] ===
      this.floorAt(this.player.pos[0], this.player.pos[2]);
    for (const [field, key] of Object.entries({
      invuln_ticks: "invuln",
      dash_cd_ticks: "dashCD",
      pulse_cd_ticks: "pulseCD",
      charm_ticks: "charm",
    }))
      this.player[key] = scenario.player?.[field] ?? 0;
    this.lanterns = this.map.lanterns.map((pos, i) => ({
      id: `L${i + 1}`,
      pos: [...pos],
      lit: false,
      deposited: 0,
      fuelTicks: 0,
      ever_lit: false,
      relit_count: 0,
    }));
    for (const item of scenario.lanterns ?? []) {
      const l = this.lanterns.find((l) => l.id === item.id);
      Object.assign(l, structuredClone(item));
      if (item.ever_lit !== undefined) l.ever_lit = item.ever_lit;
      if (item.relit_count !== undefined) l.relit_count = item.relit_count;
      if (item.fuel !== undefined) {
        l.fuelTicks = Math.round(item.fuel * 60);
        if (l.fuelTicks > 0) l.lit = true;
      } else if (l.lit) {
        l.fuelTicks = 100 * 60;
      }
      if (l.lit) {
        l.ever_lit = true;
        if (!l.fuelTicks) l.fuelTicks = 100 * 60;
        l.deposited = l.ever_lit && l.relit_count > 0 ? T.relight_cost : T.lantern_cost;
      }
      if (!l.lit) {
        l.fuelTicks = 0;
      }
    }
    this.motePoints = this.map.motes;
    this.shadePoints = this.map.shades;
    this.randomMotes = scenario.random_motes ?? true;
    this.randomShades = scenario.random_shades ?? true;
    this.moteId = 0;
    this.shadeId = 0;
    this.motes = [];
    this.shades = [];
    if (scenario.motes) for (const pos of scenario.motes) this.addMote(pos);
    else if (this.randomMotes) for (let i = 0; i < 20; i++) this.spawnMote();
    this.shadeId = Math.max(
      0,
      ...(scenario.shades ?? []).map((s) =>
        Number(s.id?.match(/^S(\d+)$/)?.[1] ?? 0),
      ),
    );
    for (const item of scenario.shades ?? []) this.addShade(item);
    this.randomDrifters = scenario.random_drifters ?? night > 1;
    this.windEnabled = scenario.wind_enabled ?? night === 3;
    this.wind = { active: false, dir_deg: 0 };
    this.nextWind = 0;
    this.drifterId = 0;
    this.drifters = [];
    this.drifterId = Math.max(
      0,
      ...(scenario.drifters ?? []).map((s) =>
        Number(s.id?.match(/^D(\d+)$/)?.[1] ?? 0),
      ),
    );
    for (const item of scenario.drifters ?? []) this.addDrifter(item);
    this.charms = (
      scenario.charms ??
      this.map.charms.map((pos, i) => ({ id: `C${i + 1}`, pos }))
    ).map((c, i) => ({
      id: c.id ?? `C${i + 1}`,
      pos: [...(c.pos ?? this.map.charms[i] ?? [0, 0, 0])],
      available: c.available ?? true,
      respawn: c.respawn_ticks ?? Math.round((c.respawn_s ?? 0) * 60),
    }));
  }
  random() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  emit(name, data = {}) {
    this.events.push({ type: "event", tick: this.tick, name, data });
  }
  addMote(pos, kind = "random", ttl = 0) {
    this.motes.push({
      id: `M${++this.moteId}`,
      pos: [...pos],
      kind,
      ttl,
      born: this.sim_tick,
    });
  }
  spawnMote() {
    const free = this.motePoints.filter(
      (p) =>
        !this.motes.some(
          (m) => dist(m.pos, p) < 0.1 && Math.abs(m.pos[1] - p[1]) < 0.1,
        ),
    );
    if (free.length && this.motes.length < 30)
      this.addMote(free[Math.floor(this.random() * free.length)]);
  }
  addShade(item = {}) {
    const id = item.id ?? `S${++this.shadeId}`;
    this.shadeId = Math.max(
      this.shadeId,
      Number(id.match(/^S(\d+)$/)?.[1] ?? 0),
    );
    this.shades.push({
      id,
      pos: [...(item.pos ?? [37, 0.8, 0])],
      state: item.state ?? "wander",
      remaining: item.state_ticks_left ?? 0,
      push: 0,
      pushDir: [1, 0],
      target_lantern_id: item.target_lantern_id ?? null,
      drainTicks: 0,
      born: -1,
    });
    this.shades.sort(idSort);
  }
  spawnShade() {
    const free = this.shadePoints.filter(
      (p) =>
        dist(p, this.player.pos) >= 15 &&
        !this.lanterns.some((l) => l.lit && dist(l.pos, p) < 6) &&
        !this.shades.some((s) => dist(s.pos, p) < 1),
    );
    if (this.shades.length >= this.map.shadeMax || !free.length) return;
    const p = free[Math.floor(this.random() * free.length)];
    this.addShade({
      pos: [p[0], p[1] + 0.8, p[2]],
      state: "spawning",
      state_ticks_left: 30,
    });
    const s = this.shades.at(-1);
    s.born = this.sim_tick;
    this.emit("shade_spawned", { id: s.id });
  }
  floorAt(x, z) {
    return floorAt(this.night, x, z);
  }
  movePlayer(edge) {
    const p = this.player;
    if (p.respawn > 0) {
      if (--p.respawn === 0) {
        p.pos = [...this.spawn];
        p.vel = [0, 0, 0];
        p.grounded = true;
        p.invuln = 90;
        p.launch = null;
        p.dashTicks = 0;
      }
      return;
    }
    let [x, z] = this.input.move;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    const a = (this.input.cam_yaw_deg * Math.PI) / 180;
    const dx = x * Math.cos(a) + z * Math.sin(a),
      dz = -x * Math.sin(a) + z * Math.cos(a);
    if (len > 0)
      p.facing = [
        dx / (Math.hypot(dx, dz) || 1),
        dz / (Math.hypot(dx, dz) || 1),
      ];
    const speed = p.charm > 0 ? 7.2 : T.player_speed;
    p.vel[0] = p.launch?.[0] ?? dx * speed;
    p.vel[2] = p.launch?.[1] ?? dz * speed;
    if (edge.jump && p.grounded) {
      p.vel[1] = 7;
      p.grounded = false;
    }
    if (edge.dash && !p.dashTicks && (p.dashCD === 0 || p.charm > 0)) {
      p.dashTicks = 12;
      p.dashDir = [...p.facing];
      p.dashCD = p.charm > 0 ? 0 : 90;
      this.emit("dash");
    }
    const isDash = p.dashTicks > 0;
    if (isDash) {
      p.vel[0] = p.dashDir[0] * 14;
      p.vel[2] = p.dashDir[1] * 14;
      p.dashTicks--;
    } else if (!p.grounded) p.vel[1] -= 20 * DT;
    const old = [...p.pos];
    const next = p.pos.map(
      (v, i) => v + (i === 1 && isDash ? 0 : p.vel[i] * DT),
    );
    if (blocked(this.night, old, next)) {
      next[0] = old[0];
      next[2] = old[2];
      p.vel[0] = 0;
      p.vel[2] = 0;
    }
    p.pos = next;
    const floor = this.floorAt(p.pos[0], p.pos[2]);
    if (
      p.pos[1] <= floor &&
      p.vel[1] <= 0 &&
      (old[1] >= floor - 0.31 || p.grounded)
    ) {
      p.pos[1] = floor;
      p.vel[1] = 0;
      p.grounded = true;
      p.launch = null;
    } else if (p.pos[1] > floor) p.grounded = false;
    if (p.grounded && !p.launch) {
      const pad = this.map.pads.find(
        (pad) =>
          dist(p.pos, pad.pos) <= 1 && Math.abs(p.pos[1] - pad.pos[1]) < 0.1,
      );
      if (pad) {
        const d = direction(pad.pos, pad.target);
        p.launch = [d[0] * pad.speed, d[1] * pad.speed];
        p.vel = [...p.vel];
        p.vel[0] = p.launch[0];
        p.vel[2] = p.launch[1];
        p.vel[1] = pad.vy;
        p.grounded = false;
      }
    }
    if (this.wind.active) {
      const a = (this.wind.dir_deg * Math.PI) / 180,
        windPos = [
          p.pos[0] + Math.cos(a) * 2 * DT,
          p.pos[1],
          p.pos[2] + Math.sin(a) * 2 * DT,
        ];
      if (!blocked(this.night, p.pos, windPos)) p.pos = windPos;
    }
    if (p.pos[1] < -10) {
      const lost = p.carried;
      p.flames--;
      p.carried = 0;
      p.respawn = 60;
      p.vel = [0, 0, 0];
      p.launch = null;
      p.dashTicks = 0;
      this.emit("player_hit", {
        by: "fall",
        flames: p.flames,
        dropped: 0,
        lost,
      });
    }
  }
  dropMotes(amount, pos = this.player.pos) {
    for (let i = 0; i < amount; i++) {
      const a = this.random() * Math.PI * 2,
        r = 1.5 + this.random();
      const x = pos[0] + Math.cos(a) * r,
        z = pos[2] + Math.sin(a) * r;
      const h = this.floorAt(x, z);
      this.addMote([x, Number.isFinite(h) ? h : pos[1], z], "dropped", 480);
    }
  }
  get capacity() {
    return Math.min(T.capacity_max, 10 + 2 * (this.player.successful_lights ?? 0));
  }
  pickup() {
    const p = this.player;
    if (p.respawn) return;
    const maxCap = this.capacity;
    this.motes = this.motes.filter((m) => {
      if (
        m.born === this.sim_tick ||
        p.carried >= maxCap ||
        dist(m.pos, p.pos) > T.pickup_radius + 1e-9 ||
        Math.abs(m.pos[1] - p.pos[1]) > 1.5
      )
        return true;
      p.carried++;
      this.emit("mote_picked", { carried: p.carried });
      return false;
    });
  }
  deposit() {
    const p = this.player;
    if (p.respawn || !p.carried) return;
    // Xét đèn nhận được: chưa sáng HOẶC (sáng nhưng chưa đầy dầu: used = min(carried, ceil((100 - fuel) / 10)) > 0)
    // Đèn đầy dầu (used = 0, tức fuel = 100 hay ceil((100 - fuel)/10) = 0) không được chọn khi tương tác
    const validLantern = (l) => {
      if (!l.lit) return true;
      const currentFuel = Math.round(l.fuelTicks / 6) / 10;
      if (currentFuel >= 100) return false;
      const needed = Math.ceil((100 - currentFuel) / 10);
      return Math.min(p.carried, needed) > 0;
    };
    const ls = this.lanterns
      .filter((l) => validLantern(l) && dist(l.pos, p.pos) <= T.interact_radius + 1e-9)
      .sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos) || idSort(a, b));
    const l = ls[0];
    if (!l) return;

    if (l.lit) {
      // Châm dầu: used = min(đang mang, ceil((100 - fuel) / 10))
      const currentFuel = Math.round(l.fuelTicks / 6) / 10;
      if (currentFuel >= 100) return;
      const neededMotes = Math.ceil((100 - currentFuel) / 10);
      const used = Math.min(p.carried, neededMotes);
      if (used <= 0) return;
      p.carried -= used;
      l.fuelTicks = Math.min(6000, l.fuelTicks + used * 10 * 60);
      this.score += used * 5;
      const fuelOut = Math.round(l.fuelTicks / 6) / 10;
      this.emit("refuel", { lantern_id: l.id, amount: used, fuel: fuelOut });
      // Nếu fuel được châm lên >= 30, đẩy Bóng Mực trong 6m
      if (l.fuelTicks >= 30 * 60) {
        this.ejectShadesFromLantern(l);
      }
    } else {
      // Thắp mới hoặc thắp lại
      const cost = l.ever_lit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(p.carried, cost - l.deposited);
      p.carried -= amount;
      l.deposited += amount;
      this.score += amount * 5;
      this.emit("deposit", { lantern_id: l.id, amount, deposited: l.deposited });
      if (l.deposited >= cost) {
        const isRelight = l.ever_lit;
        l.lit = true;
        l.ever_lit = true;
        l.fuelTicks = 6000;
        p.successful_lights = (p.successful_lights ?? 0) + 1;
        if (isRelight) {
          l.relit_count = (l.relit_count ?? 0) + 1;
          this.score += 40;
        } else {
          this.score += 100;
        }
        this.emit("lantern_lit", { lantern_id: l.id, relight: isRelight });
        this.ejectShadesFromLantern(l);
      }
    }
  }
  ejectShadesFromLantern(l) {
    for (const s of this.shades) {
      if (dist(l.pos, s.pos) < 6) {
        const d = direction(l.pos, s.pos);
        s.pos[0] = l.pos[0] + d[0] * 6;
        s.pos[2] = l.pos[2] + d[1] * 6;
        s.ejected = this.sim_tick;
        if (s.state === "drain" && s.target_lantern_id === l.id) {
          s.state = "wander";
          s.target_lantern_id = null;
          s.drainTicks = 0;
        }
      }
    }
  }
  pulse() {
    const p = this.player;
    if (p.respawn || p.pulseCD > 0 || p.carried < T.pulse_cost) return;
    p.carried -= T.pulse_cost;
    p.pulseCD = 180;
    const stunned = [];
    const inPulse = (s) =>
      Math.hypot(dist(s.pos, p.pos), s.pos[1] - (p.pos[1] + 0.8)) <=
      T.pulse_radius + 1e-9;
    for (const s of this.shades)
      if (inPulse(s)) {
        const wasDrain = s.state === "drain";
        s.state = "stunned";
        s.remaining = 120;
        s.push = 15;
        s.pushDir = direction(p.pos, s.pos);
        s.target_lantern_id = null;
        s.drainTicks = 0;
        stunned.push(s.id);
        this.score += wasDrain ? 15 : 5;
      }
    for (const d of this.drifters)
      if (inPulse(d)) {
        if (d.state === "chase") {
          d.state = "flee";
          d.remaining = 240;
          d.dir = direction(p.pos, d.pos);
        } else if (d.state === "flee" && d.stolen) {
          const amount = d.stolen;
          for (let i = 0; i < amount; i++)
            this.addMote(
              [d.pos[0], Number.isFinite(this.floorAt(d.pos[0], d.pos[2])) ? this.floorAt(d.pos[0], d.pos[2]) : d.pos[1] - .8, d.pos[2]],
              "dropped",
              480,
            );
          d.stolen = 0;
          d.remaining = 120;
          this.emit("drifter_drop", { drifter_id: d.id, amount });
        }
      }
    this.emit("pulse", { stunned_ids: stunned });
  }
  safeMove(s, dx, dz) {
    const next = [s.pos[0] + dx, s.pos[1], s.pos[2] + dz];
    const ground = this.floorAt(next[0], next[2]);
    if (
      !Number.isFinite(ground) ||
      blocked(
        this.night,
        [s.pos[0], s.pos[1] - 0.8, s.pos[2]],
        [next[0], next[1] - 0.8, next[2]],
      )
    )
      return;
    for (const l of this.lanterns)
      if (l.lit && l.fuelTicks >= 30 * 60 && dist(next, l.pos) < 6) {
        const d = direction(l.pos, next);
        next[0] = l.pos[0] + d[0] * 6;
        next[2] = l.pos[2] + d[1] * 6;
      }
    next[1] = Math.max(0.8, ground + 0.8);
    s.pos = next;
  }
  moveShades() {
    for (const s of this.shades) {
      if (s.born === this.sim_tick) continue;
      const safe = this.lanterns.find((l) => l.lit && l.fuelTicks >= 30 * 60 && dist(l.pos, s.pos) < 6);
      if (safe) {
        const d = direction(safe.pos, s.pos);
        s.pos[0] = safe.pos[0] + d[0] * 6;
        s.pos[2] = safe.pos[2] + d[1] * 6;
        continue;
      }
      if (s.state === "spawning") {
        if (s.remaining > 0) continue;
        s.state = "wander";
      }
      if (s.state === "stunned") {
        if (s.push > 0) {
          this.safeMove(s, (s.pushDir[0] * 4) / 15, (s.pushDir[1] * 4) / 15);
          s.push--;
        }
        if (s.remaining <= 0) s.state = "wander";
        else continue;
      }
      if (s.state === "recoil") {
        this.safeMove(s, (s.pushDir[0] * 2) / 60, (s.pushDir[1] * 2) / 60);
        if (s.remaining <= 0) s.state = "wander";
        continue;
      }

      // Xét khoảng cách tới Mây
      const dPlayer = dist(s.pos, this.player.pos);

      // Từ drain: sang chase nếu Mây vào trong <= 6m
      if (s.state === "drain") {
        if (dPlayer <= 6 && !this.player.respawn) {
          s.state = "chase";
          s.target_lantern_id = null;
          s.drainTicks = 0;
        } else {
          // Kiểm tra điều kiện duy trì drain
          const l = this.lanterns.find((lan) => lan.id === s.target_lantern_id);
          if (!l || !l.lit || l.fuelTicks >= 30 * 60 || dist(s.pos, l.pos) > 2 + 1e-9) {
            s.state = "wander";
            s.target_lantern_id = null;
            s.drainTicks = 0;
          } else {
            // Đang drain hợp lệ -> đứng yên
            continue;
          }
        }
      }

      // Xử lý chase
      if (s.state === "chase") {
        if (dPlayer > 18 || this.player.respawn) {
          s.state = "wander";
        } else {
          const dir = direction(s.pos, this.player.pos);
          this.safeMove(
            s,
            dir[0] * this.map.shadeSpeed * DT,
            dir[1] * this.map.shadeSpeed * DT,
          );
          continue;
        }
      }

      // Xử lý wander (chỉ wander mới bắt đầu chase hoặc chọn đèn yếu)
      if (s.state === "wander") {
        if (dPlayer <= 12 && !this.player.respawn) {
          s.state = "chase";
          s.target_lantern_id = null;
          const dir = direction(s.pos, this.player.pos);
          this.safeMove(
            s,
            dir[0] * this.map.shadeSpeed * DT,
            dir[1] * this.map.shadeSpeed * DT,
          );
          continue;
        }

        // Chọn đèn yếu: đèn sáng có fuel < 30 gần nhất (idSort nếu bằng)
        const weakLanterns = this.lanterns
          .filter((l) => l.lit && l.fuelTicks < 30 * 60)
          .sort((a, b) => dist(a.pos, s.pos) - dist(b.pos, s.pos) || idSort(a, b));
        
        let targetL = weakLanterns[0];
        if (!targetL) {
          // Không có đèn yếu: đi về đèn tắt gần nhất như trước
          const unlitLanterns = this.lanterns
            .filter((l) => !l.lit)
            .sort((a, b) => dist(a.pos, s.pos) - dist(b.pos, s.pos) || idSort(a, b));
          targetL = unlitLanterns[0];
        }

        if (targetL) {
          s.target_lantern_id = targetL.id;
          const dLantern = dist(s.pos, targetL.pos);
          if (targetL.lit && targetL.fuelTicks < 30 * 60 && dLantern <= 2 + 1e-9) {
            // Chuyển sang drain
            s.state = "drain";
            s.drainTicks = 0;
            continue;
          } else {
            // Đi tới đèn đó
            const dir = direction(s.pos, targetL.pos);
            this.safeMove(
              s,
              dir[0] * this.map.shadeSpeed * DT,
              dir[1] * this.map.shadeSpeed * DT,
            );
            continue;
          }
        }

        // Nếu không có bất kỳ đèn nào cần nhắm
        const angle =
          (Number(s.id.replace(/\D/g, "")) || 1) * 2.4 + this.sim_tick / 180;
        this.safeMove(s, Math.cos(angle) * DT, Math.sin(angle) * DT);
      }
    }
  }
  contacts() {
    const p = this.player;
    if (p.invuln || p.respawn) return;
    for (const s of this.shades) {
      if (
        s.born === this.sim_tick ||
        s.ejected === this.sim_tick ||
        ["stunned", "recoil", "spawning"].includes(s.state) ||
        this.lanterns.some((l) => l.lit && l.fuelTicks >= 30 * 60 && dist(l.pos, s.pos) < 6 - 1e-9)
      )
        continue;
      if (
        dist(s.pos, p.pos) <= 1 + 1e-9 &&
        Math.abs(s.pos[1] - p.pos[1]) <= 1.5
      ) {
        p.flames--;
        const dropped = Math.floor(p.carried * 0.5);
        p.carried -= dropped;
        p.invuln = 90;
        this.dropMotes(dropped);
        s.state = "recoil";
        s.remaining = 60;
        s.pushDir = direction(p.pos, s.pos);
        s.target_lantern_id = null;
        this.emit("player_hit", { by: "shade", flames: p.flames, dropped });
        break;
      }
    }
  }
  updateSafe() {
    for (const s of this.shades)
      for (const l of this.lanterns)
        if (l.lit && l.fuelTicks >= 30 * 60 && dist(l.pos, s.pos) < 6) {
          const d = direction(l.pos, s.pos);
          s.pos[0] = l.pos[0] + d[0] * 6;
          s.pos[2] = l.pos[2] + d[1] * 6;
          s.ejected = this.sim_tick;
        }
  }
  addDrifter(item = {}) {
    const id = item.id ?? `D${++this.drifterId}`;
    this.drifterId = Math.max(
      this.drifterId,
      Number(id.match(/^D(\d+)$/)?.[1] ?? 0),
    );
    this.drifters.push({
      id,
      pos: [...(item.pos ?? [37, 0.8, 0])],
      state: item.state ?? "idle",
      stolen: item.stolen ?? 0,
      remaining: item.state_ticks_left ?? 240,
      dir: item.dir ?? [1, 0],
      born: -1,
    });
    this.drifters.sort(idSort);
  }
  moveDrifters() {
    for (const d of this.drifters) {
      if (d.born === this.sim_tick) continue;
      const chase =
        this.player.carried >= 5 &&
        dist(d.pos, this.player.pos) <= 15 &&
        !this.player.respawn;
      if (d.state === "idle" && chase) d.state = "chase";
      else if (d.state === "chase" && !chase) d.state = "idle";
      if (d.state === "flee" && d.remaining <= 0) {
        d.state = "removed";
        continue;
      }
      let dir, speed;
      if (d.state === "chase") {
        dir = direction(d.pos, this.player.pos);
        speed = 7;
      } else if (d.state === "flee") {
        dir = d.dir;
        speed = 7;
      } else {
        const a = this.sim_tick / 120 + (Number(d.id.slice(1)) || 0);
        dir = [Math.cos(a), Math.sin(a)];
        speed = 2;
      }
      d.pos[0] += dir[0] * speed * DT;
      d.pos[2] += dir[1] * speed * DT;
    }
    this.drifters = this.drifters.filter((d) => d.state !== "removed");
  }
  drifterContacts() {
    if (this.player.respawn) return;
    for (const d of this.drifters)
      if (
        d.born !== this.sim_tick &&
        d.state === "chase" &&
        dist(d.pos, this.player.pos) <= 1.2
      ) {
        const amount = Math.min(3, this.player.carried);
        this.player.carried -= amount;
        d.stolen = amount;
        d.state = "flee";
        d.remaining = 240;
        d.dir = direction(this.player.pos, d.pos);
        this.emit("drifter_steal", {
          drifter_id: d.id,
          amount,
          carried: this.player.carried,
        });
      }
  }
  pickupCharms() {
    if (this.player.respawn) return;
    for (const c of this.charms)
      if (
        c.available &&
        dist(c.pos, this.player.pos) <= 1 &&
        Math.abs(c.pos[1] - this.player.pos[1]) <= 1.5
      ) {
        c.available = false;
        c.respawn = 2700;
        this.player.charm = 600;
        this.emit("charm_picked", { charm_id: c.id, charm_ticks: 600 });
      }
  }
  updateWind() {
    if (!this.windEnabled || this.night !== 3) {
      this.wind.active = false;
      return;
    }
    const phase = this.sim_tick % 1800;
    if (phase === 1680) this.nextWind = this.random() * 360;
    if (phase === 0) {
      this.wind.dir_deg = this.nextWind;
      this.wind.active = true;
    } else this.wind.active = this.sim_tick > 1800 && phase < 300;
  }
  finish() {
    let reason;
    if (this.player.flames <= 0) {
      this.state = "lost";
      reason = "no_flames";
    } else if (this.timeTicks <= 0) {
      // Hết giờ: xét số đèn đang sáng
      const litCount = this.lanterns.filter((l) => l.lit).length;
      const winThreshold = Math.ceil(0.6 * this.lanterns.length);
      if (litCount >= winThreshold) {
        this.state = "won";
        reason = "dawn_survived";
        // Điểm thưởng khi thắng: mỗi đèn đang sáng: +50 + floor(fuel), mỗi ngọn lửa: +50
        for (const l of this.lanterns) {
          if (l.lit) {
            const fuel = l.fuelTicks / 60;
            this.score += 50 + Math.floor(fuel);
          }
        }
        this.score += this.player.flames * 50;
      } else {
        this.state = "lost";
        reason = "dawn";
      }
    }
    if (reason) this.emit("game_over", { result: this.state, reason });
  }
  step(change = {}) {
    if (["won", "lost"].includes(this.state)) return [];
    this.events = [];
    const old = this.input;
    this.input = { ...old, ...change };
    const edge = Object.fromEntries(
      ["jump", "interact", "pulse", "dash", "pause"].map((k) => [
        k,
        !old[k] && this.input[k],
      ]),
    );
    this.tick++;
    if (edge.pause) {
      this.state = this.state === "paused" ? "playing" : "paused";
      this.emit(this.state === "paused" ? "paused" : "resumed");
    }
    if (this.state === "paused") return this.events;
    this.sim_tick++;
    if (this.sim_tick === 1) this.emit("night_start", { night: this.night });
    this.timeTicks = Math.max(0, this.timeTicks - 1);
    const p = this.player;
    for (const k of ["invuln", "pulseCD", "dashCD", "charm"])
      p[k] = Math.max(0, p[k] - 1);
    for (const s of this.shades) s.remaining = Math.max(0, s.remaining - 1);
    for (const d of this.drifters)
      if (d.state === "flee") d.remaining = Math.max(0, d.remaining - 1);
    this.motes = this.motes.filter((m) => m.kind !== "dropped" || --m.ttl > 0);
    for (const c of this.charms)
      if (!c.available && c.respawn > 0) {
        c.respawn--;
        if (c.respawn === 0) c.available = true;
      }

    // Giảm dầu đèn (hao tự nhiên 1/60 + bị hút 5/60 mỗi con đang drain)
    for (const l of this.lanterns) {
      if (l.lit) {
        // Tự hao 1/tick
        l.fuelTicks = Math.max(0, l.fuelTicks - 1);
      }
    }
    for (const s of this.shades) {
      if (s.state === "drain") {
        const l = this.lanterns.find((lan) => lan.id === s.target_lantern_id);
        if (l && l.lit) {
          l.fuelTicks = Math.max(0, l.fuelTicks - 5);
          s.drainTicks = (s.drainTicks ?? 0) + 1;
          if (s.drainTicks % 60 === 0) {
            const fuelOut = Math.round(l.fuelTicks / 6) / 10;
            this.emit("fuel_drain", { lantern_id: l.id, shade_id: s.id, fuel: fuelOut });
          }
        }
      }
    }
    // Ngay sau bước trừ dầu, đèn có fuel <= 0 thì tắt
    for (const l of this.lanterns) {
      if (l.lit && l.fuelTicks <= 0) {
        l.lit = false;
        l.fuelTicks = 0;
        l.deposited = 0;
        l.ever_lit = true;
        this.emit("lantern_out", { lantern_id: l.id });
      }
    }
    this.updateWind();
    this.movePlayer(edge);
    this.pickup();
    this.pickupCharms();
    if (edge.interact) this.deposit();
    this.updateSafe();
    if (edge.pulse) this.pulse();
    this.moveShades();
    this.moveDrifters();
    this.drifterContacts();
    this.contacts();
    if (this.randomMotes && this.sim_tick % 240 === 0) this.spawnMote();
    if (
      this.randomShades &&
      (this.sim_tick === 300 ||
        (this.sim_tick > 300 &&
          (this.sim_tick - 300) % this.map.shadeInterval === 0))
    ) {
      this.spawnShade();
      if (this.sim_tick === 300) this.spawnShade();
    }
    if (
      this.randomDrifters &&
      this.night > 1 &&
      this.sim_tick % 1200 === 0 &&
      this.drifters.length < 2
    ) {
      const p =
        this.shadePoints[Math.floor(this.random() * this.shadePoints.length)];
      this.addDrifter({ pos: [p[0], p[1] + 0.8, p[2]] });
      this.drifters.at(-1).born = this.sim_tick;
    }
    this.finish();
    return this.events;
  }
  snapshot() {
    const p = this.player;
    return {
      type: "snapshot",
      tick: this.tick,
      sim_tick: this.sim_tick,
      state: this.state,
      night: this.night,
      wind: { active: this.wind.active, dir_deg: round(this.wind.dir_deg) },
      time_left_s: round(this.timeTicks / 60),
      score: this.score,
      player: {
        pos: posOut(p.pos),
        vel: posOut(p.vel),
        grounded: p.grounded,
        invuln: p.invuln > 0,
        dash_cd_s: round(p.dashCD / 60),
        pulse_cd_s: round(p.pulseCD / 60),
        charm_s: round(p.charm / 60),
        flames: p.flames,
        carried: p.carried,
        capacity: this.capacity,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: posOut(l.pos),
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? Math.round(l.fuelTicks / 6) / 10 : 0,
        ever_lit: l.ever_lit ?? false,
        relit_count: l.relit_count ?? 0,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: posOut(s.pos),
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: posOut(m.pos),
        kind: m.kind,
        ttl_s: m.kind === "dropped" ? round(m.ttl / 60) : null,
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: posOut(d.pos),
        state: d.state,
        stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round(c.respawn / 60),
      })),
    };
  }
}
