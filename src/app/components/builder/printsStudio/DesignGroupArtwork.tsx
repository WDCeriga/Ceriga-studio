import {artworkClipStyle} from '../../../lib/artworkClipping';
import {memo,useContext,useRef,useEffect} from 'react';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
import {DrawingArtwork} from './DrawingArtwork';
import { composeArtworkFilter, ImageFxDefs, type DesignElement } from '../PrintStudioEditor';
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
export const DesignGroupArtwork=memo(function DesignGroupArtwork({ element }: { element: DesignElement }) {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!element.logoTrace?.completedAt||!host.current)return;const animations:Animation[]=[],restores:(()=>void)[]=[];if(matchMedia('(prefers-reduced-motion: reduce)').matches){animations.push(host.current.animate([{opacity:0},{opacity:1}],{duration:100}));}else{for(const path of host.current.querySelectorAll<SVGPathElement>('[data-editable-ink]')){let length=0;try{length=path.getTotalLength()}catch{}if(!length)continue;const original=path.getAttribute('style'),colour=path.getAttribute('fill')??'#262626';if(path.getAttribute('stroke')==='none'||!path.getAttribute('stroke')){path.style.stroke=colour;path.style.strokeWidth='1px';}restores.push(()=>{if(original===null)path.removeAttribute('style');else path.setAttribute('style',original)});animations.push(path.animate([{strokeDasharray:String(length),strokeDashoffset:length,fillOpacity:0},{strokeDasharray:String(length),strokeDashoffset:0,fillOpacity:0,offset:.75},{strokeDasharray:String(length),strokeDashoffset:0,fillOpacity:1}],{duration:800,easing:'ease-out'}));}}void Promise.allSettled(animations.map(a=>a.finished)).then(()=>restores.forEach(restore=>restore()));return()=>{animations.forEach(animation=>animation.cancel());restores.forEach(restore=>restore())}},[element.logoTrace?.completedAt]);
  const width = element.groupSourceWidth ?? element.width;
  const height = element.groupSourceHeight ?? element.height;
  const displayScale=useContext(ArtworkResolutionContext)*Math.max(element.width/Math.max(1,width),element.height/Math.max(1,height));
  if(element.logoTrace?.showSource)return <img src={element.logoTrace.source} alt="Original logo" className="h-full w-full object-fill"/>;
  return <div ref={host} className="relative h-full w-full" style={{ filter: imageAdjustmentFilter(element), ...artworkFlipStyle(element) }}>
    <div data-group-source style={{ position: 'absolute', width, height, transformOrigin: '0 0', transform: `scale(${element.width / width}, ${element.height / height})` }}>
      {(element.children ?? []).filter(child => !child.hidden).map(child => <div key={child.id} data-group-child={child.id}
        style={{ position: 'absolute', left: child.x, top: child.y, width: child.width,
          height: child.type === 'text' && child.autoHeight !== false ? undefined : child.height,
          opacity: (child.opacity ?? 100) / 100, transform: `translate(-50%, -50%) rotate(${child.rotation}deg)` }}>
        <ImageFxDefs element={child} />
        <ImageAdjustmentDefs element={child} />
        <DesignAssetSurface clipStyle={artworkClipStyle(child,element.children??[])} element={child} selected={false} scale={displayScale} onChange={ignore} overlay={null}>
          {child.type === 'group' ? <DesignGroupArtwork element={child} />
            : child.type === 'text' ? <TextArtwork element={child} fontSize={child.fontSize ?? 30} />
              : child.type === 'customArea' ? <CustomAreaGraphic element={child} points={child.customAreaPoints ?? []} selectedPoint={null} editing={false} onSelectPoint={ignore} onPointPointerDown={ignore} />
                : child.type==='drawing'&&child.drawing?<DrawingArtwork element={child}/>:child.type === 'shape' || child.type === 'pattern' || child.type === 'distress'
                  ? <div className={`h-full w-full ${child.type === 'shape' ? '' : 'overflow-hidden'}`}><StudioGraphic element={child} /></div>
                  : <div className="relative h-full w-full" style={{ filter: composeArtworkFilter(child) }}>
                    <FilteredImage source={child.content} settings={child.type === 'image' ? child.imageFilter : undefined} alt="Grouped artwork" className="h-full w-full object-fill" style={{ ...artworkFlipStyle(child), opacity: child.color && !child.imageFilter ? 0 : undefined }} />
                    {child.color && !child.imageFilter && <div className="pointer-events-none absolute inset-0" style={{ background: paintCss(child.color), maskImage: `url("${child.content}")`, maskSize: '100% 100%', maskRepeat: 'no-repeat', ...artworkFlipStyle(child) }} />}
                  </div>}
        </DesignAssetSurface>
      </div>)}
    </div>
  </div>;
});
