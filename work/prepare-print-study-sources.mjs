import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{decode,encode}from'fast-png';
mkdirSync('src/assets/artwork-studies',{recursive:true});
const refs=['d4f53802-64ac-4fa4-bb23-355322b17258','89d327ec-de1d-4837-8a44-e4d8eb34a98e','73f8ee33-1d2c-484f-8958-9c5156c5e934','7d850128-9474-4f83-970e-2f1b873a463b'];
const crop=(index,name,x,y,width,height)=>{const p=decode(readFileSync(`C:/Users/rodiase/AppData/Local/Temp/codex-clipboard-${refs[index]}.png`));const data=new Uint8Array(width*height*4);for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){const si=((yy+y)*p.width+xx+x)*p.channels,di=(yy*width+xx)*4;data.set(p.data.slice(si,si+3),di);data[di+3]=p.channels===4?p.data[si+3]:255}writeFileSync(`src/assets/artwork-studies/${name}.png`,encode({width,height,data,channels:4,depth:8}));console.log(name,p.width,p.height)};
crop(0,'tiger-source',465,535,300,150);
crop(2,'sleeve-left-source',128,285,170,650);
crop(2,'sleeve-right-source',800,285,170,650);
crop(3,'badge-lettering-source',285,920,735,335);
