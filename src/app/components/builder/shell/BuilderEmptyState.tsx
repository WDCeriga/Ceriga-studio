import {Layers, type LucideIcon} from 'lucide-react';

export function BuilderEmptyState({title,description,icon:Icon=Layers}:{title:string;description:string;icon?:LucideIcon}) {
  return <div className="builder-empty-state"><Icon size={24} strokeWidth={1.3} aria-hidden="true"/><strong>{title}</strong><p>{description}</p></div>;
}
