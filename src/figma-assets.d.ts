/** `figma:asset/<hash>.png` imports are resolved to files in src/assets by the resolve-figma-assets plugin in vite.config.ts. */
declare module 'figma:asset/*' {
  const src: string;
  export default src;
}
