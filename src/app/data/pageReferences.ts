export type PageReferenceFile={id:string;name:string;src?:string;type?:string};
export type PageReferences={title:string;files:PageReferenceFile[];notes:string;specification:string;confirmed?:boolean};
export type PageReferenceStore=Record<string,PageReferences>;
export function referencePageKey(section:string,tool?:string):string{return tool?`${section}:${tool}`:section}
export function updatePageReferences(store:PageReferenceStore|undefined,key:string,entry:PageReferences):PageReferenceStore{return {...store,[key]:entry}}
