export type PageReferenceFile={id:string;name:string;src?:string;type?:string};
export type SpecificationGroup={id:string;title:string;points:string[];referenceId?:string;references?:{referenceId:string;notes:string}[]};
export type PageReferences={title:string;files:PageReferenceFile[];notes:string;specification:string;groups?:SpecificationGroup[];confirmed?:boolean};
export type PageReferenceStore=Record<string,PageReferences>;
export function referencePageKey(section:string,tool?:string):string{return tool?`${section}:${tool}`:section}
export function updatePageReferences(store:PageReferenceStore|undefined,key:string,entry:PageReferences):PageReferenceStore{return {...store,[key]:entry}}

/** Keep legacy single-image links readable while supporting a note for each upload. */
export function groupReferences(group:SpecificationGroup){return group.references??(group.referenceId?[{referenceId:group.referenceId,notes:''}]:[])}
export function removePageReference(entry:PageReferences,id:string):PageReferences{return {...entry,files:entry.files.filter(file=>file.id!==id),groups:entry.groups?.map(group=>({...group,referenceId:group.referenceId===id?undefined:group.referenceId,references:group.references?.filter(reference=>reference.referenceId!==id)})),confirmed:false}}
