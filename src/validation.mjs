const obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const num = (x) => typeof x === "number" && Number.isFinite(x);
function check(ok, message) {
  if (!ok) throw new Error(message);
}
function vector(v, n, label) {
  check(
    Array.isArray(v) && v.length === n && v.every(num),
    `${label}: cần vector ${n} số hữu hạn`,
  );
}
function count(v, label, max = Infinity) {
  check(
    Number.isInteger(v) && v >= 0 && v <= max,
    `${label}: số nguyên ngoài phạm vi`,
  );
}
export function validateInputs(data) {
  check(obj(data) && Array.isArray(data.frames), "inputs.frames phải là mảng");
  let last = -1;
  for (const f of data.frames) {
    check(obj(f), "frame phải là object");
    count(f.tick, "frame.tick");
    check(f.tick > last, "tick phải tăng nghiêm ngặt");
    last = f.tick;
    if ("move" in f) {
      vector(f.move, 2, "move");
      check(
        f.move.every((n) => Math.abs(n) <= 1),
        "move phải trong [-1,1]",
      );
    }
    if ("cam_yaw_deg" in f) check(num(f.cam_yaw_deg), "yaw không hợp lệ");
    for (const k of ["jump", "interact", "pulse", "dash", "pause"])
      if (k in f) check(typeof f[k] === "boolean", `${k} phải boolean`);
  }
  return data;
}
export function validateScenario(s, night = 1) {
  check(obj(s), "scenario phải là object");
  for (const k of [
    "random_motes",
    "random_shades",
    "random_drifters",
    "wind_enabled",
  ])
    if (k in s) check(typeof s[k] === "boolean", `${k} phải boolean`);
  if ("time_left_s" in s)
    check(num(s.time_left_s) && s.time_left_s >= 0, "time_left_s không hợp lệ");
  if ("player" in s) {
    check(obj(s.player), "player phải là object");
    const p = s.player;
    if ("pos" in p) vector(p.pos, 3, "player.pos");
    for (const k of [
      "carried",
      "flames",
      "invuln_ticks",
      "dash_cd_ticks",
      "pulse_cd_ticks",
      "charm_ticks",
    ])
      if (k in p)
        count(
          p[k],
          `player.${k}`,
          k === "carried" ? 10 : k === "flames" ? 3 : Infinity,
        );
  }
  for (const k of ["motes", "shades", "lanterns", "drifters", "charms"])
    if (k in s) {
      check(Array.isArray(s[k]), `${k} phải là mảng`);
      const ids = new Set();
      for (const e of s[k]) {
        if (k === "motes") {
          vector(e, 3, "mote");
          continue;
        }
        check(obj(e), `${k} item phải object`);
        if ("pos" in e) vector(e.pos, 3, `${k}.pos`);
        else if (k === "shades" || k === "drifters")
          throw new Error(`${k}.pos bắt buộc`);
        if (k === "lanterns")
          check(
            new RegExp(
              "^L[1-" + (night === 1 ? 5 : night === 2 ? 6 : 7) + "]$",
            ).test(e.id),
            "lantern id không tồn tại",
          );
        if ("id" in e) {
          check(
            typeof e.id === "string" && e.id.length > 0 && !ids.has(e.id),
            `${k}: id trùng hoặc không hợp lệ`,
          );
          ids.add(e.id);
        }
        for (const key of [
          "deposited",
          "state_ticks_left",
          "stolen",
          "respawn_ticks",
        ])
          if (key in e) count(e[key], key, key === "deposited" ? 10 : Infinity);
        if ("lit" in e) check(typeof e.lit === "boolean", "lit phải boolean");
        if ("available" in e)
          check(typeof e.available === "boolean", "available phải boolean");
        if ("respawn_s" in e)
          check(num(e.respawn_s) && e.respawn_s >= 0, "respawn_s không hợp lệ");
        if ("dir" in e) vector(e.dir, 2, "dir");
        if ("state" in e)
          check(
            (k === "shades"
              ? ["spawning", "wander", "chase", "recoil", "stunned"]
              : ["idle", "chase", "flee", "removed"]).includes(e.state),
            "state không hợp lệ",
          );
      }
    }
  return s;
}
