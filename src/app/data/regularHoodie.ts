import { fabricRings } from './regularConstruction';
import { shoulderSeamCurves } from './shoulderConstruction';
import { flattenConstructionSeam } from './constructionStitchRows';
import svgpath from 'svgpath';
import { flattenPathContours } from '../features/panelling/panellingGeometry';
import { stablePolygonDifference } from '../lib/stablePolygonUnion';
import { adjustableHemHardware, continuousHoodieFinish, hoodieBodyTerminal, hoodieFinishIsRib, hoodieFinishStitchMarkup, rawEdgeTreatment, hoodieTerminalFinish, hoodieTerminalFootprint, resolveHoodieFinish } from './hoodieFinishes';
import type { HemSettings, TshirtHemStyles } from './tshirtHemStyles';
import type { NeckFinish } from './tshirtNeckFinish';
import { tshirtNeckMaster } from './tshirtNeckPack';
import { neckRibbing } from './tshirtNecklineQuality';
import { hoodieNeckline, hoodieNeckCurve, hoodiePositionOption, hoodieProfileOption, hoodieTypeOption, HOODLESS_NECK_OFFSET, HOODLESS_NECK_Y } from './hoodieNecklines';
import type { GarmentAssetSelection, ResolvedGarmentLayer } from './garmentSvgCatalog';
import pocket from '../../assets/studio-hoodie/regular/pocket.svg?raw';


export const REGULAR_HOODIE_PRESET = 'studio-hoodie:regular-pullover';

const svg = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-no-fabric-edge-seal="true">${content}</svg>`;
// Use the same centreline and width for every editable panel and its outline.
const boxyWidth = 0.89;
const narrowBoxy = (source: string) => source.replace(/<(path|rect)\b(?: transform="([^"]*)")?/g,
  (_, tag, transform) => `<${tag} transform="translate(${1024 * (1 - boxyWidth)} 0) scale(${boxyWidth} 1)${transform ? ` ${transform}` : ''}"`);

const panel = (d: string) => svg(`<path fill="#000000" d="${d}"/>`);
function hemRibLines(d: string) {
  const rings = flattenPathContours(d, 2);
  const points = rings.flat();
  if (!points.length) return '';
  const left = Math.min(...points.map(point => point.x));
  const right = Math.max(...points.map(point => point.x));
  const lines: string[] = [];
  for (let x = left + 3; x < right; x += 5) {
    const hits: number[] = [];
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if ((a.x > x) !== (b.x > x)) hits.push(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      if (hits[i + 1] - hits[i] > 2) lines.push(`M${x} ${hits[i] + 1}V${hits[i + 1] - 1}`);
    }
  }
  return lines.join(' ');
}
const seam = (d: string, width = 4.4) =>
  svg(`<path fill="none" stroke="#202020" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>`);

const stitchPath = (path: string, width = 4) =>
  `<path d="${path}" fill="none" stroke="#ffffff" stroke-width="${width}" stroke-dasharray="9 7" stroke-linecap="round"/>`;
const stitchSvg = (path: string) => svg(stitchPath(path));

const mirror = (path: string) => path.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${2048 - Number(x)} ${y}`);

// Left-sleeve paths drafted on the Regular flat. The cap and underarm joins
// are supplied by the chosen shoulder, while each profile owns its two edges.
const sleeveProfiles = {
  straight: {
    outer: 'C 430 923 382 1030 354 1150 C 298 1390 280 1657 263 1864',
    opening: 'Q 373 1848 482 1886',
    wrist: [263, 482, 1886],
  },
  tapered: {
    outer: 'C 429 912 386 1027 359 1148 C 309 1372 299 1644 298 1872',
    opening: 'Q 380 1875 462 1869',
    wrist: [298, 462, 1869],
  },
  'extended-long': {
    outer: 'C 429 921 389 1024 366 1145 C 318 1389 283 1680 270 1900',
    opening: 'Q 365 1898 461 1900',
    wrist: [270, 461, 1900],
  },
  'extended-short': {
    outer: 'C 429 985 280 1235 236 1380',
    opening: 'L 587 1492',
    wrist: [236, 587, 1492],
  },
  flared: {
    outer: 'C 430 910 404 1065 378 1192 C 341 1373 262 1625 184 1840',
    opening: 'Q 330 1891 524 1872',
    wrist: [184, 524, 1872],
  },
} as const;
export const HOODIE_SLEEVES = [
  ['full', 'Balloon'], ['straight', 'Straight'], ['tapered', 'Tapered'],
  ['flared', 'Flared'],
  ['extended-short', 'Extended short sleeve'],
  ['sleeveless', 'Sleeveless'],
] as const;

const hoodAnchor = (x: number, y: number, scale: number) => `${1024 + (x - 1024) * scale} ${650 + (y - 650) * scale}`;

const hoodieFitBlocks = {
  slim: {
    measurements: [54, 70, 48, 64, 45, 23, 9],
    cap: ['508 799', '490 842', '479 867'], shoulder: ['614 690', '550 711', '518 776'],
    underarm: '578 1014', setIn: ['549 844', '574 939'],
    side: 'C 589 1235 609 1545 623 1705', hemTurn: ['629 1744', '653 1758'],
    hemInset: 664, hemCurve: 0, hemDepth: 88,
    sleeve: { shift: 29, shortShift: 35, length: 0, upperEase: -.14, forearmEase: -.14, wristEase: -.14, cuffDepth: 76.54,
      balloonOuter: 'C 374 1079 280 1495 258 1660 C 246 1760 256 1868 301 1872', balloonWrist: [301, 453, 377] },
    hoodScale: .78,
  },
  regular: {
    measurements: [56, 69, 50, 62, 48, 25, 10],
    cap: ['470 827', '448 874', '434 905'], shoulder: ['600 703', '516 735', '476 806'],
    underarm: '557 1024', setIn: ['514 873', '554 948'],
    side: 'C 565 1234 557 1560 597 1708', hemTurn: ['609 1745', '626 1758'],
    hemInset: 642, hemCurve: 0, hemDepth: 98,
    sleeve: { shift: 0, shortShift: 0, length: 0, upperEase: .08, forearmEase: .06, wristEase: .04, cuffDepth: 94,
      balloonOuter: 'C 359 1110 172 1444 171 1625 C 171 1761 210 1854 263 1872', balloonWrist: [263, 427, 342] },
    hoodScale: .86,
  },
  boxy: {
    measurements: [58, 65, 53, 61, 53, 27, 11],
    cap: ['439 847', '416 897', '401 931'], shoulder: ['584 712', '487 750', '450 825'],
    underarm: '539 1052', setIn: ['484 892', '537 975'],
    side: 'C 541 1260 540 1550 554 1662', hemTurn: ['561 1695', '582 1700'],
    hemInset: 596, hemCurve: 6, hemDepth: 82,
    sleeve: { shift: -20, shortShift: -25, length: 0, upperEase: .17, forearmEase: .15, wristEase: .11, cuffDepth: 98,
      balloonOuter: 'C 323 1130 157 1450 151 1634 C 151 1768 199 1847 246 1872', balloonWrist: [246, 420, 332] },
    hoodScale: .91,
  },
  oversized: {
    measurements: [62, 69, 55, 61, 56, 30, 11.5],
    cap: ['404 894', '382 945', '365 980'], shoulder: ['569 726', '451 791', '417 867'],
    underarm: '503 1132', setIn: ['456 940', '504 1039'],
    side: 'C 502 1320 501 1570 539 1717', hemTurn: ['550 1756', '574 1768'],
    hemInset: 592, hemCurve: -6, hemDepth: 89,
    sleeve: { shift: -43, shortShift: -62, length: 24, upperEase: .24, forearmEase: .21, wristEase: .15, cuffDepth: 100,
      balloonOuter: 'C 280 1135 134 1450 132 1640 C 132 1770 179 1857 226 1872', balloonWrist: [226, 412, 319] },
    hoodScale: .94,
  },
} as const;

