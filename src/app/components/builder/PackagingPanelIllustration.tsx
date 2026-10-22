import type {PackagingPanel} from '../../data/packaging';
/** Face choices keep the selected surface visible instead of drawing through the box. */
export function PackagingPanelIllustration({panel,box}:{panel:PackagingPanel;box:boolean}){
 const ink='#8192a0',plain='#f8f9fa',highlight='#d6e4ed';
 if(!box)return <svg viewBox="0 0 100 76" aria-hidden="true"><path d="M28 8H72V67Q50 70 28 67Z" fill={highlight} stroke={ink}/><path d="M28 15H72M31 18H69" stroke={ink} strokeWidth=".7"/>{panel==='back'?<><path d="M50 19V65M29 60H71" stroke={ink} strokeDasharray="2 2"/><path d="M39 35h22m-17 7h12" stroke={ink}/></>:<path d="M38 32H62V48H38Z" fill="white" stroke={ink} strokeWidth=".8"/>}</svg>;
 const inside=panel.startsWith('interior'),reverse=panel==='back',left=panel==='left';
 return <svg viewBox="0 0 100 76" aria-hidden="true" fill={plain} stroke={ink} strokeWidth="1" strokeLinejoin="round">
 {inside?<>
 {/* Lid is hinged to the rear of the tray. The inside base is a separate inset plane. */}
 <path d="M34 34L40 8L83 18L77 44Z" fill={panel==='interior-lid'?highlight:plain}/>
 <path d="M18 48L36 33L79 44L61 59Z" fill={plain}/>
 <path d="M36 33V43L25 52M36 43L70 52" fill="none"/>
 <path d="M25 49L37 39L72 48L60 58Z" fill={panel==='interior-base'?highlight:plain}/>
 <path d="M18 48L61 59V69L18 58Z M61 59L79 44V54L61 69Z" fill={plain}/>
 </>:<g transform={left?'translate(100 0) scale(-1 1)':undefined}>
 <path data-panel-plane="top" d="M17 28L40 11L84 23L62 41Z" fill={panel==='top'?highlight:plain}/>
 <path data-panel-plane={reverse?'back':'front'} d="M17 28L62 41V66L17 53Z" fill={panel==='front'||reverse?highlight:plain}/>
 <path data-panel-plane={left?'left':'right'} d="M62 41L84 23V48L62 66Z" fill={panel==='right'||left?highlight:plain}/>
 {!reverse&&<path d="M32 45L47 49" strokeWidth=".7"/>}
 {reverse&&<><path d="M39 35V59" strokeWidth=".7"/><path d="M43 60H53" strokeWidth=".7"/></>}
 </g>}
 </svg>;
}
