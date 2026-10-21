import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
const result=await build({stdin:{contents:`
import assert from 'node:assert/strict';
import {washCapabilities,washAvailability,normaliseWashProcess} from './src/app/data/washCapabilities';
import {defaultGarmentWash,updateWashView,washSpecification,washPreview,washTone,WASH_TYPES} from './src/app/data/garmentWash';
let checks=0;function check(ok:boolean,label:string){assert.ok(ok,label);checks++;console.log('PASS '+label)}
const original=defaultGarmentWash();
const front=updateWashView({...original,type:'vintage'},'front',{...original.views.front,placement:'center'});
check(front.views.front.placement==='center'&&!original.views.front.placement,'Front placement updates without mutating saved data');
check(!front.views.back.placement,'Front placement keeps back independent');
const preview={...front,preview:{tone:-50,blend:25,seed:90}};
const effective=washPreview(preview);
check(effective.tone===-50&&effective.blend===25&&effective.seed===90,'Preview overrides affect rendered values');
check(preview.tone===45&&preview.blend===70,'Preview retains production values');
check(washSpecification(preview)===washSpecification(front),'Preview changes stay out of factory specification');
check(washSpecification(front).includes('Front: Center Fade. Back: Full Garment.'),'Factory brief includes each side placement');
check(washSpecification({...front,intensity:80}).includes('heavy appearance'),'Factory brief follows treatment strength');
check(washSpecification({...front,type:'garmentDye',mode:'tinted',colour:'#123456'}).includes('#123456'),'Factory brief includes tint target');
check(washSpecification(original)==='No additional wash treatment.','None removes the treatment from the production brief');
check(Object.keys(WASH_TYPES).every(type=>washSpecification({...original,type:type as any}).length>10),'Every treatment has a production brief');
check(washTone('#808080',{...front,tone:-50})==='#404040','Darkening preserves a valid colour');
check(JSON.parse(JSON.stringify({...preview,references:[{id:'ref1',name:'Finish.jpg',src:'data:image/jpeg;base64,AA'}],specification:{notes:'Protect rib',confirmed:true}})).specification.confirmed,'References and confirmed instructions survive save serialization');

check(!washAvailability('enzyme','100% polyester').available,'Cellulase enzyme wash is unavailable on pure polyester');
check(!washAvailability('enzyme','100% nylon').available,'Cellulase enzyme wash is unavailable on pure nylon');
check(washAvailability('enzyme','80% cotton / 20% polyester').available,'Cellulosic blends remain sample-dependent rather than categorically blocked');
check(washAvailability('enzyme','100% viscose').available,'Cellulosic regenerated fibre is recognised');
check(!washAvailability('enzyme','0% cotton / 100% polyester').available,'Zero-percent cotton does not make synthetic fabric eligible');
check(washAvailability('enzyme','Unknown').available,'Unknown composition is not falsely declared incompatible');
check(washAvailability('acid','95% cotton / 5% elastane').reason.includes('Stretch fibre'),'Stretch/discharge needs factory validation');
check(washAvailability('garmentDye','100% polyester').available,'Specialist dyeing of synthetics is not falsely blocked');
const marked={...front,mode:'bleach' as const,autoWear:true,views:{...front.views,front:{...front.views.front,placement:'custom' as const,strokes:[{id:'s1',points:[{x:.5,y:.5}],size:.1,strength:65,softness:65,erase:false,mirror:false}]}}};
for(const type of ['enzyme','stone','acid','pigment','garmentDye','overdye'] as const){const clean=normaliseWashProcess({...marked,type});check(!washCapabilities(type).local&&clean.views.front.placement==='full'&&clean.views.front.strokes.length===0,type+' excludes arbitrary painted placement');}
check(normaliseWashProcess({...marked,type:'vintage'}).views.front.strokes.length===1,'Local vintage appearance retains its brush reference');
check(marked.views.front.strokes.length===1,'Process normalization does not mutate saved marks');
check(washCapabilities('garmentDye').dye&&!washCapabilities('garmentDye').edgeWear,'Garment dye does not expose fading or wear controls');
check(washTone('#222222',{...original,type:'overdye',colour:'#FFFFFF'})==='#222222','White overdye cannot lighten the existing fabric');
check(washTone('#808080',{...original,type:'overdye',colour:'#808080'})==='#404040','Overdye preview adds colour without bleaching');
check(!washSpecification({...marked,type:'enzyme'}).includes('Custom marks'),'Unsupported saved masks do not leak into factory instructions');
check(!washSpecification({...front,type:'garmentDye'}).includes('visual strength'),'Dyeing is not specified as an arbitrary fading percentage');
console.log(checks+' wash and finish checks passed.');
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false});
const run=spawnSync(process.execPath,['-e',result.outputFiles[0].text],{stdio:'inherit'});process.exitCode=run.status??1;
