import { useContext } from 'react';
import { ArtworkSurfaceContext } from '../../printsStudio/ArtworkSurfaceContext';
import { INK_DARK, readableInk } from '../geometry/colour';
import { useArtworkScene } from './scene';

/**
 * The ink a new object (text, shape, drawn shape) starts with.
 * On a garment, the untouched default ink is swapped for whichever ink reads on the garment colour;
 * a colour the user picked is always kept. Label / packaging surfaces keep their own ink.
 */
export function useNewObjectInk(studioColour: string): string {
  const scene = useArtworkScene();
  const surface = useContext(ArtworkSurfaceContext);
  if (surface || studioColour.toUpperCase() !== INK_DARK) return studioColour;
  return readableInk(studioColour, scene.surfaceColour);
}
