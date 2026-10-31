import React,{Component,Profiler,useEffect,useState,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {LegacyLabelArtwork} from '../../src/app/components/builder/LabelArtwork';
import {createGarmentLabel} from '../../src/app/data/garmentLabels';
const label=createGarmentLabel('neck');
let commits=0;
class Boundary extends Component<{children:ReactNode},{error:boolean}>{
 state={error:false};static getDerivedStateFromError(){return{error:true}};
 render(){return this.state.error?<p role="status">FAIL · label keeps rendering after fonts settle</p>:this.props.children}
}
function Check(){
 const [done,setDone]=useState(false);
 useEffect(()=>{let active=true;void document.fonts.ready.then(()=>setTimeout(()=>{if(active)setDone(true)},1200));return()=>{active=false}},[]);
 return <><p role="status">{done?'PASS · linked label colours settle without a font/render loop':'Checking label fonts…'}</p><Profiler id="label" onRender={()=>{if(++commits>30)throw new Error('Label render loop')}}><svg viewBox="0 0 50 25" style={{width:600,height:300}}><LegacyLabelArtwork label={label}/></svg></Profiler></>;
}
createRoot(document.getElementById('root')!).render(<Boundary><Check/></Boundary>);
