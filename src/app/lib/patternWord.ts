import type { DesignElement } from '../components/builder/PrintStudioEditor';
import { mapShapePath } from './artworkPathOperations';
import { outlineLettering } from './editableLettering';
import { shapePathData, type ShapePath } from './shapeGeometry';
import type { PatternWord } from './patternsPro';

export const WORD_FONTS = ['League Gothic', 'Anton', 'Staatliches', 'Antonio', 'League Spartan', 'Kanit', 'Russo One', 'Squada One', 'Righteous', 'Audiowide', 'Orbitron', 'Bevan', 'Ultra', 'Bodoni Moda', 'Zilla Slab', 'Special Elite', 'JetBrains Mono', 'Fredoka', 'Baloo 2', 'Pacifico'];

/** Turn a word into real vector outlines, so the repeat prints sharp without needing the font. */
export async function patternWordOutline(text: string, font: string, imports: { family: string; dataUrl: string }[] = []): Promise<PatternWord> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!clean) throw new Error('Type a word to repeat.');
  const source = { id: 'pattern-word', type: 'text', content: clean, fontFamily: font, fontSize: 100, fontWeight: 'normal', x: 0, y: 0, width: Math.max(600, clean.length * 130), height: 180, rotation: 0, textAlign: 'left' } as DesignElement;
  const patch = await outlineLettering(source, imports), path = patch.shapePath as ShapePath | undefined, width = patch.width ?? source.width, height = patch.height ?? source.height;
  if (!path?.nodes.length) throw new Error('This font could not be outlined. Choose another.');
  const scaled = mapShapePath(path, p => ({ x: p.x * width / 100, y: p.y * height / 100 })), points = [scaled, ...(scaled.subpaths ?? [])].flatMap(part => part.nodes), left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y)), right = Math.max(...points.map(p => p.x)), bottom = Math.max(...points.map(p => p.y));
  const placed = mapShapePath(scaled, p => ({ x: p.x - left, y: p.y - top }));
  return { text: clean, font, d: shapePathData(placed), width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
