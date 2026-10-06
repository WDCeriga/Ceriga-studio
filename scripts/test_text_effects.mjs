import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const built = await build({ entryPoints:['src/app/lib/textEffects.ts'], bundle:true, write:false, platform:'node',format:'esm' });
const { TEXT_EFFECTS, createTextEffect, textEffectControls, applyTextEffects } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const width=160,height=120;
const source=new Uint8ClampedArray(width*height*4);
for(let y=20;y<100;y++)for(let x=24;x<136;x++){
  if((x<50||x>109||y>48&&y<70) && !(x>117&&y>30&&y<42)){
    const i=(y*width+x)*4;source[i]=60+x;source[i+1]=70+y;source[i+2]=130;source[i+3]=x%13===0?128:255;
  }
}
const texture=new Uint8ClampedArray(32*24*4);
for(let y=0;y<24;y++)for(let x=0;x<32;x++){
  const i=(y*32+x)*4;texture[i]=x*8;texture[i+1]=y*10;texture[i+2]=(x+y)%2?230:50;texture[i+3]=x<4?0:255;
}
const assets={photo:{data:texture,width:32,height:24}};
const effect=type=>({...createTextEffect(type),seed:17,source:['image-fill','texture-fill'].includes(type)?'photo':undefined});
const apply=effects=>applyTextEffects(source,width,height,effects,assets);
const distinct=(a,b)=>a.some((value,i)=>value!==b[i]);

test('Catalog exposes 34 immutable, deterministic and distinct treatments',()=>{
  assert.equal(TEXT_EFFECTS.length,34);
  const snapshot=source.slice(),outputs=[];
  for(const {id} of TEXT_EFFECTS){
    const fx=effect(id);const a=apply([fx]),b=apply([fx]);
    assert.deepEqual(a,b,id);assert(distinct(a,source),`${id} changes pixels`);
    assert.deepEqual(source,snapshot,'Source remains editable and immutable');
    outputs.push(Buffer.from(a).toString('base64'));
  }
  assert.equal(new Set(outputs).size,34);
});

test('All declared controls are usable and affect rendering',()=>{
  for(const {id} of TEXT_EFFECTS){
    const fx=effect(id);
    for(const control of textEffectControls(id)){
      let low,high;
      if(control.type==='range'){low=control.min;high=['angle','direction','rotation','offsetX','offsetY'].includes(control.key)?control.max*.37:control.max;assert(control.default>=control.min&&control.default<=control.max,id);}
      else if(control.type==='color'){low='#ff0011';high='#00ffff';}
      else{low=control.options[0].value;high=control.options.at(-1).value;}
      const a=apply([{...fx,settings:{...fx.settings,[control.key]:low}}]);
      const b=apply([{...fx,settings:{...fx.settings,[control.key]:high}}]);
      if(id==='offset-print'&&control.key==='tertiaryColor'){
        const a3=apply([{...fx,settings:{...fx.settings,tertiaryAmount:100,tertiaryColor:low}}]);
        const b3=apply([{...fx,settings:{...fx.settings,tertiaryAmount:100,tertiaryColor:high}}]);
        assert(distinct(a3,b3),'Additional ink colour changes active ink');
      }else assert(distinct(a,b),`${id}.${control.key} must change pixels`);
    }
  }
});

test('Intensity and visibility preserve exact originals and intermediate premultiplied alpha',()=>{
  for(const {id} of TEXT_EFFECTS){
    const fx=effect(id),full=apply([fx]);
    assert.deepEqual(apply([{...fx,intensity:0}]),source,id);
    assert.deepEqual(apply([{...fx,enabled:false}]),source,id);
    const half=apply([{...fx,intensity:50}]);
    assert(distinct(half,full)&&distinct(half,source),`${id} blends continuously`);
    for(let i=3;i<full.length;i+=4)assert(Math.abs(half[i]-(full[i]+source[i])/2)<=1,`${id} alpha blend`);
  }
});

test('Stack order, random seeds and serialization stay non-destructive',()=>{
  const chrome=effect('chrome'),distress=effect('distressed'),extrude=effect('extrude');
  assert(distinct(apply([chrome,distress,extrude]),apply([extrude,chrome,distress])));
  for(const id of ['distressed','cracked','faded','glitch'])assert(distinct(apply([effect(id)]),apply([{...effect(id),seed:2222}])),id);
  const stack=[chrome,distress,extrude,effect('image-fill')];
  assert.deepEqual(apply(stack),apply(JSON.parse(JSON.stringify(stack))));
});

test('Cuts and fills are clipped to glyph alpha and relief follows glyph geometry',()=>{
  for(const type of ['cracked','halftone','image-fill','texture-fill','gradient','chrome','bevel','inner-shadow','embroidery']){
    const output=apply([effect(type)]);
    for(let i=3;i<source.length;i+=4)assert(output[i]<=source[i],`${type} cannot fill outside glyphs`);
  }
  const cracked=apply([effect('cracked')]);
  assert(cracked.some((value,i)=>i%4===3&&source[i]>0&&value<source[i]),'Cracks remove coverage');
  const stitch=effect('embroidery');
  assert(distinct(apply([{...stitch,settings:{...stitch.settings,direction:0}}]),apply([{...stitch,settings:{...stitch.settings,direction:90}}])));
  const puff=apply([effect('puff-print')]);
  assert(distinct(puff,source));
  assert(new Set([...puff].filter((_,i)=>i%4===0)).size>30,'Relief is not a flat font weight change');
});

test('Gradients support multistops and three projections; input validation is bounded',()=>{
  const gradient=effect('gradient');
  const stops=[{color:'#ff0000',position:0},{color:'#00ff00',position:45},{color:'#0000ff',position:100}];
  const outputs=['linear','radial','conic'].map(type=>apply([{...gradient,stops,settings:{...gradient.settings,type}}]));
  assert(outputs.every((output,i)=>i===0||distinct(output,outputs[i-1])));
  assert.throws(()=>applyTextEffects(new Uint8ClampedArray(4),2,2,[]),RangeError);
  assert.deepEqual(applyTextEffects(new Uint8ClampedArray(),0,0,[]),new Uint8ClampedArray());
});
