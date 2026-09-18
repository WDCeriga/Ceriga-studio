import fs from 'node:fs';

const fits = ['boxy', 'cropped', 'baggy', 'regular', 'slim'];
const requiredNames = [
  'Body',
  'Kangaroo pocket',
  'Left sleeve',
  'Right sleeve',
  'Left cuff',
  'Right cuff',
  'Hood',
  'Rib hem',
];

for (const fit of fits) {
  const mockupPath =
    fit === 'boxy'
      ? 'src/assets/studio-hoodie/mockup.json'
      : `src/assets/studio-hoodie/fits/${fit}/mockup.json`;
  const mockup = JSON.parse(fs.readFileSync(mockupPath, 'utf8'));
  const names = mockup.parts.map((part) => part.name);
  const missing = requiredNames.filter((name) => !names.includes(name));
  const malformed = mockup.parts.filter(
    (part) =>
      !part.svg.includes('fill-rule="evenodd"') ||
      !part.svg.includes('fill="#000000"') ||
      !part.svg.includes('fill="#141414"') ||
      (part.svg.match(/<g transform=/g) ?? []).length !== 2,
  );
  const area = Object.fromEntries(mockup.parts.map((part) => [part.name, part.area]));
  const cuffRatio = area['Left cuff'] / area['Right cuff'];

  if (mockup.partCount !== 8 || mockup.parts.length !== 8 || missing.length) {
    throw new Error(`${fit}: incomplete pack (${missing.join(', ')})`);
  }
  if (mockup.process?.exclusiveFillPartition !== true) {
    throw new Error(`${fit}: fill masks are not marked as an exclusive partition`);
  }
  if (malformed.length) {
    throw new Error(`${fit}: malformed SVG layers in ${malformed.map((part) => part.name).join(', ')}`);
  }
  if (cuffRatio < 0.75 || cuffRatio > 1.33) {
    throw new Error(`${fit}: asymmetric cuff ratio ${cuffRatio.toFixed(2)}`);
  }

  console.log(`${fit}: 8 parts, editable SVG layers, cuff ratio ${cuffRatio.toFixed(2)}`);
}
