import fs from 'node:fs';
import path from 'node:path';

const FIT = (process.argv[2] || 'boxy').toLowerCase();
const ROOT = 'src/assets/hoodie-test';
const mockupPath =
  FIT === 'boxy'
    ? 'src/assets/studio-hoodie/mockup.json'
    : `src/assets/studio-hoodie/fits/${FIT}/mockup.json`;
const suffix = FIT === 'boxy' ? '' : ` (${FIT})`;
const mockup = JSON.parse(fs.readFileSync(mockupPath, 'utf8'));

fs.mkdirSync(ROOT, { recursive: true });
for (const part of mockup.parts) {
  const dir = path.join(ROOT, part.name);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${part.name}${suffix}.svg`;
  fs.writeFileSync(path.join(dir, fileName), part.svg);
  console.log(FIT, fileName, (part.svg.length / 1024).toFixed(1) + 'KB');
}

if (FIT === 'boxy') {
  for (const leftover of ['Construction', 'Left hood', 'Right hood']) {
    const dir = path.join(ROOT, leftover);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}
