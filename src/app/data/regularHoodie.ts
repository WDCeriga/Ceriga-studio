import type { GarmentAssetSelection, ResolvedGarmentLayer } from './garmentSvgCatalog';
import body from '../../assets/studio-hoodie/regular/body.svg?raw';
import sleeveLeft from '../../assets/studio-hoodie/regular/sleeve-left.svg?raw';
import sleeveRight from '../../assets/studio-hoodie/regular/sleeve-right.svg?raw';
import cuffLeft from '../../assets/studio-hoodie/regular/cuff-left.svg?raw';
import cuffRight from '../../assets/studio-hoodie/regular/cuff-right.svg?raw';
import hem from '../../assets/studio-hoodie/regular/hem.svg?raw';
import hoodFront from '../../assets/studio-hoodie/regular/hood-front.svg?raw';
import hoodBack from '../../assets/studio-hoodie/regular/hood-back.svg?raw';
import hoodOverlap from '../../assets/studio-hoodie/regular/hood-overlap.svg?raw';
import lining from '../../assets/studio-hoodie/regular/hood-lining.svg?raw';
import pocket from '../../assets/studio-hoodie/regular/pocket.svg?raw';
import bodyLinework from '../../assets/studio-hoodie/regular/body-linework.svg?raw';
import frontLinework from '../../assets/studio-hoodie/regular/outline-front.svg?raw';
import backLinework from '../../assets/studio-hoodie/regular/outline-back.svg?raw';
import frontStitching from '../../assets/studio-hoodie/regular/stitching-front.svg?raw';
import backStitching from '../../assets/studio-hoodie/regular/stitching-back.svg?raw';
import bodyStitching from '../../assets/studio-hoodie/regular/stitching-common.svg?raw';

import regularBody from '../../assets/studio-hoodie/standard-fit/body.svg?raw';
import regularHem from '../../assets/studio-hoodie/standard-fit/hem.svg?raw';
import regularBodyLinework from '../../assets/studio-hoodie/standard-fit/body-linework.svg?raw';
import regularBodyStitching from '../../assets/studio-hoodie/standard-fit/stitching-common.svg?raw';

export const REGULAR_HOODIE_PRESET = 'studio-hoodie:regular-pullover';

