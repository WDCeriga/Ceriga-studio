import { createContext } from 'react';

/** Defer high-resolution captures while the pointer is transforming artwork. */
export const ArtworkInteractionContext = createContext(false);
