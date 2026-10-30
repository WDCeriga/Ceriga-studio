import{readFileSync,writeFileSync}from'node:fs';import{decode,encode}from'fast-png';
const dir='C:/Users/rodiase/Documents/Codex/2026-10-23/https-github-com-wdceriga-ceriga-studio/outputs/';const id=process.argv[2]??'tiger';
const image=decode(readFileSync(dir+`study-${id}-full.png`));const r=JSON.parse(readFileSync(dir+`study-${id}-box.json`));console.log('capture',image.width,image.height,'box',r);
const x=Math.round(r.x),y=Math.round(r.y),width=Math.round(r.width),height=Math.round(r.height);const data=new Uint8Array(width*height*4);
for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){const si=((yy+y)*image.width+xx+x)*image.channels,di=(yy*width+xx)*4;data.set(image.data.slice(si,si+3),di);data[di+3]=image.channels===4?image.data[si+3]:255}
writeFileSync(dir+`preview-${id}.png`,encode({width,height,data,channels:4,depth:8}));
