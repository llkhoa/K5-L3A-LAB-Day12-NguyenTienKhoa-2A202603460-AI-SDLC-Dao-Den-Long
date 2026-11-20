const ring = (n, r, c = [0, 0, 0], offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((offset + (i * 360) / n) * Math.PI) / 180;
    return [c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)];
  });
export function worldFor(night) {
  if (night === 1)
    return {
      name: "Đảo Bến",
      duration: 240,
      islands: [[0, 0, 40]],
      lanterns: [
        [0, 0, 25],
        [23.8, 0, 7.7],
        [14.7, 0, -20.2],
        [-14.7, 0, -20.2],
        [-23.8, 0, 7.7],
      ],
      motes: [...ring(8, 12), ...ring(16, 33)],
      shades: ring(12, 37, [0, 0, 0], 15),
      shadeInterval: 480,
      shadeMax: 6,
      shadeSpeed: 4,
      pads: [],
      charms: [],
    };
  if (night === 2)
    return {
      name: "Đảo Cau",
      duration: 270,
      islands: [
        [0, 0, 28],
        [70, 0, 28],
      ],
      lanterns: [
        [0, 0, 20],
        [17, 0, -10],
        [-17, 0, -10],
        [70, 0, 20],
        [87, 0, -10],
        [53, 0, -10],
      ],
      motes: [
        ...ring(4, 10),
        ...ring(8, 22),
        ...ring(4, 10, [70, 0, 0]),
        ...ring(8, 22, [70, 0, 0]),
      ],
      shades: [
        ...ring(8, 26, [0, 0, 0], 22.5),
        ...ring(8, 26, [70, 0, 0], 22.5),
      ],
      shadeInterval: 420,
      shadeMax: 8,
      shadeSpeed: 4,
      pads: [
        { pos: [20, 0, 18], target: [70, 0, 0], vy: 14, speed: 24 },
        { pos: [50, 0, -18], target: [0, 0, 0], vy: 14, speed: 24 },
      ],
      charms: [[35, 0, 0]],
    };
  return {
    name: "Đảo Chuông",
    duration: 300,
    islands: [[0, 0, 45]],
    lanterns: [
      [0, 6, 6],
      [18, 3, 10],
      [-18, 3, 10],
      [35, 0, -10],
      [-35, 0, -10],
      [20, 0, -35],
      [-20, 0, -35],
    ],
    motes: [
      ...ring(18, 34),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = ((i + 1) * 20 * Math.PI) / 180;
        return [18 * Math.cos(a), 3, 18 * Math.sin(a)];
      }),
      ...ring(4, 5, [0, 6, 0], 45),
    ],
    shades: ring(16, 43),
    shadeInterval: 360,
    shadeMax: 10,
    shadeSpeed: 4.5,
    pads: [{ pos: [0, 3, 13], target: [0, 3, 0], vy: 12, speed: 8 }],
    charms: [
      [30, 0, 25],
      [-30, 0, 25],
    ],
  };
}
export function floorAt(night, x, z) {
  const r = Math.hypot(x, z);
  if (night === 1) return r <= 40 ? 0 : -Infinity;
  if (night === 2)
    return r <= 28 ||
      Math.hypot(x - 70, z) <= 28 ||
      (x >= 26 && x <= 44 && Math.abs(z) <= 2)
      ? 0
      : -Infinity;
  if (r > 45) return -Infinity;
  if (r <= 8) return 6;
  if (z > 0 && r >= 12 && r <= 24) return 3;
  for (const degrees of [30, 150]) {
    const a = (degrees * Math.PI) / 180,
      along = x * Math.cos(a) + z * Math.sin(a),
      across = -x * Math.sin(a) + z * Math.cos(a);
    if (along >= 24 && along <= 30 && Math.abs(across) <= 1.5)
      return (30 - along) / 2;
  }
  return 0;
}
export function blocked(night, from, to) {
  if (night === 3 && Math.hypot(to[0], to[2]) < 2 && to[1] < 14) return true;
  const floor = floorAt(night, to[0], to[2]),
    old = floorAt(night, from[0], from[2]);
  return floor > from[1] + 0.31 && floor > old + 0.31;
}
