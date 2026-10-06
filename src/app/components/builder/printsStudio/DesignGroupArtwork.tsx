import { composeArtworkFilter, ImageFxDefs, type DesignElement } from '../PrintsDesignStep';
import { imageAdjustmentFilter } from '../../../lib/imageAdjustments';
import { artworkFlipStyle } from '../../../lib/artworkFlip';
import { paintCss } from '../../../lib/studioPaint';
import { DesignAssetSurface } from './DesignAssetSurface';
import { CustomAreaGraphic } from './CustomAreaGraphic';
import { ImageAdjustmentDefs } from './ImageAdjustmentDefs';
import { StudioGraphic } from './StudioGraphic';
import { TextArtwork } from './TextArtwork';
import { FilteredImage } from './FilteredImage';

const ignore = () => {};

/** Keeps child artwork in its original coordinate system; only the envelope scales. */
export function DesignGroupArtwork({ element }: { element: DesignElement }) {
  const width = element.groupSourceWidth ?? element.width;
  const height = element.groupSourceHeight ?? element.height;
  return <div className="relative h-full w-full" style={{ filter: imageAdjustmentFilter(element), ...artworkFlipStyle(element) }}>
    <div data-group-source style={{ position: 'absolute', width, height, transformOrigin: '0 0', transform: `scale(${element.width / width}, ${element.height / height})` }}>
      {(element.children ?? []).filter(child => !child.hidden).map(child => <div key={child.id} data-group-child={child.id}
        style={{ position: 'absolute', left: child.x, top: child.y, width: child.width,
          height: child.type === 'text' && child.autoHeight !== false ? undefined : child.height,
          opacity: (child.opacity ?? 100) / 100, transform: `translate(-50%, -50%) rotate(${child.rotation}deg)` }}>
        <ImageFxDefs element={child} />
        <ImageAdjustmentDefs element={child} />
        <DesignAssetSurface element={child} selected={false} scale={1} onChange={ignore} overlay={null}>
          {child.type === 'group' ? <DesignGroupArtwork element={child} />
            : child.type === 'text' ? <TextArtwork element={child} fontSize={child.fontSize ?? 30} />
              : child.type === 'customArea' ? <CustomAreaGraphic element={child} points={child.customAreaPoints ?? []} selectedPoint={null} editing={false} onSelectPoint={ignore} onPointPointerDown={ignore} />
                : child.type === 'shape' || child.type === 'pattern' || (child.type === 'distress' && !child.content.startsWith('data:'))
                  ? <div className={`h-full w-full ${child.type === 'shape' ? '' : 'overflow-hidden'}`}><StudioGraphic element={child} /></div>
                  : <div className="relative h-full w-full" style={{ filter: composeArtworkFilter(child) }}>
                    <FilteredImage source={child.content} settings={child.type === 'image' ? child.imageFilter : undefined} alt="Grouped artwork" className="h-full w-full object-fill" style={{ ...artworkFlipStyle(child), opacity: child.color ? 0 : undefined }} />
                    {child.color && <div className="pointer-events-none absolute inset-0" style={{ background: paintCss(child.color), maskImage: `url("${child.content}")`, maskSize: '100% 100%', maskRepeat: 'no-repeat', ...artworkFlipStyle(child) }} />}
                  </div>}
        </DesignAssetSurface>
      </div>)}
    </div>
  </div>;
}
