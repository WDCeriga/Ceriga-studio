import crossover from '../../assets/studio-hoodie/hoods/crossover-reference-v1/construction.json';
import deepRegistration from '../../assets/studio-hoodie/hoods/deep-reference-v3/registration.json';
import scubaRegistration from '../../assets/studio-hoodie/hoods/supplied-scuba-20260925/replacement.json';
import type { HoodieSeam } from './hoodieSeamGeometry';

type Point = [number, number];
type Cubic = [Point, Point, Point, Point];
type BodyMapping = {
  center: number;
  neck: Cubic;
  shoulder: Cubic;
  join: Cubic;
  sleeve: Cubic[];
  cuff: Cubic;
  hem: Cubic;
  pocket: { topLeft: Point; corner: Point; bottomLeft: Point; centerBottom: number };
};
const bodyMappings: Record<string, BodyMapping> = {
  slim: {
    center: 1024.5,
    neck: [[837, 590], [870, 639], [952, 676], [1025, 675]],
    shoulder: [[812, 595], [764, 616], [691, 649], [666, 681]],
    join: [[665, 687], [687, 748], [713, 847], [735, 901]],
    sleeve: [[[706, 947], [728, 1110], [674, 1570], [635, 1739]]],
    cuff: [[559, 1770], [584, 1775], [621, 1775], [635, 1770]],
    hem: [[714, 1627], [869, 1648], [1178, 1648], [1335, 1627]],
    pocket: { topLeft: [873, 1298], corner: [809, 1489], bottomLeft: [819, 1605], centerBottom: 1605 },
  },
  regular: {
    center: 1023,
    neck: [[827, 579], [864, 626], [952, 665], [1023, 664]],
    shoulder: [[799, 581], [680, 640], [620, 643], [590, 761]],
    join: [[584, 762], [616, 790], [660, 847], [674, 876]],
    sleeve: [[[647, 920], [651, 1190], [652, 1530], [605, 1720]]],
    cuff: [[469, 1742], [514, 1748], [565, 1754], [601, 1758]],
    hem: [[691, 1635], [868, 1650], [1183, 1650], [1353, 1635]],
    pocket: { topLeft: [850, 1267], corner: [758, 1492], bottomLeft: [767, 1612], centerBottom: 1612 },
  },
  boxy: {
    center: 1022.5,
    neck: [[832, 609], [874, 654], [952, 695], [1023, 693]],
    shoulder: [[801, 610], [636, 669], [614, 661], [560, 832]],
    join: [[553, 838], [583, 854], [626, 890], [654, 925]],
    sleeve: [[[630, 971], [632, 1210], [640, 1490], [586, 1649]]],
    cuff: [[460, 1679], [497, 1681], [549, 1685], [584, 1686]],
    hem: [[662, 1581], [860, 1588], [1186, 1588], [1383, 1581]],
    pocket: { topLeft: [831, 1217], corner: [749, 1428], bottomLeft: [763, 1551], centerBottom: 1551 },
  },
  cropped: {
    center: 1021,
    neck: [[844, 619], [880, 666], [953, 709], [1021, 708]],
    shoulder: [[815, 621], [680, 653], [651, 675], [616, 809]],
    join: [[610, 818], [650, 839], [694, 873], [729, 913]],
    sleeve: [[[705, 953], [711, 1100], [733, 1310], [731, 1430]], [[731, 1430], [729, 1530], [684, 1610], [622, 1629]]],
    cuff: [[470, 1636], [508, 1641], [578, 1652], [616, 1660]],
    hem: [[755, 1381], [895, 1391], [1145, 1391], [1284, 1381]],
    pocket: { topLeft: [900, 1141], corner: [851, 1290], bottomLeft: [858, 1357], centerBottom: 1357 },
  },
  baggy: {
    center: 1017,
    neck: [[842, 587], [878, 632], [949, 671], [1020, 669]],
    shoulder: [[812, 590], [666, 650], [602, 691], [549, 857]],
    join: [[544, 864], [570, 887], [611, 932], [642, 974]],
    sleeve: [[[616, 1020], [613, 1190], [607, 1330], [658, 1475]], [[658, 1475], [701, 1570], [662, 1650], [608, 1692]]],
    cuff: [[481, 1721], [520, 1724], [570, 1724], [606, 1721]],
    hem: [[698, 1525], [869, 1540], [1164, 1540], [1336, 1525]],
    pocket: { topLeft: [827, 1169], corner: [745, 1388], bottomLeft: [773, 1503], centerBottom: 1509 },
  },
};

