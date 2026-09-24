import fs from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { hash, rebuildHoods } from './rebuild_hood_variants.mjs';
import { validateRebuiltHoods } from './validate_rebuilt_hoods.mjs';

const highNeckScuba = process.argv.includes('--high-neck-scuba');
const structuredScuba = highNeckScuba || process.argv.includes('--structured-scuba');
const root = highNeckScuba ? 'src/assets/studio-hoodie/hoods/high-neck-scuba-20260922'
  : structuredScuba ? 'src/assets/studio-hoodie/hoods/structured-scuba-20260922'
  : 'src/assets/studio-hoodie/hoods/cohesive-collection-20260922';
const variantDefinitions = [
  { id: 'scuba', file: 'Scuba hood', label: 'Scuba Hood', matchRegularHeight: true },
  { id: 'funnel-hood-hybrid', file: 'Funnel-hood hybrid', label: 'Funnel Hybrid Hood', matchRegularHeight: true },
  { id: 'oversized', file: 'Oversized Hood', label: 'Oversized Hood', regularHeightScale: 1.18, crownWidthScale: 1.2 },
].map((variant) => ({ ...variant, outlineWidth: 4, traceSmoothing: 0.5, matchRegularInk: true }));
const requestedVariant = process.argv.find((argument) => argument.startsWith('--variant='))?.split('=')[1];
if (structuredScuba && requestedVariant && requestedVariant !== 'scuba') throw new Error('Structured Scuba only builds scuba');
const only = structuredScuba ? 'scuba' : requestedVariant;
if (only && !variantDefinitions.some((variant) => variant.id === only)) throw new Error('Unknown hood variant');
const options = { root, variantDefinitions: variantDefinitions.filter((variant) => !only || variant.id === only)
  .map((variant) => structuredScuba ? { ...variant, necklineAttachment: highNeckScuba, bodyRelativeScuba: true, preserveSideContour: true, singleAttachmentLine: true, inkColour: '#000000' } : variant) };