export function hoodieFitBlock(fit?: string) {
  return hoodieFitBlocks[fit as keyof typeof hoodieFitBlocks] ?? hoodieFitBlocks.boxy;
}
function hoodieCut(construction: string | undefined, crewneck: boolean, sleeveShape: string | undefined, hem: string | undefined, cuffFinish: string | undefined, lowHood: boolean, fit: string | undefined, neckDepth: number, pointedNeck: boolean, hoodScale: number, torsoCrop: number, tracedNeck?: FittedTshirtNeck, cuffSettings?: HemSettings, bodySettings?: HemSettings) {
  const sleeveless = sleeveShape === 'sleeveless';
  if (sleeveless) construction = 'drop-shoulder';
  const saddle = construction === 'saddle';
  const neckToSleeve = saddle || construction === 'raglan';
  const dropped = construction === 'drop-shoulder';
  const block = hoodieFitBlock(fit);
  const sleeve = block.sleeve;
  const turned = hem === 'turned';
  const turnedCuff = cuffFinish ? cuffFinish === 'normal' : turned;
  const rawCuff = cuffFinish === 'none';
  const positionSleeve = (path: string) => sleeve.length
    ? path.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${x} ${Number(y) + sleeve.length}`)
    : path;
  const flared = sleeveShape === 'flared';
  const profile = sleeveProfiles[sleeveShape as keyof typeof sleeveProfiles];
  const shaped = Boolean(profile);
  const extendedSleeve = sleeveShape === 'extended-long';
  const extendedShort = sleeveShape === 'extended-short';
  const followsTorso = sleeveShape === 'straight' || sleeveShape === 'tapered' || extendedSleeve || flared;
  const fitOffset = extendedShort ? sleeve.shortShift : sleeve.shift;
  const widthAnchor = profile ? profile.wrist[1] : 0;
  const profileX = (x: number, y: number) => {
    const upper = Math.max(0, Math.min(1, (1510 - y) / 390));
    const wrist = Math.max(0, Math.min(1, (y - 1510) / 350));
    const ease = sleeve.forearmEase + upper * (sleeve.upperEase - sleeve.forearmEase)
      + wrist * (sleeve.wristEase - sleeve.forearmEase);
    return widthAnchor + (x - widthAnchor) * (1 + ease) + fitOffset;
  };
  const scaleProfile = (path: string) => path.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${profileX(Number(x), Number(y))} ${y}`);
  const placeProfile = (path: string) => positionSleeve(scaleProfile(path));
  const sideTop = block.underarm;
  const [underarmX, underarmY] = sideTop.split(' ').map(Number);
  const [hemTurn, hemStart] = block.hemTurn;
  const [hemX, hemY] = hemStart.split(' ').map(Number);
  const sideValues = block.side.slice(2).split(' ');
  const [sideFirst, sideSecond, sideEnd] = [0, 2, 4].map(i => sideValues.slice(i, i + 2).join(' '));
  const side = `${block.side} Q ${hemTurn} ${hemStart}`;
  const reverseSide = `Q ${hemTurn} ${sideEnd} C ${sideSecond} ${sideFirst} ${sideTop}`;
  const sleeveSide = `C ${sideSecond} ${sideFirst} ${sideTop}`;
  const [sideEndX, sideEndY] = sideEnd.split(' ').map(Number);
  const hemBottom = hemY + (turned ? 38 : block.hemDepth);
  const shortenBy = (hemBottom - 650) * Math.max(0, Math.min(30, torsoCrop)) / 100;
  const cropBody = (path: string) => !shortenBy ? path : path.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) =>
    `${x} ${Number(y) - shortenBy * Math.max(0, Math.min(1, (Number(y) - underarmY) / (hemY - underarmY)))}`);
  const mixPoint = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  // Register both ends of the short cuff to the torso's actual side curve.
  const shortSleeveJoin = (y: number) => {
    const [a, b, c, d] = [sideTop, sideFirst, sideSecond, sideEnd]
      .map(point => cropBody(point).split(' ').map(Number));
    const split = (t: number) => {
      const ab = mixPoint(a, b, t);
      const bc = mixPoint(b, c, t);
      const cd = mixPoint(c, d, t);
      const abc = mixPoint(ab, bc, t);
      return { ab, abc, point: mixPoint(abc, mixPoint(bc, cd, t), t) };
    };
    let low = 0;
    let high = 1;
    for (let i = 0; i < 28; i++) {
      const mid = (low + high) / 2;
      if (split(mid).point[1] < y) low = mid;
      else high = mid;
    }
    return split(y >= d[1] ? 1 : (low + high) / 2);
  };
  const [balloonLeft, balloonRight, balloonMid] = sleeve.balloonWrist;
  const cuffStartBaseY = extendedShort ? 1380 : extendedSleeve ? 1900 : flared ? 1840 : sleeveShape === 'straight' ? 1864 : 1872;
  const cuffLeft = profile ? profileX(profile.wrist[0], cuffStartBaseY) : balloonLeft;
  const cuffStartY = cuffStartBaseY;
  const cuffStart = `${cuffLeft} ${cuffStartY}`;
  const cuffEndY = profile?.wrist[2] ?? 1859;
  const shortJoin = extendedShort ? shortSleeveJoin(cuffEndY + sleeve.length) : undefined;
  const cuffRight = shortJoin?.point[0] ?? (profile ? profileX(profile.wrist[1], profile.wrist[2]) : balloonRight);
  const cuffEnd = `${cuffRight} ${cuffEndY}`;
  const sleeveCuffJoin = extendedShort ? `L ${cuffEnd}`
    : profile ? scaleProfile(profile.opening) : `Q ${balloonMid} 1848 ${cuffEnd}`;
  const cuffWidth = cuffRight - cuffLeft;
  const extendedRib = cuffSettings?.construction === 'extended-rib';
  const cuffDepth = extendedRib ? Math.min(178, Math.max(sleeve.cuffDepth + 12, (cuffSettings.depthCm ?? 9) * 17))
    : turnedCuff ? 29 : sleeve.cuffDepth;
  const cuffInset = cuffSettings && !hoodieFinishIsRib(cuffSettings) ? 0 : cuffWidth * (turnedCuff ? .025 : shaped ? .065 : .1);
  const cuffLean = (cuffStartY - cuffEndY) / cuffWidth * cuffDepth;
  const shortCuffDepth = extendedRib ? Math.max(48, (cuffSettings.depthCm ?? 4) * 17) : turnedCuff ? 25 : 45;
  const openingRatio = cuffSettings?.openingCm && hoodieFinishIsRib(cuffSettings)
    ? Math.min(1.3, Math.max(.65, cuffSettings.openingCm / block.measurements[6])) : 1;
  const openingShift = cuffWidth * (1 - openingRatio) / 2;
  const terminalLeft = cuffLeft + cuffInset + cuffLean + openingShift;
  const terminalRight = cuffRight - cuffInset + cuffLean - openingShift;
  const cuffOuter = extendedShort
    ? `L ${shortSleeveJoin(cuffEndY + sleeve.length + shortCuffDepth).point[0] - 1} ${cuffEndY + shortCuffDepth} L ${cuffLeft - shortCuffDepth * .3} ${cuffStartY + shortCuffDepth}`
    : `L ${terminalRight} ${cuffEndY + cuffDepth} L ${terminalLeft} ${cuffStartY + cuffDepth}`;
  const finishDepth = turnedCuff ? 14 : 28;
  // Flared openings retain their full width and use a shallow internal finish.
  const flareFinishStart = `${cuffLeft + finishDepth * .4} ${cuffStartY - finishDepth}`;
  const flareFinishEnd = `${cuffRight} ${cuffEndY - finishDepth}`;
  const flareFinishCurve = `Q ${profileX(330, 1891)} ${1891 - finishDepth} ${flareFinishStart}`;
  const cuff = positionSleeve(flared
    ? `M ${cuffStart} ${sleeveCuffJoin} L ${flareFinishEnd} ${flareFinishCurve} Z`
    : `M ${cuffStart} ${sleeveCuffJoin} ${cuffOuter} Z`);
  const cuffOutline = flared ? '' : positionSleeve(`M ${cuffEnd} ${cuffOuter} L ${cuffStart}`);
  const cuffStitch = positionSleeve(flared
    ? `M ${flareFinishEnd} ${flareFinishCurve}`
    : `M ${cuffStart} ${sleeveCuffJoin}`);
  const sleeveTop = block.cap[neckToSleeve ? 1 : dropped ? 2 : 0];
  const [neckControl, setInControl, relaxedControl] = block.shoulder;
  const sleeveControl = neckToSleeve || dropped ? relaxedControl : setInControl;
  const neckSide = hoodAnchor(728, 650, hoodScale);
  const shoulder = `C ${neckControl} ${sleeveControl} ${sleeveTop}`;
  const reverseShoulder = `C ${sleeveControl} ${neckControl} ${neckSide}`;
  const [capX, capY] = sleeveTop.split(' ').map(Number);
  const [shoulderX, shoulderY] = sleeveControl.split(' ').map(Number);
  const alignSleeveCap = (path: string) => path.replace(/^C [\d.]+ ([\d.]+)/, (_, y) => {
    const run = Math.max(48, Number(y) - capY);
    const slope = (capX - shoulderX) / (capY - shoulderY);
    return `C ${capX + slope * run} ${capY + run}`;
  });
  const balloonInner = `C ${balloonRight + 62} ${cuffEndY + sleeve.length - 15} ${sideEndX - 35} ${sideEndY + 65} ${sideEnd}`;
  const sleeveOuter = alignSleeveCap(profile ? placeProfile(profile.outer) : positionSleeve(sleeve.balloonOuter));
  const sleeveEdge = `${sleeveOuter} ${positionSleeve(sleeveCuffJoin)}${profile ? '' : ' ' + balloonInner}`;
  const hemEdge = block.hemCurve ? `Q 1024 ${hemY + block.hemCurve} ${2048 - hemX} ${hemY}` : `L ${2048 - hemX} ${hemY}`;
  const bodyKind = bodySettings?.construction ?? (turned ? 'single-fold' : 'rib');
  const terminal = bodyKind === 'rib' ? undefined : hoodieBodyTerminal(
    bodyKind, [sideEndX, sideEndY], sideSecond.split(' ').map(Number) as [number, number],
    hemBottom, (bodySettings?.depthCm ?? 2.5) * 17,
  );
  const hemInset = block.hemInset;
  const waistbandOuter = `L ${2048 - hemInset} ${hemBottom} L ${hemInset} ${hemBottom}`;
  const waistband = `M ${hemStart} ${hemEdge} ${waistbandOuter} Z`;
  const waistbandOutline = `M ${mirror(hemStart)} ${waistbandOuter} L ${hemStart}`;
  const neckLeft = tracedNeck?.joinX ?? 877;
  const neckY = tracedNeck?.joinY ?? HOODLESS_NECK_Y;
  const neckRight = 2048 - neckLeft;
  const shoulderControlY = (neckY + 650) / 2;
  const upperShoulder = crewneck
    ? `M ${neckLeft} ${neckY} Q 790 ${shoulderControlY} 728 650 ${shoulder}`
    : `M ${neckSide} ${shoulder}`;
  const seamX = tracedNeck?.seamJoinX ?? neckLeft;
  const seamY = tracedNeck?.seamJoinY ?? neckY;
  const raglanJoin = crewneck ? `${seamX} ${seamY}` : hoodAnchor(790, lowHood ? 654 : 672, hoodScale);
  const [capControl, underarmControl] = block.setIn;
  const [seamStartX, seamStartY] = (neckToSleeve ? raglanJoin : sleeveTop).split(' ').map(Number);
  const seamCurves = neckToSleeve || dropped
    ? shoulderSeamCurves(saddle ? 'saddle' : dropped ? 'drop' : 'raglan',
      [seamStartX, seamStartY], [underarmX, underarmY])
    : undefined;
  const armhole = seamCurves
    ? seamCurves.map(([, b, c, d]) => `C ${b.join(' ')} ${c.join(' ')} ${d.join(' ')}`).join(' ')
    : `C ${capControl} ${underarmControl} ${sideTop}`;
  const reverseArmhole = seamCurves
    ? [...seamCurves].reverse().map(([a, b, c]) => `C ${c.join(' ')} ${b.join(' ')} ${a.join(' ')}`).join(' ')
    : `C ${underarmControl} ${capControl} ${sleeveTop}`;
  const collarShoulder = tracedNeck ? `L ${neckLeft} ${neckY} ` : '';
  const leftBody = neckToSleeve ? `M ${raglanJoin} ${armhole}` : `${upperShoulder} ${armhole}`;
  const rightTop = neckToSleeve ? mirror(reverseArmhole) : mirror(`${reverseArmhole} ${reverseShoulder}`);
  const neckline = neckToSleeve
    ? (crewneck ? tracedNeck?.seamRightToLeft ?? hoodieNeckCurve(neckDepth, pointedNeck, `877 ${HOODLESS_NECK_Y}`) : `Q ${hoodAnchor(1024, lowHood ? 680 : 715, hoodScale)} ${raglanJoin}`)
    : crewneck
      ? `Q 1258 ${shoulderControlY} ${neckRight} ${neckY} ${tracedNeck?.rightToLeft ?? hoodieNeckCurve(neckDepth, pointedNeck, `877 ${HOODLESS_NECK_Y}`)}`
      : `Q ${hoodAnchor(1024, 694, hoodScale)} ${neckSide}`;
  const sideCoordinates = side.split(' ').slice(1, 7).map(Number);
  const sideStart = [underarmX, underarmY];

  // Straight, tapered and flared sleeves follow the body to just above the waistband.
  const joinFraction = extendedSleeve ? .27 : .9;
  const first = mixPoint(sideStart, sideCoordinates.slice(0, 2), joinFraction);
  const second = mixPoint(sideCoordinates.slice(0, 2), sideCoordinates.slice(2, 4), joinFraction);
  const third = mixPoint(sideCoordinates.slice(2, 4), sideCoordinates.slice(4, 6), joinFraction);
  const joinControl = mixPoint(first, second, joinFraction);
  const joinPoint = mixPoint(joinControl, mixPoint(second, third, joinFraction), joinFraction);
  const loweredJoin = cropBody(joinPoint.join(' '));
  const [wristX, wristY] = positionSleeve(cuffEnd).split(' ').map(Number);
  const shortFreeEdge = shortJoin && wristY - shortJoin.point[1] > .01 ? `L ${shortJoin.point.join(' ')}` : '';
  const shortInner = shortJoin
    ? `${shortFreeEdge} C ${shortJoin.abc.join(' ')} ${shortJoin.ab.join(' ')} ${sideTop}`
    : '';
  const [joinX, joinY] = loweredJoin.split(' ').map(Number);
  const straight = sleeveShape === 'straight' || extendedSleeve;
  const exposedInner = flared
    ? `C ${wristX + (joinX - wristX) * .28} ${wristY + (joinY - wristY) * .37} ${joinX - 10} ${joinY + (wristY - joinY) * .3} ${loweredJoin}`
    : followsTorso
      ? `C ${wristX + (joinX - wristX) * (straight ? .43 : .35)} ${wristY + (joinY - wristY) * .35} ${joinX - (straight ? 12 : 24)} ${joinY + (wristY - joinY) * .31} ${loweredJoin}`
      : shortInner;
  const sharedSide = cropBody(`C ${joinControl.join(' ')} ${first.join(' ')} ${sideTop}`);
  const [tangentX, tangentY, exitX, exitY] = sleeveEdge.split(' ').slice(-4).map(Number);
  const sleeveExit = `${exitX} ${exitY}`;
  const croppedExit = cropBody(sleeveExit);
  const rise = exitY - Number(croppedExit.split(' ')[1]);
  // The sleeve and torso share the same seam above the cropped hem. Extend
  // the exposed inner sleeve edge from that seam to its original lower curve.
  const tangentScale = rise / (3 * (tangentY - exitY));
  const sleeveBridge = `C ${exitX + (exitX - tangentX) * tangentScale} ${exitY - rise / 3} ${exitX} ${exitY - rise * .75} ${croppedExit}`;
  const croppedSleeveSide = followsTorso ? `${exposedInner} ${sharedSide}`
    : shaped ? exposedInner : shortenBy ? `${sleeveBridge} ${cropBody(sleeveSide)}` : sleeveSide;
  const leftSleeve = neckToSleeve
    ? `M ${raglanJoin} ${crewneck ? `${collarShoulder}Q 790 ${shoulderControlY}` : 'L'} ${neckSide} ${shoulder} ${sleeveEdge} ${croppedSleeveSide} ${reverseArmhole} Z`
    : `M ${sleeveTop} ${sleeveEdge} ${croppedSleeveSide} ${reverseArmhole} Z`;
  const bodyEdge = terminal
    ? `${block.side} ${terminal.left} ${terminal.edge} ${terminal.right} ${mirror(sleeveSide)}`
    : `${side} ${hemEdge} ${mirror(reverseSide)}`;
  const torso = `${leftBody} ${cropBody(bodyEdge)} ${rightTop} ${neckline} Z`;
  const seamLeft = `${neckToSleeve ? leftBody : `M ${sleeveTop} ${armhole}`} ${cropBody(terminal ? block.side : side)}`;
  const armholeStitch = neckToSleeve ? leftBody : `M ${sleeveTop} ${armhole}`;
  const seamStitch = armholeStitch.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y, offset) =>
    `${Number(x) + 12} ${Number(y) + (crewneck && neckToSleeve && offset === 2 ? 13 : 0)}`);
  const showCuff = !rawCuff && !sleeveless;
  const exterior = sleeveless ? upperShoulder
    : !flared && (cuffSettings || showCuff)
      ? `${upperShoulder} ${sleeveOuter} ${cuffOutline}${shaped ? '' : ` M ${positionSleeve(cuffEnd)} ${balloonInner}${shortenBy ? ' ' + sleeveBridge : ''}`}`
      : `${upperShoulder} ${sleeveEdge}${!shaped && shortenBy ? ' ' + sleeveBridge : ''}`;
  const visibleInner = extendedShort ? shortFreeEdge : exposedInner;
  const innerOutline = shaped && visibleInner ? `M ${positionSleeve(cuffEnd)} ${visibleInner}` : '';
  return {
    torso,
    sleeveTop,
    sideTop,
    cuff: showCuff ? cuff : '',
    waistband: terminal ? '' : cropBody(waistband),
    shortenBy,
    sleeveUnderarmInk: innerOutline ? `${innerOutline} ${mirror(innerOutline)}` : '',
    leftSleeve,
    rightSleeve: mirror(leftSleeve),
    sideLines: `${exterior} ${seamLeft}`,
    waistOutline: terminal
      ? cropBody(`M ${sideEnd} ${terminal.left} ${terminal.edge} ${terminal.right}`)
      : cropBody(waistbandOutline),
    cuffTerminal: flared ? '' : cuff,
    cuffTerminalEdge: (flared ? `${cuffStart} ${cuffEnd}` : cuffOuter.replace(/L /g, '')).split(' ').map(Number),
    cuffEdgeControl: flared ? [profileX(330, 1891), 1891 + sleeve.length] as [number, number] : undefined,
    sleeveLengthOffset: sleeve.length,
    waistEdge: [terminal?.end[0] ?? hemInset, hemBottom - shortenBy, 2048 - (terminal?.end[0] ?? hemInset), hemBottom - shortenBy],
    waistChannel: terminal ? cropBody(terminal.channel) : '',
    waistGathers: terminal ? cropBody(terminal.gathers) : '',
    seamStitches: `${seamStitch} ${mirror(seamStitch)}`,
    waistStitch: terminal ? '' : cropBody(`M ${hemStart} ${hemEdge}`),
    cuffStitch: showCuff ? cuffStitch : '',
  };
}