export function hoodieNecklineLandmarks(fit: string) {
  const mapping = bodyMappings[fit];
  if (!mapping) return null;
  return { center: mapping.center, sideX: mapping.neck[0][0], sideY: mapping.neck[0][1], frontY: mapping.neck[3][1] };
}

function mirrored(curve: Cubic, center: number): Cubic {
  return curve.map(([column, row]) => [2 * center - column, row]) as Cubic;
}

export function bodyPanelSeams(fit: string, panel: string, construction: 'set-in' | 'raglan' | 'dropped-shoulder'): HoodieSeam[] {
  const mapping = bodyMappings[fit];
  if (!mapping) return [];
  const pair = (curve: Cubic, region: HoodieSeam['region']): HoodieSeam[] => [curve, mirrored(curve, mapping.center)]
    .map(side => ({ region, path: cubicPath(side) }));
  if (panel === 'base') {
    const seams = pair(mapping.neck, 'neckline');
    if (construction !== 'raglan') seams.push(...pair(mapping.shoulder, 'shoulder'));
    seams.push(...(construction === 'set-in' ? pair(mapping.join, 'armhole') : constructionJoinSeams(fit, construction)));
    seams.push({ region: 'hem', path: cubicPath(mapping.hem, 0, -30) });
    return seams;
  }
  if (panel === 'sleeveLeft' || panel === 'sleeveRight') {
    const seams: HoodieSeam[] = mapping.sleeve.map(curve => ({ region: 'sleeve', path: cubicPath(panel === 'sleeveLeft' ? curve : mirrored(curve, mapping.center)) }));
    seams.push({ region: 'cuffs', path: cubicPath(panel === 'sleeveLeft' ? mapping.cuff : mirrored(mapping.cuff, mapping.center), 0, -32) });
    return seams;
  }
  if (panel === 'pocket') {
    const { topLeft, corner, bottomLeft, centerBottom } = mapping.pocket;
    const right = (point: Point): Point => [2 * mapping.center - point[0], point[1]];
    const top: Cubic = [topLeft, [mapping.center - 65, topLeft[1]], [mapping.center + 65, topLeft[1]], right(topLeft)];
    const entry: Cubic = [topLeft, [topLeft[0] - 16, topLeft[1] + 52], [corner[0] + 25, corner[1] - 54], corner];
    const side: Cubic = [corner, [corner[0] + 2, corner[1] + 26], [bottomLeft[0], bottomLeft[1] - 25], bottomLeft];
    const bottom: Cubic = [bottomLeft, [mapping.center - 90, centerBottom], [mapping.center + 90, centerBottom], right(bottomLeft)];
    return [top, entry, side, bottom, mirrored(side, mapping.center), mirrored(entry, mapping.center)]
      .map(curve => ({ region: 'pocket', path: cubicPath(curve) }));
  }
  return [];
}
type Registration = { scale: number; translateX: number; translateY: number };
const regularLandmarks: Record<string, { center: number; crown: number; arch: number; side: Point; tip: number }> = {
  slim: { center: 1025, crown: 93, arch: 245, side: [835, 390], tip: 635 },
  regular: { center: 1023, crown: 96, arch: 245, side: [825, 383], tip: 626 },
  boxy: { center: 1023, crown: 144, arch: 275, side: [833, 402], tip: 650 },
  cropped: { center: 1021, crown: 124, arch: 272, side: [842, 417], tip: 672 },
  baggy: { center: 1021, crown: 124, arch: 272, side: [835, 408], tip: 630 },
};

export function regularHoodSeams(fit: string, construction: string): HoodieSeam[] {
  const landmarks = regularLandmarks[fit];
  if (!landmarks) return [];
  const { center, crown, arch, side: [left, middle], tip } = landmarks;
  const upper: Cubic = [[center, arch + 13], [center - 103, arch + 13], [left + 12, middle - 85], [left + 12, middle]];
  const lower: Cubic = [[left + 12, middle], [left + 12, middle + 84], [center - 57, tip - 115], [center, tip - 23]];
  const limit = construction === 'crossover'
    ? crossover.fits[`regular/${fit}` as keyof typeof crossover.fits]?.startY
    : undefined;
  const seams: HoodieSeam[] = [upper, lower].flatMap(curve => [curve, curve.map(([column, row]) => [2 * center - column, row]) as Cubic])
    .flatMap(curve => {
      const visible = limit === undefined ? curve : aboveRow(curve, limit - 5);
      return visible ? [{ region: 'hoodOpening' as const, path: cubicPath(visible) }] : [];
    });
  seams.push({ region: 'hoodCenter', path: `M${center + 13} ${crown + 18} V${arch - 32}` });
  seams.push({ region: 'hoodCenter', path: `M${center + 13} ${arch + 28} V${Math.min(tip - 55, limit === undefined ? Infinity : limit - 12)}` });
  if (construction === 'crossover') seams.push(...crossoverEdges('regular', fit).map(path => ({ region: 'hoodOpening' as const, path })));
  return seams;
}