const svg = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-no-fabric-edge-seal="true">${content}</svg>`;
const transformSvg = (source: string, transform: string) =>
  source.replace(/(<svg[^>]*>)([\s\S]*)(<\/svg>)/, `$1<g transform="${transform}">$2</g>$3`);
const panel = (d: string) => svg(`<path fill="#000000" d="${d}"/>`);
const seam = (d: string, width = 4.4) =>
  svg(`<path fill="none" stroke="#202020" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>`);

// Both panels share the same seam. Keep the existing outer sleeve and cuff silhouette.
function raglanCut(sourceBody: string, linework: string, stitches: string, regular: boolean, crewneck: boolean, front: boolean) {
  const inset = regular ? 40 : 0;
  const mirror = (path: string) => path.replace(/(-?[0-9.]+) (-?[0-9.]+)/g, (_, x, y) => `${2048 - Number(x)} ${y}`);
  const cap = regular ? 'C 635 480 620 548 598 619' : 'C 606 479 578 547 558 619';
  const shoulder = crewneck ? 'M 886 389 Q 852 416 717 431' : 'M 805 405 Q 760 416 717 431';
  const joinX = crewneck ? 886 : 805;
  const joinY = crewneck ? 389 : 405;
  const underarmX = 621.55 + inset;
  const lower = `C ${593.04 + inset} 1070.36 ${554.8 + inset} 1331 ${578 + inset} 1511`;
  const reverseLower = `C ${554.8 + inset} 1331 ${593.04 + inset} 1070.36 ${underarmX} 833.53`;
  const controlX = crewneck ? 790 : 752;
  const controlY = front ? 555 : 526;
  const forward = `C ${controlX} ${controlY} ${underarmX + 28} 683 ${underarmX} 833.53`;
  const reverse = `C ${underarmX + 28} 683 ${controlX} ${controlY} ${joinX} ${joinY}`;
  const leftSleeve = `${shoulder} ${cap} C ${462 + inset} 830 ${362 + inset} 1151 ${280 + inset} 1468 C ${256 + inset} 1555 ${237 + inset} 1612 ${256 + inset} 1660 Q ${352 + inset} 1660 ${458 + inset} 1727 C ${515 + inset} 1670 ${549 + inset} 1598 ${578 + inset} 1511 ${reverseLower} ${reverse} Z`;
  const leftOriginal = regular
    ? 'C 589 1286 656 935 680 662 Q 646 609 598 619 C 620 548 635 480 717 431'
    : 'C 549 1286 616 935 640 662 Q 606 609 558 619 C 578 547 606 479 717 431';
  const rightOriginal = regular
    ? 'C 1413 480 1428 548 1450 619 Q 1402 609 1368 662 C 1392 935 1459 1286 1430 1511'
    : 'C 1442 479 1470 547 1490 619 Q 1442 609 1408 662 C 1432 935 1499 1286 1470 1511';
  let torso = sourceBody
    .replace(leftOriginal, `${reverseLower} ${reverse}`)
    .replace(rightOriginal, mirror(`${forward} ${lower}`));
  const neckline = crewneck
    ? (front ? 'Q 1024 434 1162 389' : 'Q 1024 420 1162 389')
    : 'Q 1024 349 1243 405';
  torso = torso.replace('M 717 431 Q 1019 321 1331 431', `M ${joinX} ${joinY} ${neckline}`);
  const leftSeam = `M ${joinX} ${joinY} ${forward} ${lower}`;
  const lines = linework
    .replace(/ M (?:640|680|1408|1368) 556[^"]+/g, '')
    .replace('</g>', `<path d="${shoulder} ${mirror(shoulder)} ${leftSeam} ${mirror(leftSeam)}"/></g>`);
  const leftStitch = `M ${joinX - 9} ${joinY + 11} C ${controlX - 12} ${controlY} ${underarmX + 16} 686 ${underarmX - 11} 834 C ${582 + inset} 1070 ${544 + inset} 1331 ${567 + inset} 1504`;
  const thread = stitches
    .replace(/<path d="M (?:563|603|1485|1445) 635[^"]+"\/>/g, '')
    .replace('</g>', `<path d="${leftStitch} ${mirror(leftStitch)}"/></g>`);
  return { body: torso, sleeveLeft: panel(leftSleeve), sleeveRight: panel(mirror(leftSleeve)), bodyLinework: lines, bodyStitching: thread };
}

const pocketOutline = 'M 789 1161 L 1259 1161 L 1331 1468 Q 1341 1516 1278 1603 M 770 1603 Q 707 1516 717 1468 L 789 1161';
const splitPocketLeft = 'M 789 1161 H 1008 V 1601 Q 885 1600 770 1603 Q 707 1516 717 1468 Z';
const splitPocket = svg(`<path fill="#000000" d="${splitPocketLeft}"/><path fill="#000000" transform="translate(2048 0) scale(-1 1)" d="${splitPocketLeft}"/>`);
const splitPocketSeam = svg(`<g fill="none" stroke="#202020" stroke-width="4.4" stroke-linejoin="round"><path d="${splitPocketLeft}"/><path transform="translate(2048 0) scale(-1 1)" d="${splitPocketLeft}"/></g>`);
const zipper = svg('<path fill="#444444" d="M 1007 565 Q 1024 568 1041 565 V 1747 H 1007 Z"/><path fill="none" stroke="#d4d4d4" stroke-width="8" stroke-dasharray="3 5" d="M 1024 576 V 1735"/><rect x="1015" y="574" width="18" height="48" rx="5" fill="#888888" stroke="#202020" stroke-width="4"/>');

export function regularHoodieLayers(
  view: 'front' | 'back',
  colours?: Partial<Record<string, string>>,
  stitchingColour?: string,
  selection: GarmentAssetSelection = {},
): ResolvedGarmentLayer[] {
  const layers: ResolvedGarmentLayer[] = [];
  const front = view === 'front';
  const hoodHeight = selection.hoodieProfile === 'low' ? .79 : .92;
  const hoodNeckline = front ? 566 : 490;
  const hoodProfile = (source: string) =>
    transformSvg(source, `translate(143.36 ${hoodNeckline * (1 - hoodHeight)}) scale(.86 ${hoodHeight})`);
  const crewneck = selection.hoodieStyle === 'crewneck';
  const zipped = selection.hoodieStyle === 'full-zip' && front;
  const showPocket = front && (selection.hoodiePocket === 'on' || (!crewneck && selection.hoodiePocket !== 'off'));
  const hoodD = front
    ? 'M 717 431 Q 852 416 886 389 Q 1024 434 1162 389 Q 1196 416 1331 431'
    : 'M 717 431 Q 852 416 886 389 Q 1024 420 1162 389 Q 1196 416 1331 431';
  const regular = selection.hoodieFit === 'regular';
  const baseCut = regular ? {
    body: regularBody, sleeveLeft: transformSvg(sleeveLeft, 'translate(40 0)'), sleeveRight: transformSvg(sleeveRight, 'translate(-40 0)'),
    cuffLeft: transformSvg(cuffLeft, 'translate(40 0)'), cuffRight: transformSvg(cuffRight, 'translate(-40 0)'), hem: regularHem,
    bodyLinework: regularBodyLinework, bodyStitching: regularBodyStitching,
  } : { body, sleeveLeft, sleeveRight, cuffLeft, cuffRight, hem, bodyLinework, bodyStitching };
  const raglan = selection.hoodieShoulder === 'raglan';
  const cut = raglan
    ? { ...baseCut, ...raglanCut(baseCut.body, baseCut.bodyLinework, baseCut.bodyStitching, regular, crewneck, front) }
    : baseCut;
  const bodySvg = crewneck && !raglan ? cut.body.replace('M 717 431 Q 1019 321 1331 431', hoodD) : cut.body;
  function add(
    id: string, displayName: string, svgRaw: string, zIndex: number,
    fabricRegion?: ResolvedGarmentLayer['fabricRegion'], tint?: string,
  ) {
    layers.push({
      id, displayName, svgRaw, zIndex, fabricRegion,
      category: id,
      assetId: REGULAR_HOODIE_PRESET + ':' + id,
      kind: fabricRegion ? 'solid' : 'detail',
      tint: colours?.[id] ?? tint,
      ...(fabricRegion ? {} : { washable: false }),
    });
  }
  add('sleeveLeft', 'Left sleeve', cut.sleeveLeft, 10, { role: 'sleeve', group: 'sleeves' });
  add('sleeveRight', 'Right sleeve', cut.sleeveRight, 10, { role: 'sleeve', group: 'sleeves' });
  add('base', 'Body', bodySvg, 20, { role: 'body' });
  add('sleeveHemLeft', 'Left rib cuff', cut.cuffLeft, 22, { role: 'cuff', group: 'cuffs' });
  add('sleeveHemRight', 'Right rib cuff', cut.cuffRight, 22, { role: 'cuff', group: 'cuffs' });
  add('bodyHem', 'Rib hem band', cut.hem, 22, { role: 'hem' });
  add('hoodieBodyLinework', 'Body seams', cut.bodyLinework, 28, undefined, '#202020');
  if (crewneck) {
    const neck = front
      ? 'M 886 389 Q 1024 434 1162 389 C 1152 448 1093 480 1024 480 C 955 480 896 448 886 389 Z'
      : 'M 886 389 Q 1024 420 1162 389 Q 1152 428 1024 441 Q 896 428 886 389 Z';
    add('neck', 'Crew neck rib', panel(neck), 32, { role: 'neck' });
    add('outline', 'Crew neckline', seam(hoodD + ' ' + neck), 40, undefined, '#202020');
  } else {
    add('hood', 'Hood shell', hoodProfile(front ? hoodFront : hoodBack), 32, { role: 'hood' });
    if (front) {
      const lined = selection.hoodieLining !== 'single';
      add(lined ? 'hoodLining' : 'hoodInterior', lined ? 'Hood lining' : 'Inside hood', hoodProfile(lining), 34,
        { role: 'interior', interior: true, exteriorPartId: 'hood' });
    }
    add('outline', 'Hood outline', hoodProfile(front ? frontLinework.replace(pocketOutline, '') : backLinework), 40);
    if (front && !zipped && selection.hoodOverlap === 'on') {
      add('hoodOverlap', 'Hood overlap seam', hoodProfile(hoodOverlap), 41, undefined, '#202020');
    }
    if (front && selection.hoodieDrawcord === 'on') {
      add('drawstring', 'Hood drawcord', seam('M 958 542 C 950 590 938 639 952 706 M 1090 542 C 1102 590 1113 637 1100 683', 9), 46, undefined, '#202020');
    }
  }
  if (showPocket) {
    add('pocket', zipped ? 'Split kangaroo pockets' : 'Kangaroo pocket', zipped ? splitPocket : pocket, 36, { role: 'pocket' });
    add('hoodiePocketOutline', 'Pocket seams', zipped ? splitPocketSeam : seam(pocketOutline), 40, undefined, '#202020');
  }
  const thread = stitchingColour ?? '#ffffff';
  add('bodyStitching', 'Sleeve, cuff and hem stitching', cut.bodyStitching, 30, undefined, thread);
  if (!crewneck || showPocket) {
    const hoodStitches = frontStitching.replace(/<path d="M 799[^>]+\/>/, '');
    const pocketStitches = frontStitching.replace(/<path d="M 725[^>]+\/>/, '');
    if (!crewneck) add('stitching', 'Hood stitching', hoodProfile(front ? hoodStitches : backStitching), 42, undefined, thread);
    if (showPocket) add('hoodiePocketStitching', 'Pocket stitching', pocketStitches, 42, undefined, thread);
  }
  if (zipped) add('zip', 'Full-length zipper', regular ? transformSvg(zipper, 'translate(0 -7.91) scale(1 1.014)') : zipper, 45);
  return layers;
}

export function hoodieFitThumbnail(selection: GarmentAssetSelection, highlightSleeves = false): string {
  const markup = regularHoodieLayers('front', undefined, '#b1b7c0', selection)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(({ svgRaw, fabricRegion }) => {
      const content = svgRaw.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>[\s\S]*$/g, '');
      if (!fabricRegion) return content;
      const fill = highlightSleeves && fabricRegion.role === 'sleeve' ? '#a7acb3' : '#e6e9ee';
      return content.replace(/fill="#000000"/g, `fill="${fill}"`);
    }).join('');
  return 'data:image/svg+xml,' + encodeURIComponent(svg(markup));
}
