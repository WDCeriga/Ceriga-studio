import {useId,type ReactNode} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
export function ArtworkFinishPreview({element,children}:{element:DesignElement;children:ReactNode}){
 const id='finish-'+useId().replace(/[^a-z0-9]/gi,''),finish=element.artworkFinish,units=element.textUnitsPerCm??10;
 if(!finish)return <>{children}</>;
 const raised=['Puff','Flock','Rubber patch','Woven patch','Embroidery'].includes(finish.type),height=finish.type==='Puff'?Math.max(.1,finish.heightMm??.5)*units/10:raised?.35:0;
 return <><svg width="0" height="0" aria-hidden="true" style={{position:'absolute'}}><defs><filter id={id} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
 {finish.colour?<><feFlood floodColor={finish.colour} result="finish-colour"/><feComposite in="finish-colour" in2="SourceAlpha" operator="in" result="ink"/></>:<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="ink"/>}
 {raised?<><feOffset in="SourceAlpha" dx={height*.3} dy={height} result="raised-edge"/><feFlood floodColor="#404040" floodOpacity=".35" result="shade"/><feComposite in="shade" in2="raised-edge" operator="in" result="edge"/><feMerge><feMergeNode in="edge"/><feMergeNode in="ink"/></feMerge></>:finish.type==='Glitter'?<><feTurbulence baseFrequency=".8" numOctaves="1" seed="7" result="flecks"/><feColorMatrix in="flecks" type="saturate" values="0" result="light"/><feComposite in="light" in2="SourceAlpha" operator="in" result="glitter"/><feBlend in="ink" in2="glitter" mode="screen"/></>:finish.type==='Foil'||finish.type==='Reflective'?<feComponentTransfer in="ink"><feFuncR type="gamma" amplitude="1.15" exponent=".85" offset=".02"/><feFuncG type="gamma" amplitude="1.15" exponent=".85" offset=".02"/><feFuncB type="gamma" amplitude="1.15" exponent=".85" offset=".02"/></feComponentTransfer>:null}
 </filter></defs></svg><div className="h-full w-full" data-finish-preview={finish.type} style={{filter:`url(#${id})`}}>{children}</div></>;
}