const hood = {
  front: 'M 728 650 C 710 627 722 594 723 553 C 724 496 708 452 721 386 C 748 257 818 116 926 58 Q 973 31 1024 23 Q 1075 31 1122 58 C 1230 116 1300 257 1327 386 C 1340 452 1324 496 1325 553 C 1326 594 1338 627 1320 650 C 1245 703 1126 731 1024 731 C 922 731 803 703 728 650 Z',
  opening: 'M 774 361 C 807 254 927 173 1024 173 C 1121 173 1241 254 1274 361 C 1264 432 1225 487 1178 536 C 1128 589 1069 636 1024 671 C 979 636 920 589 870 536 C 823 487 784 432 774 361 Z',
  frontSeams: 'M 745 371 C 776 247 902 141 1024 141 C 1146 141 1272 247 1303 371 M 745 371 Q 756 454 870 536 M 1303 371 Q 1292 454 1178 536',
  crossover: 'M 1024 671 Q 998 699 977 729',
  back: 'M 728 650 C 707 614 724 538 720 460 C 712 307 818 74 1024 23 C 1230 74 1336 307 1328 460 C 1324 538 1341 614 1320 650 C 1246 705 1110 757 1024 757 C 938 757 802 705 728 650 Z',
  backSeams: 'M 1024 23 L 1024 757',
};

