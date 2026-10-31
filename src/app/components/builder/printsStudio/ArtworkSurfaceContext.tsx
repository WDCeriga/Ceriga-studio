import {createContext} from 'react';
import type {SurfaceArtwork} from '../../../lib/artworkSurface';
/** Generic cut-edge and frame clipping; garment and asset workspaces use no surface. */
export const ArtworkSurfaceContext=createContext<SurfaceArtwork|null>(null);
