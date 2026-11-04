export type PageReferenceFile={id:string;name:string;src?:string;type?:string};
export type SpecificationGroup={id:string;title:string;points:string[];referenceId?:string};
export type PageReferences={title:string;files:PageReferenceFile[];notes:string;specification:string;groups?:SpecificationGroup[];confirmed?:boolean};
export type PageReferenceStore=Record<string,PageReferences>;
export function referencePageKey(section:string,tool?:string):string{return tool?`${section}:${tool}`:section}
export function updatePageReferences(store:PageReferenceStore|undefined,key:string,entry:PageReferences):PageReferenceStore{return {...store,[key]:entry}}
