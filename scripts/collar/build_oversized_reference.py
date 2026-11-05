"""Build Oversized parts from the raster flat; all SVG curves come from Potrace."""
from pathlib import Path
import json, math
import cv2, numpy as np, potrace
from PIL import Image, ImageEnhance
ROOT=Path(__file__).resolve().parents[2]
REF=Path(__file__).parent/'refs/oversized-reference'
source=Image.open(REF/'master-front-back.png').convert('RGB')
counts=[]
trace_cache={}
def trace(mask):
    key=mask.tobytes()
    if key in trace_cache:return trace_cache[key]
    ys,xs=np.where(mask)
    if not len(xs):return '',0
    ox,oy=max(0,int(xs.min())-2),max(0,int(ys.min())-2)
    cropped=mask[oy:min(mask.shape[0],int(ys.max())+3),ox:min(mask.shape[1],int(xs.max())+3)]
    big=cv2.resize(cropped.astype('uint8'),None,fx=3,fy=3,interpolation=cv2.INTER_NEAREST)>0
    bitmap=potrace.Bitmap(big); bitmap.invert() # Bitmap constructor reverses the input.
    paths=bitmap.trace(turdsize=4,turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,alphamax=1.,opticurve=True,opttolerance=.2)
    pieces=[]
    def pt(p): return f'{p.x/3+ox:.3f},{p.y/3+oy:.3f}'
    for curve in paths:
        d='M'+pt(curve.start_point)
        for s in curve:
            if s.is_corner:d+='L'+pt(s.c)+'L'+pt(s.end_point)
            else:d+='C'+pt(s.c1)+' '+pt(s.c2)+' '+pt(s.end_point)
        pieces.append(d+'Z')
    result=''.join(pieces),len(pieces)
    trace_cache[key]=result
    return result
# Keep the original raster dimensions in the reference SVG. Production uses the
# same shared traced sleeve family for all fits, registered as a whole construction.
rgb=ImageEnhance.Contrast(source).enhance(1.35)
lum=np.asarray(rgb.convert('L'),dtype=float)
alpha=(np.clip((246-lum)/(246-120),0,1)*255).astype('uint8')
rgba=np.zeros((*alpha.shape,4),np.uint8);rgba[:,:,3]=alpha
Image.fromarray(rgba).save(REF/'master-keyed.png')
d,n=trace(alpha>=128)
assert n>100, f'Wrong ink polarity: only {n} subpaths'
w,h=source.size
(REF/'master-ink.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path fill="#000000" fill-rule="evenodd" d="{d}"/></svg>',encoding='utf-8')
manifest={'source':'master-front-back.png','contrast':1.35,'white':246,'black':120,'upsample':3,'threshold':128,'constructorInversionCorrected':True,'turdsize':4,'turnpolicy':'minority','alphamax':1.,'opticurve':True,'fillRule':'evenodd','viewBox':[0,0,w,h],'inkSubpaths':n}
(REF/'trace-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(manifest)
