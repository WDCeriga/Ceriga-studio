import assert from 'node:assert/strict';
import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export {renderedMarqueeArtworkIds} from './src/app/lib/artworkMarquee';`);
const element={id:'shape',type:'shape',side:'front',x:100,y:100,width:200,height:200};
const bounds={getBoundingClientRect:()=>({left:60,top:60,right:140,bottom:140,width:80,height:80})};
const zone={clientWidth:200,clientHeight:200,getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),querySelectorAll:()=>[{dataset:{printId:'shape'},querySelector:()=>bounds}]};
assert.deepEqual(api.renderedMarqueeArtworkIds([element],'front',{x:150,y:150,width:30,height:30},zone),[]);
assert.deepEqual(api.renderedMarqueeArtworkIds([element],'front',{x:130,y:130,width:30,height:30},zone),['shape']);
console.log('PASS: transparent source padding does not trigger marquee selection; visible bounds do.');
