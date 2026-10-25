import type {ReactNode} from 'react';
import './inspector-heading.css';
/** Shared chrome heading; document and garment typography remain independent. */
export function InspectorHeading({eyebrow,title,description,leading,className=''}:{eyebrow?:ReactNode;title:ReactNode;description?:ReactNode;leading?:ReactNode;className?:string}){
 return <header className={`materials-heading builder-inspector-heading ${className}`} data-has-leading={Boolean(leading)}>{leading}{eyebrow&&<span className="builder-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description&&<p>{description}</p>}</header>;
}
