let activeFactoryId:string|null=null;
export const getActiveFactoryCacheId=()=>activeFactoryId;
export function setActiveFactoryCacheId(id:string|null){activeFactoryId=id;}
