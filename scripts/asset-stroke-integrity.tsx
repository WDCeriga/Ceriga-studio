import {useState} from 'react';
import {normalizeTechnicalSvg} from '../src/app/lib/technicalDrawing';
const modules=import.meta.glob<string>(['../src/assets/studio-tshirt/**/*.svg','../src/assets/tshirt-necks/*.svg','../src/assets/tshirt-test/**/*.svg','../src/assets/tshirts/**/*.svg','../src/assets/garment-details/**/*.svg'],{query:'?raw',import:'default'});
const attributes=['d','points','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','viewBox','transform','preserveAspectRatio','fill-rule','clip-rule'];
const geometry=(root:Element)=>JSON.stringify([root,...root.querySelectorAll('*')].map(el=>[el.tagName,...attributes.map(name=>el.getAttribute(name))]));
export function AssetStrokeIntegrity(){
 const [result,setResult]=useState(''),[running,setRunning]=useState(false);
 const check=async()=>{setRunning(true);let passed=0;const failures:string[]=[];const files=Object.entries(modules).filter(([name])=>!name.includes('/_diag/')&&!name.includes('/fit-thumbnails/'));
  for(let start=0;start<files.length;start+=12){const batch=files.slice(start,start+12);await Promise.all(batch.map(async([name,load])=>{try{const raw=await load(),before=new DOMParser().parseFromString(raw,'image/svg+xml'),after=new DOMParser().parseFromString(normalizeTechnicalSvg(raw,1,'outline',true),'image/svg+xml');if(before.querySelector('parsererror')||after.querySelector('parsererror')||geometry(before.documentElement)!==geometry(after.documentElement))failures.push(name);else passed++;}catch{failures.push(name)}}));setResult(`${passed}/${files.length} assets preserve geometry${failures.length?' · '+failures.length+' failures':''}`);}
  setResult(failures.length?`FAILED: ${failures.join(', ')}`:`PASS: all ${passed} garment/detail SVG assets preserve original geometry`);setRunning(false);
 };
 return <><button disabled={running} onClick={check}>{running?'Checking assets…':'Check all assets'}</button><span role="status">{result}</span></>;
}