const relaxedHood = {
  front: 'M 728 650 C 719 618 726 559 746 526 C 768 491 857 486 1024 486 C 1191 486 1280 491 1302 526 C 1322 559 1329 618 1320 650 C 1204 706 1113 757 1024 757 C 935 757 844 706 728 650 Z',
  opening: 'M 760 529 C 802 509 907 505 1024 505 C 1141 505 1246 509 1288 529 C 1245 578 1125 645 1024 719 C 923 645 803 578 760 529 Z',
  frontSeams: 'M 1024 505 L 1024 647',
  crossover: 'M 1024 719 Q 1000 736 981 752',
  back: 'M 728 650 C 718 610 724 554 737 536 Q 756 525 812 541 C 920 574 1128 574 1236 541 Q 1292 525 1311 536 C 1324 554 1330 610 1320 650 C 1284 733 1236 826 1180 889 C 1121 969 927 969 868 889 C 812 826 764 733 728 650 Z',
  backSeams: 'M 1024 566 L 1024 949',
};

const scubaHood = {
  front: 'M 728 650 C 705 608 715 532 710 462 C 696 326 742 177 827 93 C 882 37 947 22 1024 22 C 1101 22 1166 37 1221 93 C 1306 177 1352 326 1338 462 C 1333 532 1343 608 1320 650 C 1251 718 1127 750 1024 750 C 921 750 797 718 728 650 Z',
  opening: 'M 771 344 C 794 242 903 153 1024 153 C 1145 153 1254 242 1277 344 C 1255 436 1151 509 1024 531 C 897 509 793 436 771 344 Z',
  frontSeams: 'M 745 345 C 769 229 887 128 1024 128 C 1161 128 1279 229 1303 345 Q 1275 494 1024 531 Q 773 494 745 345',
  crossover: 'M 1024 531 Q 998 613 995 747',
  back: 'M 728 650 C 704 602 714 518 710 447 C 698 295 752 155 835 76 C 890 31 956 22 1024 22 C 1092 22 1158 31 1213 76 C 1296 155 1350 295 1338 447 C 1334 518 1344 602 1320 650 C 1245 725 1130 780 1024 780 C 918 780 803 725 728 650 Z',
  backSeams: 'M 1024 22 L 1024 780',
};

const relaxedScubaHood = {
  front: 'M 728 650 C 711 626 731 561 742 508 L 765 390 C 772 311 861 267 1024 267 C 1187 267 1276 311 1283 390 L 1306 508 C 1317 561 1337 626 1320 650 C 1240 705 1137 749 1024 749 C 911 749 808 705 728 650 Z',
  opening: 'M 790 382 C 790 322 883 287 1024 287 C 1165 287 1258 322 1258 382 C 1258 449 1165 487 1024 487 C 883 487 790 449 790 382 Z',
  frontSeams: 'M 791 398 C 821 350 915 329 1024 329 C 1133 329 1227 350 1257 398 M 867 468 C 913 537 946 627 951 743 M 1181 468 C 1135 537 1102 627 1097 743',
  crossover: '',
  back: 'M 728 650 C 713 620 736 546 745 494 L 767 382 C 783 309 882 267 1024 267 C 1166 267 1265 309 1281 382 L 1303 494 C 1312 546 1335 620 1320 650 C 1230 736 1127 799 1024 799 C 921 799 818 736 728 650 Z',
  backSeams: 'M 1024 267 L 1024 799',
};

