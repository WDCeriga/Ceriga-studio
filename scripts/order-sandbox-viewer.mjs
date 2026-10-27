import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.sandbox/order-batch-20261025'),base=path.resolve('.sandbox');
if(!root.startsWith(base+path.sep))throw Error('Choose a dedicated .sandbox batch');
const snapshot=JSON.parse(await fs.readFile(path.join(root,'snapshot.json'),'utf8'));
const html=await fs.readFile(new URL('./support/order-sandbox-viewer.html',import.meta.url));
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read-only test viewer');return;}
 try{
  const url=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/api/data'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(snapshot));return;}
  if(url.pathname.startsWith('/media/')){const file=path.resolve(root,'storage',decodeURIComponent(url.pathname.slice(7))),storage=path.resolve(root,'storage');if(!file.startsWith(storage+path.sep)||!file.endsWith('.png')){res.writeHead(403);res.end();return;}res.setHeader('Content-Type','image/png');res.end(await fs.readFile(file));return;}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'");res.end(html);return;}
  res.writeHead(404);res.end('Not found');
 }catch{res.writeHead(404);res.end('Test artifact not found');}
});
server.listen(5180,'127.0.0.1',()=>console.log('Isolated order sandbox viewer: http://127.0.0.1:5180 — '+snapshot.orders.length+' verified test orders. Read-only; no live connection.'));
