import {GarmentArtworkCameraLayer} from '../../src/app/components/builder/printsStudio/GarmentArtworkCameraLayer';
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useGarmentArtworkCamera} from '../../src/app/components/builder/printsStudio/useGarmentArtworkCamera';

/** Exercises the observer lifecycle, rather than only testing camera matrix arithmetic. */
function CameraCheck(){
 const [zone,setZone]=useState<HTMLDivElement|null>(null),[phase,setPhase]=useState('base'),[status,setStatus]=useState('Checking…');
 const transform=useGarmentArtworkCamera(zone,false);
 useEffect(()=>{let cancelled=false;
  const run=async()=>{
   await new Promise(resolve=>setTimeout(resolve,750));
   let baseline:{x:number;y:number;width:number}|undefined;
   for(const step of ['base','near','base','near','base','remount','scaled','missing','base']){
    if(cancelled)return;setPhase(step);
    const until=performance.now()+550;
    while(performance.now()<until){
     await new Promise(requestAnimationFrame);if(cancelled)return;
     const camera=document.querySelector<HTMLElement>('[data-garment-camera]'),art=document.querySelector<HTMLElement>('[data-camera-check-art]');
     if(camera&&art&&baseline){const a=art.getBoundingClientRect(),c=camera.getBoundingClientRect();if(Math.abs((a.x+a.width/2-c.x)/c.width-baseline.x)>.001||Math.abs((a.y+a.height/2-c.y)/c.height-baseline.y)>.001||Math.abs(a.width/c.width-baseline.width)>.001)throw new Error(step+' moved artwork during the transition');}
    }
    if(cancelled)return;
    const currentZone=document.querySelector<HTMLElement>('[data-camera-check-zone]')!,root=currentZone.closest('[data-design-canvas]')!,camera=root.querySelector<HTMLElement>('[data-garment-camera]'),art=currentZone.querySelector<HTMLElement>('[data-camera-check-art]')!;
    if(!camera){if(currentZone.style.transform)throw new Error('Removed camera retained its transform');continue;}
    const a=art.getBoundingClientRect(),c=camera.getBoundingClientRect(),point={x:(a.x+a.width/2-c.x)/c.width,y:(a.y+a.height/2-c.y)/c.height,width:a.width/c.width};
    baseline??=point;
    if(Object.keys(point).some(key=>Math.abs(point[key as keyof typeof point]-baseline![key as keyof typeof point])>.001))throw new Error(step+' moved the artwork: '+JSON.stringify(point));
   }
   if(!cancelled)setStatus('PASS · repeated class-based close-ups, camera replacement, zoom and removal preserve artwork registration');
  };
  void run().catch(error=>{if(!cancelled)setStatus('FAIL · '+error.message)});return()=>{cancelled=true};
 },[]);
 return <main style={{fontFamily:'sans-serif'}}><p role="status">{status}</p><style>{`.camera-check-near{transform:scale(2.4) translate(40px,120px)}`}</style><div data-design-canvas style={{position:'relative',width:800,height:700,transform:phase==='scaled'?'scale(.7)':'none',transformOrigin:'0 0'}}>
  <div data-print-garment-preview style={{position:'absolute',inset:0}}><div data-tshirt-preview key={phase==='remount'?'replacement':'original'} style={{position:'absolute',inset:0}}>{phase!=='missing'&&<div data-garment-camera className={phase==='near'?'camera-check-near':''} data-part-focus={phase==='near'?'neck':'garment'} style={{position:'absolute',left:50,top:0,width:700,height:700,border:'1px solid #777',boxSizing:'border-box',transition:'transform 180ms'}}/>}</div></div>
  <GarmentArtworkCameraLayer zone={zone} enabled insets={{left:5,right:5,top:6,bottom:6}}><div data-camera-check-zone ref={setZone} style={{position:'absolute',left:40,top:42,width:720,height:616,transform,transformOrigin:'0 0'}}><div data-camera-check-art style={{position:'absolute',left:360,top:260,width:100,height:70,background:'#d62a1c',transform:'translate(-50%,-50%)'}}/></div></GarmentArtworkCameraLayer>
 </div></main>;
}
createRoot(document.getElementById('root')!).render(<CameraCheck/>);
