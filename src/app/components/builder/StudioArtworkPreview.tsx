import type { ReactNode } from 'react';
import { PrintsDesignPreview, type DesignElement } from './PrintStudioEditor';

/** Uses the same renderer as the editor, retaining effects, paths and groups. */
export function StudioArtworkPreview({elements,view='front',garment}:{elements:DesignElement[];view?:'front'|'back';garment:ReactNode}) {
  if (!elements.length) return <>{garment}</>;
  return <PrintsDesignPreview elements={elements} garmentSide={view} garmentPreview={garment} canvasSize={{width:800,height:700}} editable={false} canvasToolbar={false} className="h-full w-full min-h-0"/>;
}
