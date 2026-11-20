import { mkdir, copyFile, cp } from "node:fs/promises";
await mkdir("dist/vendor", { recursive: true });
for (const file of ["index.html", "style.css"])
  await copyFile(file, `dist/${file}`);
await cp("src", "dist/src", { recursive: true });
for (const file of ["three.module.js", "three.core.js"])
  await copyFile(`node_modules/three/build/${file}`, `dist/vendor/${file}`);
console.log("Built static game in dist/");
