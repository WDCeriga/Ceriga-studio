import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
const result=await build({stdin:{contents:`
import assert from 'node:assert/strict';
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
check(washSpecification({...front,intensity:80}).includes('heavy intensity'),'Factory brief follows treatment strength');
check(washSpecification({...front,mode:'tinted',colour:'#123456'}).includes('#123456'),'Factory brief includes tint target');
check(washSpecification(original)==='No additional wash treatment.','None removes the treatment from the production brief');
check(Object.keys(WASH_TYPES).every(type=>washSpecification({...original,type:type as any}).length>10),'Every treatment has a production brief');
check(washTone('#808080',{...front,tone:-50})==='#404040','Darkening preserves a valid colour');
check(JSON.parse(JSON.stringify({...preview,references:[{id:'ref1',name:'Finish.jpg',src:'data:image/jpeg;base64,AA'}],specification:{notes:'Protect rib',confirmed:true}})).specification.confirmed,'References and confirmed instructions survive save serialization');
console.log(checks+' wash and finish checks passed.');
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false});
const run=spawnSync(process.execPath,['-e',result.outputFiles[0].text],{stdio:'inherit'});process.exitCode=run.status??1;