/** Replace the closed face contour with an open facing sewn into the two zip tapes. */
export function joinHoodFaceToZip(raw: string, left: {x:number;y:number}, right: {x:number;y:number}) {
  const upperCount = Number(raw.match(/data-hood-face="(\d+)"/)?.[1]);
  if (!upperCount) return raw;
  return raw.replace(/<path\b([^>]*?)\bd="([^"]+)"([^>]*)\/>/, (_, before: string, path: string, after: string) => {
    const transform = before.match(/transform="([^"]+)"/)?.[1];
    const basis: number[][] = [];
    svgpath('M0 0L1 1').transform(transform ?? '').iterate(segment => { basis.push([Number(segment[1]), Number(segment[2])]); });
    const [[tx, ty], [sx, sy]] = basis;
    const toLocal = ({ x, y }: {x:number;y:number}) => ({ x: (x - tx) / (sx - tx), y: (y - ty) / (sy - ty) });
    const l = toLocal(left), r = toLocal(right);
    const upper: number[][] = [];
    svgpath(path).abs().iterate(segment => { upper.push(segment.slice(1).map(Number)); });
    const [rx, ry] = upper[upperCount].slice(-2);
    const hasLongSide = upper[upperCount + 1][4] > 1100 && upper[upperCount + 2]?.[4] === 1024;
    const segmentIndex = upperCount + (hasLongSide ? 2 : 1);
    const start = upper[segmentIndex - 1].slice(-2);
    const curve = upper[segmentIndex];
    const t = hasLongSide ? .38 : .66;
    const mix = (a: number[], b: number[]) => a.map((value, i) => value + (b[i] - value) * t);
    const a = mix(start, curve.slice(0, 2));
    const b = mix(curve.slice(0, 2), curve.slice(2, 4));
    const c = mix(curve.slice(2, 4), curve.slice(4, 6));
    const ab = mix(a, b), bc = mix(b, c);
    const join = mix(ab, bc);
    const rise = Math.max(1, r.y - join[1]);
    const run = Math.max(0, join[0] - r.x);
    const slope = (join[0] - ab[0]) / Math.max(1, join[1] - ab[1]);
    // Keep more width through the lower facing, then arrive parallel to the tape.
    const shoulder = [join[0] + Math.max(-run * .42, slope * rise * .22), join[1] + rise * .32];
    const rightTape = [r.x, r.y - rise * .26];
    const mirror = (p: number[]) => [2048 - p[0], p[1]];
    const cubic = (...points: number[][]) => ' C ' + points.flat().join(' ');
    const side = hasLongSide ? upper[upperCount + 1] : undefined;
    const arc = upper.slice(1, upperCount + 1).map(segment => ' C ' + segment.join(' ')).join('');
    const d = `M ${l.x} ${l.y}`
      + cubic([l.x, l.y - rise * .26], mirror(shoulder), mirror(join))
      + cubic(mirror(ab), mirror(a), mirror(start))
      + (side ? cubic(mirror(side.slice(2, 4)), mirror(side.slice(0, 2)), mirror([rx, ry])) : '')
      + arc + (side ? ' C ' + side.join(' ') : '')
      + cubic(a, ab, join) + cubic(shoulder, rightTape, [r.x, r.y]);
    if (raw.includes('data-hood-facing-stitch')) {
      const offset = (p: number[]) => [p[0] + 16, p[1] + 4];
      const stitchEnd = [r.x + 13, r.y - 9];
      const stitchSide = side ? cubic(offset(side.slice(0, 2)), offset(side.slice(2, 4)), offset(start)) : '';
      const stitchRight = 'M ' + offset([rx, ry]).join(' ') + stitchSide
        + cubic(offset(a), offset(ab), offset(join))
        + cubic(offset(shoulder), [stitchEnd[0], rightTape[1]], stitchEnd);
      const stitchLeft = stitchRight.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${2048 - Number(x)} ${y}`);
      return `<path${before}d="${stitchLeft} ${stitchRight}"${after}/>`;
    }
    return `<path${before}d="${d}${before.includes('fill="none"') ? '' : ' Z'}"${after}/>`;
  });
}

const pocketOutline = 'M 789 1161 L 1259 1161 L 1331 1468 Q 1341 1516 1278 1603 M 770 1603 Q 707 1516 717 1468 L 789 1161';
type FittedTshirtNeck = {
  raw: string;
  ink: string;
  inside?: string;
  rightToLeft: string;
  joinX: number;
  joinY: number;
  seamJoinX: number;
  seamJoinY: number;
  seamRightToLeft: string;
  finishSource?: NeckFinish;
};
const neckAssetCache = new Map<string, FittedTshirtNeck>();

function fitTshirtNeck(option: ReturnType<typeof hoodieNeckline>, front: boolean, finish: NeckFinish) {
  if (typeof document === 'undefined') return undefined;
  const asset = option.asset;
  const source = front ? asset.front : asset.back;
  const master = tshirtNeckMaster(option.label, front ? 'front' : 'back', finish);
  const cacheKey = master ? source + ':' + finish + ':' + master.body : source;
  const cached = neckAssetCache.get(cacheKey);
  if (cached) return cached;
  const rings = fabricRings(source);
  const points = rings.flat();
  if (!points.length) return undefined;
  const left = points.reduce((best, point) => point.x < best.x ? point : best);
  const right = points.reduce((best, point) => point.x > best.x ? point : best);
  const joinY = (left.y + right.y) / 2;
  const scale = 400 / (right.x - left.x);
  const x = 824 - left.x * scale;
  const y = HOODLESS_NECK_Y - joinY * scale;
  const rawBody = finish === 'raw' && master ? fabricRings(master.body) : undefined;
  const transform = `translate(${1024 + (x - 1024) * boxyWidth} ${y}) scale(${scale * boxyWidth} ${scale})`;
  const fitAsset = (raw: string) => raw.replace(/<g transform="[^"]+"/,
    `<g transform="${transform}"`).replace('<svg ', `<svg data-tshirt-hoodie-neck="true" data-no-fabric-edge-seal="true"${master ? ` data-neck-master-finish="${finish}"` : ''} `);

  const collarEdgesAt = (u: number) => {
    const probe = (u - x) / scale;
    let top = Infinity;
    let bottom = -Infinity;
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if ((a.x <= probe && b.x > probe) || (b.x <= probe && a.x > probe)) {
        const crossing = a.y + (b.y - a.y) * (probe - a.x) / (b.x - a.x);
        top = Math.min(top, crossing);
        bottom = Math.max(bottom, crossing);
      }
    }
    if (rawBody?.length) {
      let opening = Infinity;
      for (const ring of rawBody) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if ((a.x > probe) !== (b.x > probe)) opening = Math.min(opening, a.y + (b.y - a.y) * (probe - a.x) / (b.x - a.x));
      }
      if (Number.isFinite(opening)) bottom = opening + 9 / scale;
    }
    return Number.isFinite(bottom) && Number.isFinite(top) ? { top: y + top * scale, bottom: y + bottom * scale } : { top: HOODLESS_NECK_Y, bottom: HOODLESS_NECK_Y };
  };
  // Seat both shoulders slightly inside the collar edges so the fabric covers
  // the join even where the original traced corners are rounded.
  const joinX = 835;
  const rightJoinX = 2048 - joinX;
  const leftEdge = collarEdgesAt(joinX);
  const rightEdge = collarEdgesAt(rightJoinX);
  const shoulderY = Math.max(leftEdge.top, rightEdge.top) + 5;
  const joins = Array.from({ length: 59 }, (_, index) => {
    const u = rightJoinX - (index + 1) * (rightJoinX - joinX) / 60;
    return `L ${u.toFixed(2)} ${(collarEdgesAt(u).bottom - 9).toFixed(2)}`;
  });
  // The sleeve wraps around the shoulder crest and joins under the side of the band.
  const seamJoinX = joinX + (front ? 34 : 25);
  const seamRightX = 2048 - seamJoinX;
  const seamJoinY = Math.min(collarEdgesAt(seamJoinX).bottom, collarEdgesAt(seamRightX).bottom) - 9;
  const seamJoins = Array.from({ length: 59 }, (_, index) => {
    const u = seamRightX - (index + 1) * (seamRightX - seamJoinX) / 60;
    return `L ${u.toFixed(2)} ${(collarEdgesAt(u).bottom - 9).toFixed(2)}`;
  });

  // Isolate the original T-shirt construction ink around the collar and lining.
  const neck = master?.neck ?? source;
  const inside = master?.inside ?? asset.inside;
  const outline = master?.outline ?? (front ? asset.frontInk : asset.backInk);
  const clipPaths = [neck, ...(front ? [inside] : [])].flatMap(raw =>
    [...raw.matchAll(/<path[^>]* d="([^"]+)"/g)].map(match =>
      `<path d="${match[1]}" fill="white" fill-rule="evenodd" stroke="white" stroke-width="12"/>`)).join('');
  const outlineContent = outline.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>[\s\S]*$/g, '');
  const mask = front ? 'hoodie-front-collar-ink' : 'hoodie-back-collar-ink';
  const result = {
    raw: fitAsset(neck),
    inside: front ? fitAsset(inside) : undefined,
    ink: svg(`<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048">${clipPaths}</mask></defs><g transform="${transform}"><g mask="url(#${mask})" data-fixed-ink="true">${outlineContent}</g></g>`)
      .replace('<svg ', '<svg data-tshirt-hoodie-neck="true" '),
    rightToLeft: [...joins, `L ${joinX} ${shoulderY}`].join(' '),
    joinX,
    joinY: shoulderY,
    seamJoinX,
    seamJoinY,
    seamRightToLeft: [...seamJoins, `L ${seamJoinX} ${seamJoinY}`].join(' '),
    finishSource: master ? finish : undefined,
  };
  neckAssetCache.set(cacheKey, result);
  return result;
}

