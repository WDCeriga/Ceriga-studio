import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '../../ui/select';
import './builder-select.css';

/** Shared, keyboard-accessible menu; its portal carries the Builder theme. */
export function BuilderSelect({label,value,options,onChange}:{label:string;value:string;options:readonly {value:string;label:string}[];onChange:(value:string)=>void}){
 return <Select value={value} onValueChange={onChange}>
  <SelectTrigger aria-label={label} className="builder-select-trigger"><SelectValue/></SelectTrigger>
  <SelectContent className="builder-select-menu" position="popper">
   {options.map(option=><SelectItem className="builder-select-option" key={option.value} value={option.value}>{option.label}</SelectItem>)}
  </SelectContent>
 </Select>;
}
