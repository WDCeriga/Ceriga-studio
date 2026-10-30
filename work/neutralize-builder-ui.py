from pathlib import Path
import re, colorsys, json
root=Path('src/app/components/builder')
css=list(root.rglob('*.css'))+list(Path('src/app/features/panelling').glob('*.css'))
roles={'ink':'#171717','text':'#262626','secondary':'#525252','muted':'#737373','focus':'#737373','line':'#e2e2e2','track':'#e5e5e5','soft':'#f2f2f2','surface':'#fafafa','white':'#ffffff'}
explicit={'405568':'text','405365':'text','405b6f':'text','526d81':'text','35414e':'text','34414f':'text','3e4c59':'text','455564':'secondary','657d90':'secondary','8192a8':'muted','77829a':'muted','7892a5':'focus','8096a9':'muted','b4c2cb':'muted'}
def convert(value):
 h=value[1:];rgb=tuple(int(h[i:i+2],16) for i in (0,2,4));r,g,b=rgb
 hue,sat,light=colorsys.rgb_to_hsv(r/255,g/255,b/255)
 # UI neutrals and muted cool colours only; preserve semantic and spectrum colours.
 if h.lower() not in explicit and not (max(rgb)-min(rgb)<=14 or 165<=hue*360<=265 and sat<=.66):return None
 lum=.2126*r+.7152*g+.0722*b
 role=explicit.get(h.lower())
 if role is None:role='ink' if lum<45 else 'text' if lum<78 else 'secondary' if lum<119 else 'muted' if lum<175 else 'line' if lum<229 else 'soft' if lum<247 else 'surface' if lum<254 else 'white'
 return role
seen={}
def hx(match,variables):
 raw=match.group();base=raw[:7];alpha=raw[7:];role=convert(base)
 if not role:return raw
 out=roles[role]+alpha
 seen[base.lower()]=out[:7]
 return 'var(--builder-ui-'+role+')' if variables and not alpha else out
pattern=r'#[0-9a-fA-F]{8}(?![0-9a-fA-F])|#[0-9a-fA-F]{6}(?![0-9a-fA-F])'
changed=[]
for p in css:
 old=p.read_text(encoding='utf-8');new=re.sub(pattern,lambda m:hx(m,True),old)
 def rgbfix(m):
  rgb=tuple(int(m[i]) for i in (1,2,3));role=convert('#%02x%02x%02x'%rgb)
  if not role:return m[0]
  n=tuple(int(roles[role][i:i+2],16) for i in (1,3,5));return 'rgba('+','.join(map(str,n))+','+m[4]+')'
 new=re.sub(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([.\d]+)\s*\)',rgbfix,new)
 if new!=old:p.write_text(new,encoding='utf-8');changed.append(str(p))
# Utilities and inline CSS are interface chrome; leave SVG colours and design defaults intact.
for p in list(root.rglob('*.tsx'))+[Path('src/app/pages/Builder.tsx')]:
 old=p.read_text(encoding='utf-8')
 new=re.sub(r'\[#[0-9a-fA-F]{6,8}\]',lambda m:re.sub(pattern,lambda h:hx(h,False),m[0]),old)
 new=re.sub(r'(?<=[\s\x27\x22`])((?:text|bg|border|ring|divide|accent|placeholder|outline|stroke|fill)-)slate-',r'\1neutral-',new)
 new=re.sub(r'style=\{\{.*?\}\}',lambda m:re.sub(pattern,lambda h:hx(h,False),m[0]),new,flags=re.S)
 if p.name in ('ShapePathEditor.tsx','CustomAreaPathEditor.tsx'):
  new=re.sub(pattern,lambda m:hx(m,False),new)
 if new!=old:p.write_text(new,encoding='utf-8');changed.append(str(p))
p=root/'shell/builder-shell.css';s=p.read_text(encoding='utf-8');tokens='/* Shared builder chrome palette; also available to portalled menus. */\n:root{'+''.join('--builder-ui-'+k+':'+v+';' for k,v in roles.items())+'}\n';p.write_text(tokens+s,encoding='utf-8')
Path('work/builder-neutral-palette-audit.json').write_text(json.dumps({'files':changed,'colours':seen},indent=2))
print('Updated',len(changed),'interface files;',len(seen),'palette colours. Garment and artwork data untouched.')