export function regularHoodieLayers(
  view: 'front' | 'back',
  colours?: Partial<Record<string, string>>,
  stitchingColour?: string,
  selection: GarmentAssetSelection = {},
  torsoCrop = 0,
  hemStyles?: TshirtHemStyles,
  neckFinish: NeckFinish = 'ribbed',
): ResolvedGarmentLayer[] {
  const layers: ResolvedGarmentLayer[] = [];
  const front = view === 'front';
  const crewneck = selection.hoodieStyle === 'crewneck';
  const showPocket = front && selection.hoodiePocket === 'on';
  const [hoodType] = hoodieTypeOption(selection.hoodieType);
  const [profile] = hoodieProfileOption(selection.hoodieProfile);
  const scuba = hoodType === 'scuba';
  const lowHood = hoodiePositionOption(selection.hoodiePosition, selection.hoodieProfile)[0] === 'relaxed';
  const neckOption = hoodieNeckline(selection.hoodieNeckline);
  const collarFinish = neckFinish === 'raw' && /polo/i.test(neckOption.label) ? 'clean' : neckFinish;
  const traced = crewneck && neckOption.asset ? fitTshirtNeck(neckOption, front, collarFinish) : undefined;
  const neckDepth = (front ? neckOption.depth : 652) + HOODLESS_NECK_OFFSET;
  const pointedNeck = front && neckOption.pointed;
  const fitScale = hoodieFitBlock(selection.hoodieFit).hoodScale;
  const hoodScale = crewneck ? 1 : fitScale;
  const finishSettings = (id: string) => hemStyles?.editing?.regions?.[id] || (id !== 'bodyHem' && selection.hoodieCuff === 'none')
    ? resolveHoodieFinish(selection, hemStyles, id) : undefined;
  const bodyFinish = finishSettings('bodyHem') ?? (selection.hoodieHem === 'turned'
    ? resolveHoodieFinish(selection, hemStyles, 'bodyHem') : undefined);
  const leftFinish = finishSettings('sleeveHemLeft');
  const rightFinish = finishSettings('sleeveHemRight');
  const cutFor = (finish?: HemSettings) => hoodieCut(selection.hoodieShoulder, crewneck,
    selection.hoodieSleeve, selection.hoodieHem, selection.hoodieCuff, lowHood,
    selection.hoodieFit, neckDepth, pointedNeck, hoodScale, torsoCrop, traced, finish, bodyFinish);
  const cut = cutFor(leftFinish);
  const rightCut = JSON.stringify(leftFinish) === JSON.stringify(rightFinish) ? cut : cutFor(rightFinish);
  const profileHood = (source: string) => {
    // Add depth around the crown and opening while keeping the neckline anchors fixed.
    const shaped = hoodType === 'oversized' ? source.replace(/ d="([^"]+)"/g, (_, path: string) =>
      ` d="${path.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => {
        const fullness = Math.min(1, Math.max(0, (650 - Number(y)) / (lowHood ? 110 : 240)));
        return `${1024 + (Number(x) - 1024) * (1 + .22 * fullness)} ${y}`;
      })}"`) : source;
    if (hoodScale === 1) return shaped;
    return shaped.replace('<path ', `<path transform="translate(${1024 * (1 - hoodScale)} ${650 * (1 - hoodScale)}) scale(${hoodScale})" `);
  };
  function add(
    id: string, displayName: string, svgRaw: string, zIndex: number,
    fabricRegion?: ResolvedGarmentLayer['fabricRegion'], tint?: string,
  ) {
    layers.push({
      id, displayName, svgRaw: svgRaw.includes('data-tshirt-hoodie-neck') ? svgRaw : narrowBoxy(svgRaw), zIndex, fabricRegion,
      category: id,
      assetId: REGULAR_HOODIE_PRESET + ':' + id,
      kind: fabricRegion ? 'solid' : 'detail',
      tint: colours?.[id] ?? tint,
      ...(fabricRegion ? {} : { washable: false }),
    });
  }
  const compoundPanel = (paths: string[]) => paths.filter(Boolean).length > 1
    ? panel(continuousHoodieFinish(paths)) : panel(paths[0]);
  const thread = stitchingColour ?? '#ffffff';
  const finishRows: { id: string; markup: string; settings: HemSettings }[] = [];
  const wornPanels = new Map<string, string>();
  const addFinish = (id: string, parent: string, original: string, paths: string[], edge: number[], settings: HemSettings | undefined, right = false, control?: [number, number]) => {
    const cuff = parent !== 'base';
    const rib = settings ? hoodieFinishIsRib(settings) : cuff
      ? (selection.hoodieCuff ?? (selection.hoodieHem === 'turned' ? 'normal' : 'ribbed')) === 'ribbed'
      : selection.hoodieHem !== 'turned';
    const distressed = settings?.construction === 'distressed';
    const raw = settings?.construction === 'raw' || distressed;
    const orient = right ? mirror : (d: string) => d;
    const result = settings && !raw ? hoodieTerminalFinish(paths, [[edge[0], edge[1]], [edge[2], edge[3]]], settings, 17) : undefined;
    const fill = result?.fill || original;
    const integrated = !cuff && settings && !rib;
    if (integrated || fill && raw) {
      // Keep a focus target for Close-up without creating a second fabric part.
      add(id, cuff ? right ? 'Right raw edge' : 'Left raw edge' : raw ? 'Raw bottom edge' : 'Bottom hem',
        svg(`<path fill="none" d="${orient(fill || `M ${edge[0]} ${edge[1] - 50} L ${edge[2]} ${edge[3]}`)}"/>`), 22);
    }
    if (raw) {
      const fibres = rawEdgeTreatment(edge, cuff ? right ? 37 : 23 : 17, control, distressed);
      if (fibres) {
        const direction = right ? ' transform="translate(2048 0) scale(-1 1)"' : '';
        const facing = hoodieTerminalFinish(paths, [[edge[0], edge[1]], [edge[2], edge[3]]], { construction: 'raw', depthCm: 3 }, 17).fill;
        const openings = fibres.match(/data-distress-openings="true" d="([^"]+)"/)?.[1];
        let facingMarkup = `<path fill="#252030" opacity=".16" d="${facing}"/>`;
        if (openings) {
          const holes = flattenPathContours(openings, 1).map(r => [r.map(({x,y}) => [x,y] as [number,number])]);
          const worn = stablePolygonDifference(hoodieTerminalFootprint(paths), holes);
          const fill = worn.map(poly => poly.map(ring => 'M ' + ring.map(p => p.join(' ')).join(' L ') + ' Z').join(' ')).join(' ');
          wornPanels.set(parent, right ? svgpath(fill).matrix([-1,0,0,1,2048,0]).toString() : fill);
          facingMarkup = `<path fill="#252030" fill-rule="evenodd" opacity=".16" d="${facing} ${openings}"/>`;
        }
        add(id + 'Fray', distressed ? 'Distressed edge fibres' : 'Raw edge fibres', svg(`<g data-hem-fray="true" data-fixed-ink="true"${direction} fill="none" stroke-linecap="round">${facingMarkup}${fibres}</g>`), 29);
      }
    } else if (fill && !integrated) {
      const band = orient(fill);
      const artwork = rib ? panel(band).replace('<svg ', '<svg data-drawn-hem-ribbing="true" ') : panel(band);
      add(id, cuff ? right ? 'Right cuff' : 'Left cuff' : 'Bottom hem', artwork, 22,
        { role: cuff ? 'cuff' : 'hem', ...(cuff ? { group: 'cuffs' } : {}),
          ...(rib ? {} : { materialCategory: cuff ? 'sleeves' : 'body' }), fallbackFromId: parent }, settings?.color || colours?.[parent]);
      if (settings?.color) layers.at(-1)!.tint = settings.color;
      if (rib) add(id + 'Ribs', 'Hem rib lines', svg(`<path data-fixed-ink="true" data-hoodie-hem-ribs="${id}" fill="none" stroke="#141414" stroke-width="1.5" opacity=".45" d="${hemRibLines(band)}"/>`), 23);
    }
    if (result && settings && !(!cuff && cut.waistChannel)) {
      const rows = right ? result.stitches.map(row => row.map(p => ({ x: 2048 - p.x, y: p.y }))) : result.stitches;
      finishRows.push({ id, markup: hoodieFinishStitchMarkup(rows, settings), settings });
    }
  };
  const sleeveless = selection.hoodieSleeve === 'sleeveless';
  if (!sleeveless) {
    add('sleeveLeft', 'Left sleeve', compoundPanel([cut.leftSleeve, leftFinish ? cut.cuffTerminal : '']), 10, { role: 'sleeve', group: 'sleeves' });
    add('sleeveRight', 'Right sleeve', compoundPanel([rightCut.rightSleeve, rightFinish ? mirror(rightCut.cuffTerminal) : '']), 10, { role: 'sleeve', group: 'sleeves' });
  }
  if (cut.sleeveUnderarmInk) add('hoodieSleeveUnderarmInk', 'Inner sleeve edges', seam(cut.sleeveUnderarmInk, 5), 11, undefined, '#202020');
  const point = (pair: string) => {
    const [x, y] = pair.split(' ').map(Number);
    return { x: 1024 + (x - 1024) * boxyWidth, y };
  };
  for (const [index, right] of [[0, false], [1, true]] as const) {
    if (sleeveless) break;
    layers[index].measurementShoulder = point(right ? mirror(cut.sleeveTop) : cut.sleeveTop);
    layers[index].measurementUnderarm = point(right ? mirror(cut.sideTop) : cut.sideTop);
  }
  add('base', 'Body', compoundPanel([cut.torso, bodyFinish ? cut.waistband : '']), 20, { role: 'body' });
  if (!sleeveless) {
    for (const [side, geometry, finish] of [['Left', cut, leftFinish], ['Right', rightCut, rightFinish]] as const) {
      const edge = geometry.cuffTerminalEdge.map((v, i) => i % 2 ? v + geometry.sleeveLengthOffset : v);
      addFinish('sleeveHem' + side, 'sleeve' + side,
        finish ? geometry.cuffTerminal || geometry.cuff : geometry.cuff,
        [geometry.leftSleeve, geometry.cuffTerminal].filter(Boolean), edge, finish, side === 'Right', geometry.cuffEdgeControl);
    }
  }
  addFinish('bodyHem', 'base', cut.waistband, [cut.torso, cut.waistband], cut.waistEdge, bodyFinish);
  for (const layer of layers) {
    const worn = wornPanels.get(layer.id);
    if (worn) layer.svgRaw = narrowBoxy(svg(`<path fill="#000000" fill-rule="evenodd" d="${worn}"/>`));
  }
  if (cut.waistGathers) {
    add('hoodieHemGathers', 'Hem gathers', seam(cut.waistGathers, 2.6), 29);
  }
  if (cut.waistChannel && bodyFinish && bodyFinish.stitchStyle !== 'none') {
    const markup = bodyFinish.stitchStyle && bodyFinish.stitchStyle !== 'standard'
      ? svg(hoodieFinishStitchMarkup([flattenConstructionSeam(cut.waistChannel)], bodyFinish))
      : svg(stitchPath(cut.waistChannel, { fine: 3, regular: 4, heavy: 5 }[bodyFinish.stitchThread ?? 'regular']));
    add('bodyHemStitching', 'Casing stitching', markup, 30, undefined, bodyFinish.stitchColor || thread);
  }
  if (front && bodyFinish?.construction === 'adjustable') {
    const [left, bottom, right] = cut.waistEdge;
    add('hoodieHemCord', 'Adjustable hem drawcord', svg(adjustableHemHardware(left, right, bottom)), 31);
  }
  add('hoodieBodyLinework', 'Body seams', seam(`${cut.sideLines} ${mirror(rightCut.sideLines)} ${cut.waistOutline}`, 5), 28, undefined, '#202020');
  const originalStitches = [!bodyFinish && cut.waistStitch, !leftFinish && cut.cuffStitch, !rightFinish && mirror(rightCut.cuffStitch)].filter(Boolean).join(' ');
  add('bodyStitching', 'Body, sleeve and hem stitching',
    svg(stitchPath(cut.seamStitches) + (originalStitches ? stitchPath(originalStitches) : '')), 30, undefined, thread);
  for (const { id, markup, settings } of finishRows) if (markup) {
    add(id + 'Stitching', 'Edge stitching', svg(markup), 30, undefined, settings.stitchColor || thread);
  }
  const rawNeck = crewneck && collarFinish === 'raw';
  if (traced) {
    if (traced.inside) add('innerBackNeck', 'Inside neckline', traced.inside, rawNeck ? 1 : 31,
      { role: 'interior', interior: true, surface: 'reverse', exteriorPartId: 'base', hoodieColour: 'hood-inside' });
    const left = `${traced.joinX} ${traced.joinY}`;
    const edge = `M ${2048 - traced.joinX} ${traced.joinY} ${traced.rightToLeft}`;
    const rawOutline = traced.finishSource === 'raw' ? seam(edge, 5).replace('<svg ', '<svg data-neck-master-finish="raw" ') : seam(edge, 5);
    add('neck', neckOption.label, rawNeck ? rawOutline : traced.raw, 32, rawNeck ? undefined : { role: 'neck' }, rawNeck ? '#202020' : undefined);
    layers.at(-1)!.measurementShoulder = point(left);
    layers.at(-1)!.measurementUnderarm = point(`${2048 - traced.joinX} ${traced.joinY}`);
    if (!rawNeck) {
      add('outline', 'Neckline outline', traced.ink, 40, undefined, '#202020');
      if (collarFinish === 'ribbed') {
        const rib = neckRibbing(layers);
        if (rib.lines && rib.clip) add('hoodieNeckRibs', 'Neckband rib lines',
          svg(`<defs><clipPath id="hoodie-neck-ribs"><path d="${rib.clip}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#hoodie-neck-ribs)"><path data-fixed-ink="true" fill="none" stroke="#141414" stroke-width="1.5" opacity=".45" d="${rib.lines}"/></g>`)
            .replace('<svg ', '<svg data-tshirt-hoodie-neck="true" '), 39);
      }
    }
  } else if (crewneck) {
    const left = `877 ${HOODLESS_NECK_Y}`;
    const right = `1171 ${HOODLESS_NECK_Y}`;
    const outerNeck = hoodieNeckCurve(neckDepth, pointedNeck, right);
    const innerDepth = Math.max(HOODLESS_NECK_Y + 13, neckDepth - neckOption.band);
    const innerNeck = pointedNeck
      ? `L 1024 ${innerDepth} L ${left}`
      : hoodieNeckCurve(innerDepth, false, left);
    const band = `M ${left} ${outerNeck} ${innerNeck} Z`;
    const neckPath = band;
    const rawEdge = `M ${left} ${outerNeck}`;
    add('neck', neckOption.label, rawNeck ? seam(rawEdge, 5) : panel(neckPath),
      32, rawNeck ? undefined : { role: 'neck' }, rawNeck ? '#202020' : undefined);
    layers.at(-1)!.measurementShoulder = point(left);
    layers.at(-1)!.measurementUnderarm = point(right);
    if (!rawNeck) add('outline', 'Neckline outline', seam(neckPath, 5), 40, undefined, '#202020');
    const stitch = `M 877 ${HOODLESS_NECK_Y + 10} ${hoodieNeckCurve(neckDepth + 10, pointedNeck, `1171 ${HOODLESS_NECK_Y + 10}`)}`;
    if (!rawNeck) add('stitching', 'Neckline stitching', stitchSvg(stitch), 42, undefined, thread);
  } else {
    const shape = scuba ? (lowHood ? relaxedScubaHood : scubaHood) : lowHood ? relaxedHood : hood;
    const shell = front ? shape.front : shape.back;
    const panelSeams = profile === 'three-panel'
      ? (lowHood ? (scuba ? (front ? '' : 'M 945 271 C 923 426 918 630 945 779 M 1103 271 C 1125 426 1130 630 1103 779')
        : front ? 'M 947 506 Q 941 558 960 671 M 1101 506 Q 1107 558 1088 671'
          : 'M 940 564 C 906 678 907 836 950 941 M 1108 564 C 1142 678 1141 836 1098 941')
        : front ? (scuba ? 'M 965 25 Q 950 67 946 135 M 1083 25 Q 1098 67 1102 135'
        : 'M 965 40 Q 950 79 946 149 M 1083 40 Q 1098 79 1102 149')
        : scuba ? 'M 965 25 C 904 212 907 500 942 769 M 1083 25 C 1144 212 1141 500 1106 769'
        : 'M 965 43 C 904 212 907 500 942 747 M 1083 43 C 1144 212 1141 500 1106 747')
      : '';
    const crownSeam = profile === 'standard' && !lowHood
      ? (scuba ? 'M 1024 22 L 1024 128' : 'M 1024 23 L 1024 141') : '';
    const frontSeams = lowHood && !scuba && profile !== 'standard' ? '' : shape.frontSeams;
    const hoodLines = front ? `${crownSeam} ${panelSeams}`
      : profile === 'seamless' ? '' : panelSeams || shape.backSeams;
    add('hood', 'Hood shell', profileHood(panel(shell)), 32, { role: 'hood', hoodieColour: 'hood-shell' });
    layers.at(-1)!.measurementShoulder = point(hoodAnchor(728, 650, hoodScale));
    layers.at(-1)!.measurementUnderarm = point(hoodAnchor(1320, 650, hoodScale));
    if (front) {
      const lined = selection.hoodieLining !== 'single';
      const face = (raw: string) => profileHood(raw.replace('<svg ', '<svg data-hood-face="' + (shape === relaxedScubaHood ? 3 : 2) + '" '));
      add(lined ? 'hoodLining' : 'hoodInterior', lined ? 'Hood lining' : 'Inside hood', face(panel(shape.opening)), 34,
        { role: 'interior', interior: true, exteriorPartId: 'hood', hoodieColour: 'hood-inside', surface: lined ? 'lining' : 'reverse' });
      add('hoodFaceOutline', 'Hood face opening', face(seam(shape.opening, 5)), 40);
      if (frontSeams && selection.hoodOpeningFinish !== 'raw') add('hoodFaceSeams', 'Hood face seams', profileHood(seam(frontSeams, 5)), 40);
      if (!lowHood && selection.hoodOpeningFinish !== 'raw') add('stitchingHoodFacing', 'Hood facing stitching',
        face(svg(stitchPath(shape.opening)).replace('<svg ', '<svg data-hood-facing-stitch="true" ')), 42, undefined, thread);
    }
    add('outline', 'Hood outline', profileHood(seam(`${shell} ${hoodLines}`, 5)), 40);
    const hoodStitch = scuba && lowHood
      ? (front ? 'M 781 407 C 803 468 910 503 1024 503 C 1138 503 1245 468 1267 407' : 'M 1036 280 L 1036 786')
      : scuba ? (front ? 'M 757 345 C 780 236 894 140 1024 140 C 1154 140 1268 236 1291 345'
      : profile === 'three-panel' ? 'M 977 39 C 916 220 919 500 954 755 M 1071 39 C 1132 220 1129 500 1094 755'
        : 'M 1036 43 L 1036 765') : lowHood ? (front ? 'M 775 528 C 903 503 1145 503 1273 528'
      : 'M 745 549 C 898 590 1150 590 1303 549') : front
      ? 'M 758 365 C 793 249 913 156 1024 156 C 1135 156 1255 249 1290 365'
      : profile === 'three-panel' ? 'M 977 54 C 916 220 919 500 954 731 M 1071 54 C 1132 220 1129 500 1094 731' : 'M 1036 43 L 1036 741';
    if (front ? selection.hoodOpeningFinish !== 'raw' : profile !== 'seamless' && !(lowHood && scuba && profile === 'three-panel')) {
      add('stitching', 'Hood stitching', profileHood(stitchSvg(hoodStitch)), 42, undefined, thread);
    }
    if (front && shape.crossover && (selection.hoodOverlap ?? 'on') === 'on') {
      add('hoodOverlap', 'Hood overlap seam', profileHood(seam(shape.crossover, 5)), 41, undefined, '#202020');
    }
    if (front && selection.hoodieDrawcord === 'on') {
      add('drawstring', 'Hood drawcord', profileHood(seam('M 958 699 Q 938 811 952 863 M 1090 699 Q 1113 794 1100 840', 9)), 46, undefined, '#202020');
    }
  }
  if (showPocket) {
    const movePocket = (raw: string) => !cut.shortenBy ? raw : raw.replace(/(<svg[^>]*>)/,
      `$1<g transform="translate(0 ${-cut.shortenBy})">`).replace('</svg>', '</g></svg>');
    add('pocket', 'Kangaroo pocket', movePocket(pocket), 36, { role: 'pocket' });
    add('hoodiePocketOutline', 'Pocket seams', movePocket(seam(pocketOutline)), 40, undefined, '#202020');
    const pocketLeft = 'M 799 1173 L 732 1471 Q 727 1517 776 1591';
    const pocketStitches = `${pocketLeft} ${mirror(pocketLeft)} M 799 1173 L 1249 1173`;
    add('hoodiePocketStitching', 'Pocket stitching', movePocket(stitchSvg(pocketStitches)), 42, undefined, thread);
  }
  return layers;
}

