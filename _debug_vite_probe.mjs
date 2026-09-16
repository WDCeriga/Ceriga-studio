import { createServer } from 'vite';
import { searchForWorkspaceRoot } from 'vite';

const server = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true },
});

const cfg = server.config;
console.log('root:', cfg.root);
console.log('fs.strict:', cfg.server.fs.strict);
console.log('fs.allow:', cfg.server.fs.allow);
console.log('searchForWorkspaceRoot:', searchForWorkspaceRoot(cfg.root));
console.log('safeModulePaths has main.tsx:', cfg.safeModulePaths?.has('C:/Users/richy/CerigaStudio/Ceriga-studio/src/main.tsx'));
console.log('consumer:', server.environments?.client?.config?.consumer);

await server.close();
process.exit(0);