export function scubaHoodSeams(fit: string): HoodieSeam[] {
  const registration = scubaRegistration.fits[fit as keyof typeof scubaRegistration.fits];
  if (!registration) return [];
  const reference = scubaRegistration.fits.boxy;
  const map = (curve: Cubic) => transformCurve(curve.map(([column, row]) => [
    (column - reference.translateX) / reference.scale,
    (row - reference.translateY) / reference.scale,
  ]) as Cubic, registration);
  const opening: Cubic[] = [
    [[1025, 294], [919, 294], [846, 346], [846, 378]],
    [[846, 378], [840, 417], [883, 471], [923, 500]],
    [[923, 500], [948, 520], [989, 495], [1025, 495]],
    [[1025, 495], [1061, 495], [1102, 520], [1127, 500]],
    [[1127, 500], [1167, 471], [1210, 417], [1204, 378]],
    [[1204, 378], [1204, 346], [1131, 294], [1025, 294]],
  ];
  const crown: Cubic[] = [
    [[962, 181], [959, 207], [956, 241], [953, 258]],
    [[1088, 181], [1091, 207], [1094, 241], [1097, 258]],
  ];
  return [
    ...opening.map(curve => ({ region: 'hoodOpening' as const, path: cubicPath(map(curve)) })),
    ...crown.map(curve => ({ region: 'hoodCenter' as const, path: cubicPath(map(curve)) })),
  ];
}
type SleeveRegistration = {
  center: number;
  neckline: { x: number; y: number };
  underarm: { x: number; y: number };
  seamStart?: { x: number; y: number };
  seamEnd?: { x: number; y: number };
};
const sleeveRegistrations = import.meta.glob<SleeveRegistration>(
  '../../assets/studio-hoodie/{raglan,dropped-shoulder}/*/registration.json',
  { eager: true, import: 'default' },
);

export function constructionJoinSeams(fit: string, construction: 'raglan' | 'dropped-shoulder'): HoodieSeam[] {
  const registration = sleeveRegistrations[`../../assets/studio-hoodie/${construction}/${fit}/registration.json`];
  if (!registration) return [];
  const start = registration.seamStart ?? registration.neckline;
  const end = registration.seamEnd ?? registration.underarm;
  const curvature = construction === 'dropped-shoulder' ? .18
    : ({ slim: .25, regular: .32, cropped: .36, boxy: .40, baggy: .40 }[fit] ?? 0);
  const control: Point = [start.x + (end.x - start.x) * (1 + curvature) / 2, (start.y + end.y) / 2];
  return [false, true].map(mirror => {
    const coordinate = (column: number, row: number) => `${mirror ? 2 * registration.center - column : column} ${row}`;
    return {
      region: 'armhole',
      path: `M${coordinate(start.x + 15, start.y + 12)} Q${coordinate(control[0] + 15, control[1])} ${coordinate(end.x + 15, end.y - 8)}`,
    };
  });
}

function transformCurve(curve: Cubic, registration: Registration): Cubic {
  return curve.map(([column, row]) => [
    column * registration.scale + registration.translateX,
    row * registration.scale + registration.translateY,
  ]) as Cubic;
}

function aboveRow(curve: Cubic, row: number): Cubic | undefined {
  if (curve.every(point => point[1] <= row)) return curve;
  if (curve.every(point => point[1] > row)) return undefined;
  const ascending = curve[0][1] < curve[3][1];
  const ordered = (ascending ? curve : [...curve].reverse()) as Cubic;
  let low = 0, high = 1;
  for (let iteration = 0; iteration < 24; iteration++) {
    const middle = (low + high) / 2;
    if (pointOn(ordered, middle)[1] < row) low = middle;
    else high = middle;
  }
  return splitCurve(ordered, low);
}

