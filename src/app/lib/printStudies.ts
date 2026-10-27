import {REFERENCE_PRINT_STUDIES,buildReferencePrintStudy} from './referencePrintStudies';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {getDefaultGarmentSelection,getGarmentAssetsForFit} from '../data/garmentSvgCatalog';
import {createTextEffect} from './textEffects';
import {textileInkEffect} from './textileInk';
import {initialPatternSettings} from './patternEditing';
import {defaultOrderQuantityPlan} from '../data/orderQuantities';
import tiger from '../../assets/artwork-studies/tiger-source.png';
import leftScript from '../../assets/artwork-studies/sleeve-left-source.png';
import rightScript from '../../assets/artwork-studies/sleeve-right-source.png';
import badge from '../../assets/artwork-studies/badge-lettering-source.png';
export const PRINT_STUDIES=[
 ...REFERENCE_PRINT_STUDIES,
 {id:'tiger-varsity',name:'01 / Striped varsity',summary:'Arched outline lettering, tiger ink separation, striped cotton and local abrasion.',base:'#354456',neck:'#eeba14',long:true,fabric:'single-jersey'},
 {id:'plaid-athletic',name:'02 / Plaid athletic',summary:'Worn stencil stack, script overlay and independently coloured plaid sleeves.',base:'#e8e5dd',neck:'#984a4a',long:false,fabric:'single-jersey'},
 {id:'sleeve-script',name:'03 / Sleeve script',summary:'Ribbed black body, woven plaid sleeves, distressed number and extracted sleeve calligraphy.',base:'#151618',neck:'#333638',long:true,fabric:'rib-1x1'},
 {id:'plaid-badge',name:'04 / Plaid badge',summary:'Editable plaid-filled oval, isolated original lettering and contrast cream edging.',base:'#344357',neck:'#344357',long:false,fabric:'french-terry'},
] as const;
const text=(id:string,content:string,x:number,y:number,width:number,size:number,color:string,extra:Partial<DesignElement>={}):DesignElement=>({id,layerName:id,type:'text',content,x,y,width,height:size*1.2,rotation:0,fontSize:size,fontFamily:'Black Ops One',fontWeight:'normal',color,textAlign:'center',autoHeight:true,autoWidth:false,side:'front',opacity:100,printMethod:'Screen Print',...extra});
const image=(id:string,content:string,x:number,y:number,width:number,height:number,extra:Partial<DesignElement>={}):DesignElement=>({id,layerName:id,type:'image',content,x,y,width,height,rotation:0,side:'front',opacity:100,printMethod:'Screen Print',aspectLocked:true,...extra});
function wear(seed:number,amount=25){const e=createTextEffect('distressed');return {...e,seed,settings:{...e.settings,amount,size:2,density:65,roughness:65}}}
const oval=(id:string,x:number,y:number,width:number,height:number,color:string,border=0,stroke=color):DesignElement=>({id,layerName:id,type:'shape',content:'ellipse',shapeGeometry:'bounds',shapeFilled:true,shapeFillColor:color,shapeStrokeColor:stroke,borderWidth:border,x,y,width,height,rotation:0,side:'front',opacity:100,printMethod:'Screen Print'});
function pattern(id:string,kind:string,target:string,colors:string[],count=12):DesignElement{return {id,layerName:id,type:'pattern',content:kind,x:400,y:350,width:700,height:700,rotation:0,side:'front',...initialPatternSettings(kind,colors[0]),patternColors:colors,patternCount:count,patternReferenceSize:700,patternAlignment:'continuous',patternSeed:1729,patternTarget:target,printMethod:'Screen Print'}}
function shoulder(id:string,right:boolean,colors:string[]):DesignElement{return {id,layerName:id,type:'customArea',content:'',customAreaName:'Raglan shoulder colour area',x:right?493:307,y:187,width:105,height:170,rotation:0,side:'front',customAreaViewWidth:105,customAreaViewHeight:170,customAreaPoints:right?[{x:0,y:0},{x:105,y:35},{x:105,y:170}]:[{x:105,y:0},{x:0,y:35},{x:0,y:170}],customAreaPattern:'plaid',patternColors:colors,patternCount:12,patternReferenceSize:700,patternSeed:1729,patternAlignment:'continuous',opacity:100,customAreaOutline:{enabled:true,color:'#555555',width:.6,opacity:55,style:'solid'}}}
export function buildPrintStudy(id:string){
 const reference=buildReferencePrintStudy(id);if(reference)return reference;
 const study=PRINT_STUDIES.find(s=>s.id===id)??PRINT_STUDIES[0];const fit='boxy';
 const selection=getDefaultGarmentSelection('tshirt',fit);
 if(study.long){const long=getGarmentAssetsForFit('tshirt','Sleeve length',fit).find(a=>a.displayName===`Long sleeve (${fit})`);if(long)selection['Sleeve length']=long.id}
 let elements:DesignElement[]=[];const cream='#e7e3d1';
 if(id==='tiger-varsity'){
  elements=[{...pattern('All-over navy stripes','stripes-h','',['#66758a'],12),patternTarget:undefined,patternKeepNeckPlain:true,x:400,y:350,width:720,height:609,patternReferenceSize:274,color:'#66758a',patternThickness:11,opacity:60}];
  elements.push(text('Varsity outline','STLNHRTS',400,281,350,51,cream,{fontFamily:'Graduate',fontWeight:'normal',textCurveAmount:60,textCurveRadius:115,textCurveDirection:'up',textFillMode:'outline',borderWidth:2.3,borderColor:cream,textEffects:[wear(312,14)]}),image('Isolated tiger ink',tiger,400,379,200,100,{imageFilter:{id:'extract-light',threshold:156,softness:30,inkColor:cream,intensity:100}}),oval('Number disc',400,465,69,55,cream),text('Number 21','21',400,465,66,37,'#354456',{fontFamily:'Black Ops One',fontWeight:'normal'}));
  for(const [i,x,y]of [[0,300,170],[1,497,441],[2,319,560]])elements.push({id:'Local abrasion '+i,layerName:'Local abrasion '+i,type:'distress',content:'abrasion',x,y,width:50,height:36,rotation:-25,side:'front',opacity:100,wearDetail:{roughness:70,fray:60,seed:120+i}});
 }else if(id==='plaid-athletic'||id==='sleeve-script'){
  const dark=id==='sleeve-script',colors=dark?['#353a37','#202426','#7b7655','#694749']:['#dad8c8','#264463','#587797','#b6bdad'];
  elements=['sleeveLeft','sleeveRight','sleeveHemLeft','sleeveHemRight',...(dark?['neck']:[])].map(part=>pattern('Plaid / '+part,'plaid',part,colors,dark?12:10));
  elements.push(shoulder('Left shoulder inset',false,colors),shoulder('Right shoulder inset',true,colors));
  if(dark){elements.push(text('Distressed number','83',400,308,230,118,'#bcc0c5',{textEffects:[wear(85,42)]}),image('Left sleeve calligraphy',leftScript,222,400,76,300,{imageFilter:{id:'extract-light',threshold:187,softness:18,backgroundColor:'#ffffff',backgroundTolerance:30,inkColor:'#e6e4d9',intensity:100},rotation:8}),image('Right sleeve calligraphy',rightScript,578,400,76,300,{imageFilter:{id:'extract-light',threshold:187,softness:18,backgroundColor:'#ffffff',backgroundTolerance:30,inkColor:'#e6e4d9',intensity:100},rotation:-8}));}
  else elements.push(text('Arched headline','SEVENTYFOUR',400,278,310,22,'#9c6268',{textCurveAmount:16,textCurveRadius:160,textEffects:[wear(71,34)]}),text('Athletic number','20',400,371,220,120,'#7d8998',{textEffects:[wear(20,33)]}),text('Script overprint','The Team',400,375,220,53,'#656e73',{fontFamily:'Pinyon Script',fontWeight:'normal',rotation:-12,textFillMode:'outline',borderWidth:.7,borderColor:'#656e73'}),text('Worn caption','MADE A PEACE WORLD',400,464,310,16,'#9b6a70',{textEffects:[wear(54,25)]}),text('Establishment','EST.   2000',400,493,130,17,'#313437'));
 }else{
  const fill=textileInkEffect('plaid',['#c5bba5','#8e3b42','#e7e4d4','#67716f'],5);
  elements=[{...oval('Plaid oval fill',400,373,240,103,'#e7e4d4',2.4,cream),shapeEffects:[fill]},image('Cream lettering edge',badge,400,373,232,106,{imageFilter:{id:'extract-dark',threshold:72,softness:10,inkCleanup:75,inkChroma:24,backgroundTolerance:24,backgroundColor:'#344357',inkColor:cream,intensity:100}}),image('Original badge lettering',badge,400,373,229,103,{imageFilter:{id:'extract-dark',threshold:72,softness:10,inkCleanup:75,inkChroma:24,backgroundTolerance:24,backgroundColor:'#344357',inkColor:'#242424',intensity:100}})];
 }
 // Artwork coordinates are relative to the renderer's 5% / 6% inset print zone.
 elements=elements.map(el=>el.patternTarget?el:{...el,x:el.x-40,y:el.y-45.5});
 return {study,state:{productId:'ts-001',garmentType:'tshirt',svgPack:'tshirt',fit,measurementUnit:'cm',measurements:{},colors:[{hex:study.base,pantone:''}],partColors:{neck:study.neck,bodyHem:study.base,sleeveHemLeft:study.base,sleeveHemRight:study.base},fabricAssignments:{assignments:{neck:'rib-1x1',...(['sleeve-script','plaid-athletic'].includes(id)?{sleeveLeft:'cotton-twill',sleeveRight:'cotton-twill'}:{})},unlinkedGroups:[],garmentDefault:study.fabric},fabricTextureIntensity:{garment:75,parts:{}},tshirtAssetSelection:selection,garmentPanels:[],extraDetails:{},prints:[],studioArtwork:elements,labels:[],packaging:[],labelLayerSelectedId:null,packagingLayerSelectedId:null,printsLayerSelectedId:null,detailPositions:{},orderQuantities:defaultOrderQuantityPlan('custom_clothing')}};
}
