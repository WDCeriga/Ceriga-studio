import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {ShapePath} from './shapeGeometry';
export type SurfaceKind='garmentPlacement'|'label'|'tagFace'|'packagingPanel';
export type SurfaceUnits='mm'|'cm';
export type Matrix=[number,number,number,number,number,number];
export interface Surface {id:string;kind:SurfaceKind;units:SurfaceUnits;width:number;height:number;outline:ShapePath;clip:boolean;background:string;safeInset:number;bleed:number}
export interface SurfaceFrame {id:string;name:string;x:number;y:number;width:number;height:number;padding:number;fill:string;clip:boolean;layout:'stacked'|'free';artworks:string[];sourceKey?:string}
export interface SvgSceneNode {tag:string;attrs:Record<string,string>;children?:SvgSceneNode[];text?:string;artworkId?:string}
/** SVG precision data preserves legacy baselines/clip coordinates, never a bitmap of text. */
export interface SvgPrecision {node:SvgSceneNode;parents:SvgSceneNode[];matrix:Matrix;definitions:string;base:Partial<DesignElement>;owner?:string}
export interface ArtworkDocument {schemaVersion:2;id:string;surfaceId:string;elements:DesignElement[];frames:SurfaceFrame[];scene:SvgSceneNode[];definitions:string;sourceFingerprint:string;revision:number;readOnly?:boolean;deletedSourceKeys?:string[]}
export interface SurfaceArtwork {surface:Surface;document:ArtworkDocument}
export const IDENTITY:Matrix=[1,0,0,1,0,0];
export function multiply(a:Matrix,b:Matrix):Matrix{return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
export function inverse(m:Matrix):Matrix{const d=m[0]*m[3]-m[1]*m[2];if(Math.abs(d)<1e-12)throw new Error('Singular surface transform');return[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d]}
export function transformPoint(m:Matrix,p:{x:number;y:number}){return{x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}}
export function svgTransform(value=''):Matrix{let m=[...IDENTITY] as Matrix;for(const token of value.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g)){const n=token[2].trim().split(/[ ,]+/).filter(Boolean).map(Number);let t=[...IDENTITY] as Matrix;const a=(n[0]??0)*Math.PI/180;if(token[1]==='matrix')t=n as Matrix;else if(token[1]==='translate')t=[1,0,0,1,n[0]??0,n[1]??0];else if(token[1]==='scale')t=[n[0],0,0,n[1]??n[0],0,0];else if(token[1]==='rotate'){t=[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];if(n.length>1)t=multiply(multiply([1,0,0,1,n[1],n[2]],t),[1,0,0,1,-n[1],-n[2]])}else if(token[1]==='skewX')t=[1,0,Math.tan(a),1,0,0];else if(token[1]==='skewY')t=[1,Math.tan(a),0,1,0,0];m=multiply(m,t)}return m}
export function surfaceFingerprint(value:unknown){const text=JSON.stringify(value);let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return(hash>>>0).toString(16)}
export function assertSurfaceDocument(surface:Surface,document:ArtworkDocument){if(document.schemaVersion!==2||document.surfaceId!==surface.id)throw new Error('Artwork document belongs to a different surface');if(!Number.isFinite(surface.width)||!Number.isFinite(surface.height)||surface.width<=0||surface.height<=0)throw new Error('Invalid surface dimensions');const ids=new Set<string>();for(const el of document.elements){if(ids.has(el.id))throw new Error('Duplicate surface artwork id');ids.add(el.id)}}
