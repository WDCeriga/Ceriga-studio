export const workerFeatures=[
  {
    "id": "orders",
    "label": "Orders",
    "description": "Operational notes and existing manufacturer/worker assignments.",
    "scoped": true,
    "actions": [
      "view",
      "edit",
      "assign",
      "export"
    ]
  },
  {
    "id": "quality",
    "label": "Quality control",
    "description": "Review existing production submissions; factory self-review is blocked.",
    "scoped": true,
    "actions": [
      "view",
      "edit"
    ]
  },
  {
    "id": "manufacturers",
    "label": "Manufacturers",
    "description": "Operational factory directory; financial and private verification details are excluded.",
    "scoped": true,
    "actions": [
      "view"
    ]
  },
  {
    "id": "manufacturer_teams",
    "label": "Manufacturer teams",
    "description": "View factory staff and manage factory access.",
    "scoped": false,
    "actions": ["view", "edit"]
  },
  {
    "id": "reports",
    "label": "Reports",
    "description": "Order-stage summaries from records you may access.",
    "scoped": true,
    "actions": [
      "view",
      "export"
    ]
  },
  {
    "id": "workers",
    "label": "Workers",
    "description": "View the staff directory or suspend/reactivate authorised workers.",
    "scoped": false,
    "actions": [
      "view",
      "edit"
    ]
  },
  {
    "id": "invitations",
    "label": "Invitations",
    "description": "Send, resend and cancel staff invitations.",
    "scoped": false,
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "id": "roles",
    "label": "Roles & permissions",
    "description": "Maintain role definitions. Assign roles separately.",
    "scoped": false,
    "actions": [
      "view",
      "create",
      "edit",
      "delete",
      "assign"
    ]
  }
] as const;
export type WorkerPermissions=Record<string,'assigned'|'all'>;
/** Keep the editor dependency-safe; the database independently validates the same rules. */
export function changeWorkerPermission(current:WorkerPermissions,authority:WorkerPermissions,key:string,scope:'assigned'|'all'|null):WorkerPermissions{
 const next={...current};
 function add(k:string,s:'assigned'|'all'){if(!authority[k]||(s==='all'&&authority[k]!=='all'))throw new Error('Your role cannot grant the required '+k+' permission.');if(next[k]!=='all')next[k]=s;const area=k.split('.')[0];if(!k.endsWith('.view'))add(area+'.view',s);if(k==='orders.assign'||k==='roles.assign')add('workers.view','all');if(k==='invitations.create')add('roles.assign','all');}
 if(scope){next[key]=scope;add(key,scope);}else{delete next[key];if(key.endsWith('.view'))for(const k of Object.keys(next))if(k.startsWith(key.split('.')[0]+'.'))delete next[k];if(key==='workers.view'){delete next['orders.assign'];delete next['roles.assign'];}if(!next['roles.assign'])delete next['invitations.create'];}
 // Narrowing View also narrows the feature's dependent actions.
 if(key.endsWith('.view')&&scope==='assigned')for(const k of Object.keys(next))if(k.startsWith(key.split('.')[0]+'.'))next[k]='assigned';
 return next;
}
