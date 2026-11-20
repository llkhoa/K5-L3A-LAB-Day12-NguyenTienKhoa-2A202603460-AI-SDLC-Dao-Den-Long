import * as THREE from "three";
import { worldFor } from "./world.mjs";
export function buildWorld(world, night, mats) {
  world.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
  world.clear();
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    world.add(m);
    return m;
  };
  const map = worldFor(night);
  for (const [cx, cz, r] of map.islands) {
    add(new THREE.CylinderGeometry(r, r - 4, 5, 48), mats.rock, cx, -2.8, cz);
    add(new THREE.CylinderGeometry(r, r, 0.4, 48), mats.sand, cx, -0.3, cz);
    add(
      new THREE.CylinderGeometry(r - 0.5, r - 0.5, 0.15, 48),
      mats.grass,
      cx,
      -0.02,
      cz,
    );
    for (let i = 0; i < 12; i++) {
      const a = i * 2.399,
        radius = r - 4,
        x = cx + Math.cos(a) * radius,
        z = cz + Math.sin(a) * radius;
      add(new THREE.CylinderGeometry(0.12, 0.22, 2.8, 5), mats.wood, x, 1.4, z);
      add(new THREE.ConeGeometry(1.5, 3.6, 6), mats.grass, x, 3.8, z);
    }
  }
  if (night === 2) {
    add(new THREE.BoxGeometry(18, 0.22, 4), mats.wood, 35, -0.12, 0);
    for (let x = 26; x <= 44; x += 1)
      add(new THREE.BoxGeometry(0.12, 0.08, 4), mats.sand, x, 0.04, 0);
  }
  if (night === 3) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.lineTo(-12, 0);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 3,
      bevelEnabled: false,
      curveSegments: 32,
    });
    geometry.rotateX(Math.PI / 2);
    add(geometry, mats.grass, 0, 3, 0);
    add(new THREE.CylinderGeometry(8, 8, 6, 48), mats.grass, 0, 3, 0);
    add(new THREE.CylinderGeometry(2, 2, 8, 12), mats.wood, 0, 10, 0);
    add(new THREE.ConeGeometry(3, 1.5, 12), mats.gold, 0, 14.5, 0);
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180,
        u = [Math.cos(a), Math.sin(a)],
        v = [-Math.sin(a) * 1.5, Math.cos(a) * 1.5];
      const points = [];
      for (const [r, y, side] of [
        [30, 0, -1],
        [30, 0, 1],
        [24, 3, 1],
        [24, 3, -1],
      ])
        points.push(r * u[0] + side * v[0], y + 0.02, r * u[1] + side * v[1]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      geo.setIndex([0, 2, 1, 0, 3, 2]);
      geo.computeVertexNormals();
      add(geo, mats.sand, 0, 0, 0);
    }
  }
  for (const pad of map.pads) {
    add(
      new THREE.CylinderGeometry(1, 1, 0.2, 16),
      mats.gold,
      pad.pos[0],
      pad.pos[1] + 0.08,
      pad.pos[2],
    );
    const ring = add(
      new THREE.TorusGeometry(0.75, 0.06, 6, 24),
      mats.glow,
      pad.pos[0],
      pad.pos[1] + 0.22,
      pad.pos[2],
    );
    ring.rotation.x = Math.PI / 2;
  }
  const sea = add(new THREE.PlaneGeometry(700, 700), mats.sea, 0, -8, 0);
  sea.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 20; i++) {
    const a = i * 2.399,
      r = 48 + (i % 7) * 5;
    const cloud = add(
      new THREE.IcosahedronGeometry(3 + (i % 4), 0),
      mats.cloud,
      Math.cos(a) * r,
      -5 - (i % 3),
      Math.sin(a) * r,
    );
    cloud.scale.set(2, 0.6, 1);
  }
}