if (!process.argv.includes('--validate')) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    for (const variant of options.variantDefinitions) {
      const directory = `${root}/${variant.id}`;
      fs.mkdirSync(directory, { recursive: true });
      const png = await page.evaluate(({ id, structuredScuba, highNeckScuba }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 4096;
        canvas.height = 4096;
        const context = canvas.getContext('2d');
        context.scale(4, 4);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 1024, 1024);
        context.strokeStyle = '#000000';
        context.lineCap = 'round';
        context.lineJoin = 'round';
        const draw = (width, start, curves, close = false) => {
          context.lineWidth = width;
          context.beginPath();
          context.moveTo(...start);
          for (const curve of curves) {
            if (curve.length === 2) context.lineTo(...curve);
            else context.bezierCurveTo(...curve);
          }
          if (close) context.closePath();
          context.stroke();
        };
        const oversized = id === 'oversized';
        draw(6.5, [512, 90], highNeckScuba ? [
          [369, 90, 278, 142, 230, 252],
          [193, 337, 178, 413, 196, 483],
          [211, 541, 285, 596, 294, 660],
          [306, 737, 282, 778, 190, 809],
          [278, 864, 415, 893, 512, 894],
          [609, 893, 746, 864, 834, 809],
          [742, 778, 718, 737, 730, 660],
          [739, 596, 813, 541, 828, 483],
          [846, 413, 831, 337, 794, 252],
          [746, 142, 655, 90, 512, 90],
        ] : structuredScuba ? [
          [387, 90, 286, 165, 229, 278],
          [194, 347, 182, 411, 197, 471],
          [212, 532, 267, 596, 275, 658],
          [289, 744, 268, 784, 190, 809],
          [278, 864, 415, 893, 512, 894],
          [609, 893, 746, 864, 834, 809],
          [756, 784, 735, 744, 749, 658],
          [757, 596, 812, 532, 827, 471],
          [842, 411, 830, 347, 795, 278],
          [738, 165, 637, 90, 512, 90],
        ] : oversized ? [
          [374, 90, 247, 163, 220, 310],
          [192, 452, 212, 588, 221, 710],
          [225, 759, 220, 784, 190, 809],
          [278, 864, 415, 893, 512, 894],
          [609, 893, 746, 864, 834, 809],
          [804, 784, 799, 759, 803, 710],
          [812, 588, 832, 452, 804, 310],
          [777, 163, 650, 90, 512, 90],
        ] : [
          [400, 93, 271, 172, 240, 320],
          [211, 457, 223, 604, 226, 715],
          [229, 766, 216, 791, 190, 809],
          [278, 864, 415, 893, 512, 894],
          [609, 893, 746, 864, 834, 809],
          [808, 791, 795, 766, 798, 715],
          [801, 604, 813, 457, 784, 320],
          [753, 172, 624, 93, 512, 90],
        ], true);

        if (highNeckScuba) {
          draw(4.8, [512, 306], [
            [412, 306, 311, 333, 267, 391],
            [230, 439, 266, 518, 329, 591],
            [391, 567, 452, 554, 512, 554],
            [572, 554, 633, 567, 695, 591],
            [758, 518, 794, 439, 757, 391],
            [713, 333, 612, 306, 512, 306],
          ], true);
          draw(3.8, [512, 287], [
            [400, 287, 298, 316, 250, 380],
            [204, 441, 249, 532, 322, 612],
            [390, 587, 452, 574, 512, 574],
            [572, 574, 634, 587, 702, 612],
            [775, 532, 820, 441, 774, 380],
            [726, 316, 624, 287, 512, 287],
          ], true);
          draw(3.8, [416, 98], [[398, 158, 389, 222, 386, 301]]);
          draw(3.8, [608, 98], [[626, 158, 635, 222, 638, 301]]);
          draw(3.8, [275, 383], [[292, 452, 316, 513, 353, 582]]);
          draw(3.8, [749, 383], [[732, 452, 708, 513, 671, 582]]);
            draw(3.8, [361, 599], [[376, 696, 358, 792, 315, 863]]);
          draw(3.8, [663, 599], [[648, 696, 666, 792, 709, 863]]);
        } else if (structuredScuba) {
          draw(4.8, [512, 286], [
            [411, 286, 306, 313, 249, 379],
            [192, 450, 253, 524, 327, 610],
            [351, 638, 365, 650, 393, 645],
            [438, 642, 480, 624, 512, 624],
            [544, 624, 586, 642, 631, 645],
            [659, 650, 673, 638, 697, 610],
            [771, 524, 832, 450, 775, 379],
            [718, 313, 613, 286, 512, 286],
          ], true);
          draw(3.8, [512, 270], [
            [402, 270, 296, 298, 233, 369],
            [173, 446, 238, 536, 312, 623],
            [342, 658, 361, 668, 394, 662],
            [439, 658, 481, 640, 512, 640],
            [543, 640, 585, 658, 630, 662],
            [663, 668, 682, 658, 712, 623],
            [786, 536, 851, 446, 791, 369],
            [728, 298, 622, 270, 512, 270],
          ], true);
          draw(3.8, [422, 103], [[410, 160, 399, 217, 390, 284]]);
          draw(3.8, [602, 103], [[614, 160, 625, 217, 634, 284]]);
          draw(3.8, [260, 368], [[268, 458, 291, 548, 327, 610]]);
          draw(3.8, [764, 368], [[756, 458, 733, 548, 697, 610]]);
          draw(3.8, [360, 661], [[362, 742, 340, 812, 305, 868]]);
          draw(3.8, [664, 661], [[662, 742, 684, 812, 719, 868]]);
          draw(3.8, [508, 640], [[508, 893]]);
          draw(3.8, [516, 640], [[516, 893]]);
        } else if (id === 'scuba') {
          draw(6.5, [335, 606], [
            [295, 551, 269, 489, 285, 430],
            [309, 335, 409, 285, 512, 285],
            [615, 285, 715, 335, 739, 430],
            [755, 489, 729, 551, 689, 606],
          ]);
          draw(2.8, [322, 620], [
            [275, 557, 249, 489, 268, 421],
            [295, 316, 401, 265, 512, 265],
            [623, 265, 729, 316, 756, 421],
            [775, 489, 749, 557, 702, 620],
          ]);
          draw(6.5, [223, 591], [[326, 584, 422, 654, 512, 690], [602, 654, 698, 584, 801, 591]]);
          draw(2.8, [223, 610], [[324, 606, 418, 675, 499, 711]]);
          draw(2.8, [801, 610], [[700, 606, 606, 675, 525, 711]]);
          draw(6.5, [512, 690], [[507, 759, 510, 824, 512, 890]]);
          draw(4.8, [512, 96], [[512, 265]]);
          draw(4.8, [352, 343], [[364, 432, 379, 525, 403, 621]]);
          draw(4.8, [672, 343], [[660, 432, 645, 525, 621, 621]]);
        } else if (id === 'funnel-hood-hybrid') {
          draw(6.5, [321, 645], [
            [278, 584, 254, 493, 279, 424],
            [310, 336, 411, 286, 512, 286],
            [613, 286, 714, 336, 745, 424],
            [770, 493, 746, 584, 703, 645],
          ]);
          draw(2.8, [305, 650], [
            [256, 583, 235, 490, 262, 414],
            [297, 316, 401, 266, 512, 266],
            [623, 266, 727, 316, 762, 414],
            [789, 490, 768, 583, 719, 650],
          ]);
          draw(6.5, [225, 625], [[314, 617, 413, 662, 512, 664], [611, 662, 710, 617, 799, 625]]);
          draw(2.8, [225, 645], [[321, 639, 418, 683, 512, 685], [606, 683, 703, 639, 799, 645]]);
          draw(4.8, [512, 96], [[512, 266]]);
          draw(4.8, [344, 344], [[351, 447, 370, 548, 395, 651]]);
          draw(4.8, [680, 344], [[673, 447, 654, 548, 629, 651]]);
          draw(4.8, [322, 683], [[319, 748, 298, 800, 284, 844]]);
          draw(4.8, [702, 683], [[705, 748, 726, 800, 740, 844]]);
        } else {
          draw(6.5, [512, 875], [
            [445, 773, 297, 720, 267, 568],
            [246, 472, 283, 376, 374, 328],
            [453, 285, 571, 285, 650, 328],
            [741, 376, 778, 472, 757, 568],
            [727, 720, 579, 773, 512, 875],
          ], true);
          draw(2.8, [497, 888], [
            [422, 787, 279, 739, 250, 574],
            [226, 466, 267, 359, 365, 310],
            [450, 263, 574, 263, 659, 310],
            [757, 359, 798, 466, 774, 574],
            [745, 739, 602, 787, 527, 888],
          ]);
          draw(4.8, [512, 96], [[512, 280]]);
          draw(4.8, [512, 306], [[512, 865]]);
          draw(4.8, [346, 349], [[359, 484, 382, 629, 404, 739]]);
          draw(4.8, [678, 349], [[665, 484, 642, 629, 620, 739]]);
        }
        return canvas.toDataURL('image/png').split(',')[1];
      }, { id: variant.id, structuredScuba, highNeckScuba });
      let source = sharp(Buffer.from(png, 'base64')).greyscale();
      if (structuredScuba) source = source.resize(2048, 2048).threshold(128);
      await source.png().toFile(`${directory}/source.png`);
      fs.writeFileSync(`${directory}/provenance.json`, JSON.stringify({
        reference: highNeckScuba
          ? 'Uploaded pale zip hoodie informs only upright volume, recessed face opening and high-neck construction. Original symmetric Canvas drawing; no reference pixels, silhouette, folds, branding or seam layout traced. Regular Hood supplies line-quality and attachment benchmarks only.'
          : structuredScuba
          ? 'User-supplied blue Scuba hoodie illustration is the requested shape reference: rounded dome, oval recessed opening, lining seams and a curved high collar flowing into the shoulders. Canvas raster construction followed by Potrace; no hand-authored SVG paths. Regular Hood is the line-quality benchmark.'
          : 'Existing Regular Hood raster construction style; no previous variant geometry reused.',
        sourceSha256: hash(fs.readFileSync(`${directory}/source.png`)),
        method: structuredScuba
          ? 'Original 4096px Canvas drawing downsampled to binary 2048px raster; recessed curved opening, raised chin collar and shaped crown panels; Potrace-only SVG geometry with source-sized viewBox.'
          : '4096px Canvas raster with shared primary/secondary/seam line hierarchy, arched opening, center and lining panel seams; Potrace-only SVG geometry.',
        reusedRejectedGeometry: false,
      }, null, 2) + '\n');
    }
  } finally {
    await browser.close();
  }
  await rebuildHoods(only, options);
}
await validateRebuiltHoods(process.argv.includes('--live'), options);