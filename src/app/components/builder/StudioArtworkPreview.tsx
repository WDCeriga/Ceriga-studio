import type { ReactNode } from 'react';
import { PrintsDesignPreview, type DesignElement } from './PrintStudioEditor';

/** Uses the same renderer as the editor, retaining effects, paths and groups. */
export function StudioArtworkPreview({elements,view='front',garment,interactive=false}:{elements:DesignElement[];view?:'front'|'back';garment:ReactNode;interactive?:boolean}) {
  if (!elements.length) return <>{garment}</>;
  return <PrintsDesignPreview garmentInteractive={interactive} elements={elements} garmentSide={view} garmentPreview={garment} canvasSize={{width:800,height:700}} editable={false} canvasToolbar={false} className="h-full w-full min-h-0"/>;
}
