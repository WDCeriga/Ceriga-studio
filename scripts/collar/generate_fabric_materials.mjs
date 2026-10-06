import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Original construction studies, not scanned textiles. Visual approval is deliberately separate.
// Coordinates and seeded yarn variation are periodic, including across the outer tile boundary.
const VERSION = 1, SIZE = 512, SAMPLES = 2, TAU = Math.PI * 2;
const root = new URL('../../src/assets/fabrics/', import.meta.url);
const fract = x => x - Math.floor(x);
const wrap = x => fract(x + .5) - .5;
const smooth = x => x * x * (3 - 2 * x);
const mix = (a, b, t) => a + (b - a) * t;
const hash = (x, y, seed) => {
  let h = Math.imul(x + seed * 71, 374761393) ^ Math.imul(y + seed * 19, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
function yarnNoise(u, v, nx, ny, seed) {
  const x = fract(u) * nx, y = fract(v) * ny, ix = Math.floor(x), iy = Math.floor(y);
  const value = (dx, dy) => hash((ix + dx) % nx, (iy + dy) % ny, seed) * 2 - 1;
  return mix(mix(value(0, 0), value(1, 0), smooth(fract(x))), mix(value(0, 1), value(1, 1), smooth(fract(x))), smooth(fract(y)));
}
const ridge = (distance, width) => Math.exp(-distance * distance / (2 * width * width));
function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
function knit(u, v, wales, courses, seed) {
  const x = wrap(u * wales + .035 * Math.sin(TAU * v * 5));
  const y = wrap(v * courses + .04 * Math.sin(TAU * u * 3));
  let distance = 1;
  for (const dy of [-1, 0, 1]) {
    distance = Math.min(distance, segmentDistance(x, y + dy, -.29, -.5, 0, .32), segmentDistance(x, y + dy, 0, .32, .29, -.5));
  }
  const yarn = ridge(distance, .071);
  return yarn * (.92 + .08 * yarnNoise(u, v, wales, courses, seed)) - .15 * ridge(x, .075);
}
function purl(u, v, wales, courses) {
  const x = wrap(u * wales), y = wrap(v * courses);
  return ridge(wrap(y - .15 * Math.cos(TAU * x)), .10) * (.8 + .2 * Math.cos(TAU * x));
}
function fuzz(u, v, seed, directional = false) {
  // Short-scale filament variation, without low-frequency cloud octaves.
  let result = 0;
  for (let i = 0; i < 6; i++) {
    const nx = 83 + i * 17, ny = directional ? 7 + i * 3 : 59 + i * 13;
    result += Math.sin(TAU * (nx * u + ny * v) + seed + i) / 6;
  }
  return .55 * result + .45 * yarnNoise(u, v, 160, directional ? 56 : 144, seed);
}
function loops(u, v, seed, wales, courses, tall) {
  const x = wrap(u * wales + .12 * Math.sin(TAU * v * courses));
  const y = wrap(v * courses + .05 * Math.sin(TAU * u * 3));
  const ellipse = Math.sqrt((x / .31) ** 2 + (y / tall) ** 2);
  const loop = ridge(ellipse - 1, .19);
  return .85 * loop + .13 * yarnNoise(u, v, wales * 3, courses * 3, seed) + .06 * fuzz(u, v, seed);
}
function rib(u, v, seed, paired) {
  const columns = paired ? 48 : 40, courses = paired ? 34 : 38;
  const column = Math.floor(fract(u) * columns), group = paired ? 4 : 2;
  const front = column % group < (paired ? 2 : 1);
  // Grouped front/back stitch topology distinguishes 2x2; it is not a resized 1x1 image.
  const relief = paired ? Math.tanh(2.4 * Math.sin(TAU * u * (columns / group))) : Math.cos(TAU * u * (columns / group));
  return .55 * relief + (front ? .34 * knit(u, v, columns, courses, seed) : .17 * purl(u, v, columns, courses)) + .045 * fuzz(u, v, seed);
}
function waffle(u, v, seed) {
  const x = wrap(u * 18 + .018 * Math.sin(TAU * v * 6));
  const y = wrap(v * 18 + .018 * Math.sin(TAU * u * 6));
  // Rounded recessed cell, with broad knitted walls rather than a drawn grid line.
  const cavity = Math.exp(-((x / .32) ** 6 + (y / .32) ** 6));
  return -.72 * cavity + .13 * knit(u, v, 72, 72, seed) + .05 * fuzz(u, v, seed);
}
function pique(u, v, seed) {
  const x = u * 32, y = v * 32;
  const tuck = .28 * Math.cos(TAU * x) * Math.cos(TAU * y) + .14 * Math.cos(TAU * (x + y));
  return tuck + .32 * knit(u, v, 64, 64, seed) + .04 * fuzz(u, v, seed);
}
function mesh(u, v, seed) {
  const row = Math.floor(fract(v) * 32);
  const x = wrap(u * 32 + (row % 2) * .5), y = wrap(v * 32);
  const opening = Math.exp(-((x / .16) ** 2 + (y / .27) ** 2) * 2);
  const rim = ridge(Math.sqrt((x / .23) ** 2 + (y / .36) ** 2) - 1, .20);
  return -.48 * opening + .13 * rim + .07 * knit(u, v, 64, 64, seed);
}
function twill(u, v, seed) {
  const count = 60, x = fract(u) * count, y = fract(v) * count;
  const warpOver = ((Math.floor(x) - Math.floor(y) + count) % 3) < 2;
  const warp = ridge(wrap(x), .24), weft = ridge(wrap(y), .22);
  return (warpOver ? .6 * warp + .12 * weft : .6 * weft + .12 * warp) + .15 * Math.cos(TAU * (x - y) / 3) + .04 * fuzz(u, v, seed);
}
function taslan(u, v, seed) {
  const disturbed = u * 112 + .16 * Math.sin(TAU * v * 13) + .07 * Math.sin(TAU * (u * 7 + v * 19));
  const filament = Math.cos(TAU * disturbed);
  const microCrinkle = Math.sin(TAU * (u * 17 + v * 23) + .5 * Math.sin(TAU * v * 5));
  return .15 * filament + .10 * microCrinkle + .22 * yarnNoise(u, v, 128, 88, seed) + .09 * fuzz(u, v, seed, true);
}
const recipes = [
  { id: 'single-jersey', seed: 101, repeat: 660, recipe: 'Fine single-bed V-loop wales; smooth matte face with minimal yarn relief.', field: (u,v,s) => knit(u,v,32,40,s) + .05*fuzz(u,v,s) },
  { id: 'interlock-jersey', seed: 211, repeat: 720, recipe: 'Compact double-knit face: offset intermeshing loop beds, subdued valleys and denser gauge than single jersey.', field: (u,v,s) => .64*knit(u,v,40,48,s) + .36*knit(u+.5/40,v+.5/48,40,48,s+1) + .035*fuzz(u,v,s) },
  { id: 'french-terry', seed: 307, repeat: 540, recipe: 'Smooth sweatshirt face wales; separate short, irregular sinker-loop reverse. Loops are never applied to the outside.', field: (u,v,s) => .85*knit(u,v,32,36,s)+.10*fuzz(u,v,s), reverse: (u,v,s) => loops(u,v,s,24,28,.34), reverseDescription: 'Short terry sinker-loop reverse; dedicated to French terry.' },
  { id: 'loopback-jersey', seed: 409, repeat: 495, recipe: 'Fine stable knit face with separate elongated laid-in loop reverse; no loop pattern on the face.', field: (u,v,s) => .72*knit(u,v,36,44,s)+.18*knit(u+.4/36,v,36,44,s+1)+.045*fuzz(u,v,s), reverse: (u,v,s) => loops(u,v,s,28,20,.44), reverseDescription: 'Elongated laid-in loopback reverse, not a terry face substitute.' },
  { id: 'heavyweight-fleece', seed: 503, repeat: 350, recipe: 'Dense sweatshirt knit face with short soft fibres; separate compact lofted fleece reverse. Weight is specification metadata, not inferred from a photograph.', field: (u,v,s) => .50*knit(u,v,32,36,s)+.40*fuzz(u,v,s), reverse: (u,v,s) => .74*fuzz(u,v,s)+.13*knit(u,v,28,30,s)+.12*yarnNoise(u,v,96,96,s), reverseDescription: 'Dense short-fibre loft on fleece reverse, independently authored.' },
  { id: 'brushed-fleece', seed: 601, repeat: 380, recipe: 'Soft smooth face with attenuated knit channels and fine aligned brushed filaments; independent directional brushed reverse.', field: (u,v,s) => .24*knit(u,v,36,40,s)+.62*fuzz(u,v,s,true), reverse: (u,v,s) => .84*fuzz(u,v,s,true)+.10*yarnNoise(u,v,144,48,s), reverseDescription: 'Longer directional brushed nap, distinct from dense heavyweight fleece.' },
  { id: 'rib-1x1', seed: 701, repeat: 360, recipe: 'Alternating single front-knit and back-purl columns with narrow vertical channels.', field: (u,v,s) => rib(u,v,s,false) },
  { id: 'rib-2x2', seed: 809, repeat: 400, recipe: 'Two front-knit columns followed by two recessed purl columns; paired stitch topology and wider rib channels.', field: (u,v,s) => rib(u,v,s,true) },
  { id: 'waffle', seed: 907, repeat: 320, recipe: 'Rounded recessed square knit cells with soft walls and fine yarn structure, not a graphic grid.', field: waffle },
  { id: 'pique', seed: 1009, repeat: 645, recipe: 'Fine offset tuck-knit relief over a compact loop ground; restrained polo-scale cellular structure.', field: pique },
  { id: 'mesh', seed: 1103, repeat: 645, recipe: 'Tiny staggered elongated performance-knit openings, soft yarn rims; tonal relief only, no transparent garment cutouts.', field: mesh },
  { id: 'nylon-taslan', seed: 1201, repeat: 390, recipe: 'Air-textured irregular filament grain with short-scale directional micro-crinkle. No checkerboard, generic crosshatch or borrowed woven scan.', field: taslan },
  { id: 'cotton-twill', seed: 1301, repeat: 430, recipe: 'Fine 2-over-1 interlacing warp/weft floats with diagonal progression and subdued yarn relief; no denim scan reuse.', field: twill },
];

const crcTable = Array.from({length:256}, (_, n) => { for(let i=0;i<8;i++) n = n&1 ? 0xedb88320^(n>>>1) : n>>>1; return n>>>0; });
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) crc = crcTable[(crc^byte)&255] ^ (crc>>>8);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length,payload,checksum]);
}
function png(rgba) {
  const header = Buffer.alloc(13); header.writeUInt32BE(SIZE,0); header.writeUInt32BE(SIZE,4); header[8]=8; header[9]=6;
  const rows = Buffer.alloc(SIZE*(SIZE*4+1));
  for(let y=0;y<SIZE;y++) rgba.copy(rows,y*(SIZE*4+1)+1,y*SIZE*4,(y+1)*SIZE*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function maps(field, seed) {
  const values = new Float64Array(SIZE*SIZE);
  let sum=0, squares=0;
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) {
    let value=0;
    for(let sy=0;sy<SAMPLES;sy++) for(let sx=0;sx<SAMPLES;sx++) value+=field((x+(sx+.5)/SAMPLES)/SIZE,(y+(sy+.5)/SAMPLES)/SIZE,seed);
    value/=SAMPLES*SAMPLES; values[y*SIZE+x]=value; sum+=value; squares+=value*value;
  }
  const mean=sum/values.length, deviation=Math.sqrt(squares/values.length-mean*mean);
  if(!Number.isFinite(deviation)||deviation<.01) throw new Error('Empty/nonfinite procedural material');
  const original=Buffer.alloc(SIZE*SIZE*4), normalized=Buffer.alloc(SIZE*SIZE*4);
  for(let i=0;i<values.length;i++) {
    const z=(values[i]-mean)/deviation, grey=Math.round(Math.max(0,Math.min(255,128+z*24)));
    original[i*4]=original[i*4+1]=original[i*4+2]=grey; original[i*4+3]=255;
    normalized[i*4]=normalized[i*4+1]=normalized[i*4+2]=z<0?0:255;
    normalized[i*4+3]=Math.round(Math.min(72,Math.abs(z)*21));
  }
  // Periodicity is tested on the underlying construction rather than requiring identical adjacent pixels.
  let periodicError=0;
  for(let i=0;i<101;i++) {
    const t=(i+.37)/101;
    periodicError=Math.max(periodicError,Math.abs(field(0,t,seed)-field(1,t,seed)),Math.abs(field(t,0,seed)-field(t,1,seed)));
  }
  if(periodicError>1e-8) throw new Error(`Nonperiodic procedural field: ${periodicError}`);
  return {original:png(original),normalized:png(normalized),deviation,periodicError};
}
const sha = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse((await readFile(new URL('sources.json',root),'utf8')).replace(/^\uFEFF/,''));
const checksums = JSON.parse((await readFile(new URL('checksums.json',root),'utf8')).replace(/^\uFEFF/,''));
await mkdir(new URL('procedural/',root),{recursive:true});
for(const recipe of recipes) {
  const record=manifest.presets.find(item=>item.fabricPresetId===recipe.id);
  if(!record) throw new Error(`Unknown preset ${recipe.id}`);
  // A higher-priority source added later is never overwritten by the procedural generator.
  if(record.source && record.sourceType && record.sourceType!=='procedural') continue;
  const map=maps(recipe.field,recipe.seed), originalFile=`procedural/${recipe.id}-source.png`, normalizedFile=`procedural/${recipe.id}.png`;
  await writeFile(new URL(originalFile,root),map.original); await writeFile(new URL(normalizedFile,root),map.normalized);
  const generator='scripts/collar/generate_fabric_materials.mjs';
  Object.assign(record,{
    sourceType:'procedural',sourceStatus:'review-required',status:'review-required',
    reason:'No usable exact scan or supplied owned swatch established in the recorded research. Dedicated authored construction study provided for visual review; not a photograph.',
    procedural:{generator,version:VERSION,recipe:recipe.recipe,seed:recipe.seed,recommendedTextureScale:recipe.repeat},
    source:{assetId:`ceriga-${recipe.id}-v${VERSION}`,provider:'Ceriga authored',page:`${generator}#${recipe.id}`,evidenceUrl:`${generator}#${recipe.id}`,constructionEvidence:recipe.recipe,license:'LicenseRef-Ceriga-Authored',licenseUrl:generator,licensePage:generator,download:'generated locally',originalFilename:`${recipe.id}-source.png`,originalFile,normalizedFile,sourceSha256:sha(map.original),normalizedSha256:sha(map.normalized)},
  });
  const checksum={fabricPresetId:recipe.id,sourceSha256:record.source.sourceSha256,outputSha256:record.source.normalizedSha256};
  if(recipe.reverse) {
    const reverse=maps(recipe.reverse,recipe.seed+17), reverseFile=`procedural/${recipe.id}-reverse.png`;
    await writeFile(new URL(reverseFile,root),reverse.normalized);
    record.reverse={normalizedFile:reverseFile,normalizedSha256:sha(reverse.normalized),description:recipe.reverseDescription};
    Object.assign(checksum,{reverseFile,reverseSha256:record.reverse.normalizedSha256});
  }
  const index=checksums.findIndex(item=>item.fabricPresetId===recipe.id);
  if(index<0) checksums.push(checksum); else checksums[index]=checksum;
  console.log(`${recipe.id}: source + neutral map${recipe.reverse?' + reverse':''}; periodic boundary error ${map.periodicError.toExponential(2)}; suggested repeat ${recipe.repeat}`);
}
for(const record of manifest.presets) if(record.source?.license==='CC0-1.0') Object.assign(record,{sourceType:'scan-cc0',sourceStatus:record.status});
manifest.schemaVersion=3;
manifest.policy='Priority: exact real CC0 scan; supplied/Ceriga-owned swatch with redistribution rights; exact commercial CC-BY with stored attribution; deliberately authored construction-specific procedural material. No unrelated scan substitutes or shared construction maps. Procedural sources remain review-required until visual approval.';
manifest.processing='Scans: luminance high-pass neutral-alpha normalization removes source dye/lighting. Procedural: original deterministic 512px 2x supersampled periodic construction-height fields; mean-centered relief, standard deviation normalization, neutral black/white alpha capped at 72/255. All material maps require per-construction scale/opacity. No source dye is rendered. Smooth face and loop/brushed reverse are separate.';
manifest.attributionPolicy='CC-BY sources must store creator, assetName, sourceUrl, license and attribution text in source.attribution. No CC-BY assets are currently bundled. Ceriga-authored output is not labelled CC0 or photographic; external source rights are not claimed.';
checksums.sort((a,b)=>manifest.presets.findIndex(p=>p.fabricPresetId===a.fabricPresetId)-manifest.presets.findIndex(p=>p.fabricPresetId===b.fabricPresetId));
await writeFile(new URL('sources.json',root),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('checksums.json',root),JSON.stringify(checksums,null,2)+'\n');
console.log(`Generated hybrid library in ${fileURLToPath(root)}`);
