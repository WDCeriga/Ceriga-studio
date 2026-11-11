import assert from 'node:assert/strict';import {build}from'esbuild';import{pathToFileURL}from'node:url';
await build({stdin:{contents:"export * from './src/app/lib/artworkResize';export * from './src/app/lib/labelResize';export * from './src/app/lib/rebaseSurfaceDocument';",resolveDir:process.cwd()},outfile:'node_modules/.cache/resize-tests.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});const api=await import(pathToFileURL(process.cwd()+'/node_modules/.cache/resize-tests.mjs'));
const close=(a,b)=>assert.ok(Math.abs(a-b)<.01,`${a} != ${b}`);
const start={id:'x',type:'shape',content:'rect',x:100,y:100,width:100,height:80,rotation:0},visibleBounds={x:.2,y:.1,width:.5,height:.6};
const next={...start,...api.resizeArtwork(start,'se',{x:25,y:24},{fromCenter:false,constrain:false,visibleBounds})};
close(next.x-next.width/2+next.width*.2,start.x-start.width/2+start.width*.2);close(next.y-next.height/2+next.height*.1,start.y-start.height/2+start.height*.1);
close(next.x-next.width/2+next.width*.7,start.x-start.width/2+start.width*.7+25);close(next.y-next.height/2+next.height*.7,start.y-start.height/2+start.height*.7+24);
for(const yFactor of [1,.5,.65]){const result=api.resizeLabelDimensions({width:50,height:25},{x:10,y:5},(w,h)=>({x:w/2,y:h*yFactor}));close(result.width,70);assert.ok(Math.abs(result.height-(25+5/yFactor))<=.051)}
const section={...start,id:'section',surfaceRole:'frame',frameId:'section',x:25,y:12.5,width:50,height:8},saved={surface:{width:50,height:25},document:{elements:[section],frames:[{id:'section',x:0,y:8.5,width:50,height:8}],scene:[],revision:2}},fresh={surface:{width:75,height:50},document:{elements:[],frames:[],scene:[]}},snapshot=JSON.stringify(saved),rebased=api.rebaseSurfaceArtwork(saved,fresh);
const e=rebased.document.elements[0];close(e.x-e.width/2,0);close(e.width,75);close(e.y/50,12.5/25);close(e.height/50,8/25);close(rebased.document.frames[0].width,75);assert.equal(JSON.stringify(saved),snapshot);
console.log('Resize geometry: visible handles follow the pointer, opposite anchors stay fixed, attachment offsets are solved, and colour sections retain normalized position and edge coverage.');
