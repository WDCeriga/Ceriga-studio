export function MeasurementGuidesToggle({checked,onChange,phone=false}:{checked:boolean;onChange:(value:boolean)=>void;phone?:boolean}){
 return <button type="button" className={'measurement-guides-toggle'+(phone?' measurement-guides-toggle-phone':'')} role="switch" aria-label="Show measurement guides" aria-checked={checked} onClick={()=>onChange(!checked)}><span className="guides-label-desktop">Measurement guides</span><span className="guides-label-phone">Guides</span><span className="guides-switch-track" aria-hidden="true"><span/></span></button>;
}