export function deepHoodSeams(fit: string, construction: string): HoodieSeam[] {
  const registration = deepRegistration.fits[fit as keyof typeof deepRegistration.fits];
  if (!registration) return [];
  const opening: Cubic[] = [
    [[350, 353], [330, 319], [302, 286], [265, 250]],
    [[265, 250], [242, 228], [229, 213], [229, 198]],
    [[229, 198], [229, 183], [237, 168], [250, 167]],
    [[250, 167], [273, 153], [316, 149], [350, 149]],
    [[350, 149], [384, 149], [425, 153], [448, 167]],
    [[448, 167], [461, 165], [470, 184], [470, 198]],
    [[470, 198], [470, 215], [455, 231], [433, 252]],
    [[433, 252], [399, 288], [371, 321], [350, 353]],
  ];
  const limit = construction === 'crossover'
    ? crossover.fits[`oversized-deep/${fit}` as keyof typeof crossover.fits]?.startY
    : undefined;
  const seams: HoodieSeam[] = opening.flatMap(curve => {
    const transformed = transformCurve(curve, registration);
    const visible = limit === undefined ? transformed : aboveRow(transformed, limit - 5);
    return visible ? [{ region: 'hoodOpening' as const, path: cubicPath(visible) }] : [];
  });
  const crown: Cubic[] = [
    [[220, 165], [250, 136], [298, 124], [350, 124]],
    [[350, 124], [402, 124], [449, 136], [479, 165]],
  ];
  seams.push(...crown.map(curve => ({ region: 'hoodCenter' as const, path: cubicPath(transformCurve(curve, registration)) })));
  if (construction === 'crossover') {
    seams.push(...crossoverEdges('oversized-deep', fit).map(path => ({ region: 'hoodOpening' as const, path })));
  }
  return seams;
}

function pointOn(curve: Cubic, amount: number): Point {
  const remaining = 1 - amount;
  return [0, 1].map(axis => remaining ** 3 * curve[0][axis]
    + 3 * remaining ** 2 * amount * curve[1][axis]
    + 3 * remaining * amount ** 2 * curve[2][axis]
    + amount ** 3 * curve[3][axis]) as Point;
}

function splitCurve(curve: Cubic, amount: number): Cubic {
  const mix = (first: Point, second: Point): Point => [
    first[0] + (second[0] - first[0]) * amount,
    first[1] + (second[1] - first[1]) * amount,
  ];
  const first = mix(curve[0], curve[1]);
  const second = mix(curve[1], curve[2]);
  const third = mix(curve[2], curve[3]);
  const fourth = mix(first, second);
  return [curve[0], first, fourth, mix(fourth, mix(second, third))];
}

export function cubicPath(curve: Cubic, horizontal = 0, vertical = 0) {
  const points = curve.map(([column, row]) => `${(column + horizontal).toFixed(3)} ${(row + vertical).toFixed(3)}`);
  return `M${points[0]} C${points.slice(1).join(' ')}`;
}

export function crossoverEdges(family: 'regular' | 'oversized-deep', fit: string) {
  const entry = crossover.fits[`${family}/${fit}` as keyof typeof crossover.fits];
  if (!entry) return [];
  const { left, right, startY, bottom } = entry;
  const center = (left + right) / 2;
  const span = right - left;
  const depth = bottom - startY;
  const rear: Cubic = [[left, startY], [left + span * .35, startY + depth * .45],
    [center + span * .02, bottom - depth * .22], [center + span * .18, bottom - 3]];
  const front: Cubic = [[right, startY], [right - span * .35, startY + depth * .45],
    [center - span * .02, bottom - depth * .22], [center - span * .16, bottom - 2]];
  const frontAtRow = (row: number) => {
    let low = 0, high = 1;
    for (let iteration = 0; iteration < 24; iteration++) {
      const middle = (low + high) / 2;
      if (pointOn(front, middle)[1] < row) low = middle;
      else high = middle;
    }
    return pointOn(front, (low + high) / 2)[0];
  };
  let low = 0, high = 1;
  for (let iteration = 0; iteration < 24; iteration++) {
    const middle = (low + high) / 2;
    const [column, row] = pointOn(rear, middle);
    if (column < frontAtRow(row) - 14) low = middle;
    else high = middle;
  }
  return [cubicPath(splitCurve(rear, low), -10, 3), cubicPath(front, 10, 3)];
}