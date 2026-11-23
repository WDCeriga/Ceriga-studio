import { useContext } from 'react';
import { ArtworkSurfaceContext } from '../../printsStudio/ArtworkSurfaceContext';
import { useAssetWorkspaceContext } from '../../printsStudio/AssetWorkspace';
import { INK_DARK, readableInk } from '../geometry/colour';
import { useArtworkScene } from './scene';

/**
 * The ink a new object (text, shape, drawn shape) starts with.
 * The untouched default ink is swapped for whichever ink reads on what it is drawn over:
 * the Asset Studio canvas, or otherwise the garment colour. A colour the user picked is always kept.
 * Label / packaging surfaces keep their own ink.
 */
export function useNewObjectInk(studioColour: string): string {
  const scene = useArtworkScene();
  const surface = useContext(ArtworkSurfaceContext);
  const project = useAssetWorkspaceContext()?.project;
  if (surface || studioColour.toUpperCase() !== INK_DARK) return studioColour;
  return readableInk(studioColour, project ? project.background ?? '#ffffff' : scene.surfaceColour);
}