export function hoodieFitThumbnail(selection: GarmentAssetSelection, highlightSleeves = false, necklineOnly = false): string {
  const markup = regularHoodieLayers('front', undefined, '#b1b7c0', selection)
    .filter(layer => !/stitching/i.test(layer.id))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(({ svgRaw, fabricRegion }) => {
      const content = svgRaw.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>[\s\S]*$/g, '');
      if (!fabricRegion) return content.replace(/stroke-width="(?:4\.4|5)"/g, 'stroke-width="23"');
      const fill = highlightSleeves && fabricRegion.role === 'sleeve' ? '#a0abb9' : '#f1f3f6';
      return content.replace(/fill="#000000"/g, `fill="${fill}"`);
    }).join('');
  return 'data:image/svg+xml,' + encodeURIComponent(svg(markup).replace('0 0 2048 2048', necklineOnly ? '420 -12 1208 1010' : '64 -24 1920 2080'));
}

export function hoodieSleeveThumbnail(selection: GarmentAssetSelection): string {
  const parts = regularHoodieLayers('front', undefined, undefined, selection)
    .filter(layer => layer.id === 'sleeveLeft' || layer.id === 'sleeveHemLeft')
    .map(layer => layer.svgRaw.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>[\s\S]*$/g, '')
      .replace('fill="#000000"', `fill="${layer.id === 'sleeveLeft' ? '#f1f3f6' : '#dce2ea'}" stroke="#333" stroke-width="22" stroke-linejoin="round"`));
  return 'data:image/svg+xml,' + encodeURIComponent(svg(parts.join('')).replace('0 0 2048 2048', '80 560 1010 1510'));
}
