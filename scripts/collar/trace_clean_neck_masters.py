"""Imagegen raster masters -> luminance key -> closed raster regions -> Potrace parts.
No neck SVG geometry is authored. Registration, rib texture and finish edits happen in pixels.
Run: python scripts/collar/trace_clean_neck_masters.py
"""
from pathlib import Path
from io import BytesIO
import json
import hashlib
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
import cairosvg
from trace_reference_neck import ink_alpha, trace_alpha
from raster_neck_ribs import make_ribs
from smooth_raster_neck_ink import smooth_ink

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'src/assets/studio-tshirt'
REF=ROOT/'scripts/collar/refs/clean-neck-master'
OUT=Path(os.environ.get('NECK_TRACE_OUTPUT',str(ROOT/'src/assets/tshirt-necks')))
KINDS=['crew','vneck','deep-vneck','thincrew','scoop','polo']
NAMES=['Crew neck','V-neck','Deep V-neck','Thin crew neck','Scoop neck','Polo collar']
SIZE=int(os.environ.get('NECK_RASTER_SIZE','2048'))
RASTER_SCALE=SIZE/1024
TRACE_CACHE={}
CACHE=REF/'_trace_cache'
CACHE.mkdir(exist_ok=True)

def render(path):
    data=cairosvg.svg2png(url=str(path),output_width=SIZE,output_height=SIZE)
    return np.asarray(Image.open(BytesIO(data)).convert('RGBA'))[:,:,3]>127

def bounds(m):
    y,x=np.nonzero(m);return int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)

def trace_data(mask):
    key=hashlib.sha256(mask.tobytes()).hexdigest()
    if key not in TRACE_CACHE:
        file=CACHE/(key+'.json')
        if file.exists(): TRACE_CACHE[key]=json.loads(file.read_text())
        else:
            TRACE_CACHE[key]=trace_alpha(mask.astype(float));file.write_text(json.dumps(TRACE_CACHE[key]))
    d,count=TRACE_CACHE[key]
    return d,count

def trace(mask,title,ink=False,footprint=None,ribs=None):
    d,count=trace_data(mask)
    assert count>=1 and mask.mean()<.8,(title,count,'polarity')
    # Raster masks retain their native source dimensions; garment lattice is 2048. This is placement, not path generation.
    extra=''
    if footprint is not None:
        fd,_=trace_data(footprint)
        extra=f'<path data-ink-preserve="true" fill="none" transform="scale({2048/SIZE})" d="{fd}"/>'
    if ribs is not None and ribs.any():
        rd,_=trace_data(ribs);extra+=f'<g transform="scale({2048/ribs.shape[0]})" opacity=".35"><path fill="#141414" fill-rule="evenodd" d="{rd}"/></g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-raster-neck="true" data-tech-ink-boldness="0"><title>{title}</title><g transform="scale({2048/mask.shape[0]})" fill="'+('#141414' if ink else '#000000')+f'"><path fill-rule="evenodd" d="{d}"/></g>{extra}</svg>'

def donor(j,view):
    im=Image.open(REF/f'{view}-master.png').convert('RGB').crop(((j%3)*512,(j//3)*512,(j%3+1)*512,(j//3+1)*512))
    alpha=ink_alpha(im); ink=alpha>=.5
    labels,n=ndi.label(~ink)
    cells=[]
    for i,box in enumerate(ndi.find_objects(labels),1):
        if box and i!=labels[0,0] and (labels==i).sum()>100:cells.append((i,box))
    assert cells,(j,view)
    allcells=np.isin(labels,[i for i,_ in cells]); bb=bounds(allcells)
    if view=='front':
        # Rear strip has the smallest vertical extent; opening is the large central cell below it.
        opening=max(cells,key=lambda p:(p[1][0].stop-p[1][0].start) if p[1][1].start<256<p[1][1].stop and p[1][0].start>bb[1]+15 else -1)[0]
        if j==5:opening=3
        inner=labels==opening
        band=allcells&~inner
    else:band=allcells;inner=np.zeros_like(band)
    footprint=ndi.binary_fill_holes(ndi.binary_dilation(allcells,iterations=2))
    ink &= ndi.binary_dilation(footprint,iterations=1)
    # Crop to neckline only: no donor shoulders or body edges are transplanted.
    x0,y0,x1,y1=bounds(footprint)
    masks=[ink,band,inner,footprint]
    cropped=[m[y0:y1,x0:x1].copy() for m in masks]
    for m in cropped:
        mid=m.shape[1]//2;m[:,-mid:]=m[:,:mid][:,::-1]
    rgba=np.zeros((*alpha.shape,4),np.uint8);rgba[:,:,3]=(alpha*255).astype(np.uint8)
    Image.fromarray(rgba).save(REF/f'{KINDS[j]}-{view}-keyed.png')
    return cropped

def body_name(fit,j):
    if fit=='slim':return ['Body crew','Body','Body deep V-neck','Body thin crew','Body scoop','Body polo collar'][j]
    return ('Body' if j==0 else 'Body '+NAMES[j])+f' ({fit})'

def main():
    OUT.mkdir(exist_ok=True)
    stats=[]
    for view in os.environ.get('NECK_TRACE_VIEWS','front,back').split(','):
      for j,kind in enumerate(KINDS):
        if kind not in os.environ.get('NECK_TRACE_KINDS',','.join(KINDS)).split(','):continue
        source=donor(j,view)
        for fit in os.environ.get('NECK_TRACE_FITS','slim,regular,boxy,oversized').split(','):
          suffix='' if fit=='slim' else f' ({fit})'
          original=render(SRC/'Neck'/(NAMES[j]+suffix+'.svg'))
          x0,y0,x1,y1=bounds(original)
          # Rear shares front shoulder anchors; polo rear collar occupies the original collar footprint.
          source_w=source[3].shape[1];scale=(x1-x0)/source_w
          height=max(8,round(source[3].shape[0]*scale))
          placed=[]
          for m in source:
            small=ndi.gaussian_filter(np.asarray(Image.fromarray(m.astype(np.uint8)*255).resize((x1-x0,height),Image.Resampling.LANCZOS)).astype(float)/255,.65)>=.5
            dest=np.zeros((SIZE,SIZE),bool);dest[y0:y0+height,x0:x1]=small[:SIZE-y0];placed.append(dest)
          ink,band,inner,foot=placed
          old_inner=inner.copy()
          ink,hd_ink=smooth_ink(ink,width=3.6*SIZE/2048)
          # Recover closed fabric cells from the cleaned raster ink.
          labels,n=ndi.label(~ink);outside=labels[0,0]
          closed=(labels!=outside)&~ink
          if view=='front':
            counts=np.bincount(labels[old_inner].ravel(),minlength=n+1);counts[outside]=0;counts[0]=0
            inner=labels==int(np.argmax(counts))
          else:inner=np.zeros_like(ink)
          band=closed&~inner
          foot=ndi.binary_fill_holes(ink)
          # Recover ink under each fabric region with nearest-cell ownership, preventing white slits.
          owners=np.zeros_like(ink,dtype=np.uint8);owners[band]=1;owners[inner]=2
          _,near=ndi.distance_transform_edt(owners==0,return_indices=True)
          owners[foot]=owners[tuple(near)][foot]
          band=owners==1;inner=owners==2
          base=render(SRC/'Body'/(body_name(fit,j)+'.svg'))
          # Replace only the old neck window, leaving all shoulders, sides and sleeve regions intact.
          bottom=max(bounds(original)[3],bounds(foot)[3])+round(4*RASTER_SCALE)
          for x in range(x0,x1):
            hits=np.flatnonzero(foot[:,x])
            if len(hits):
              top=hits.min()
              if kind!='polo':base[:top,x]=False
              base[top:bottom,x]=True
          # Base excludes the opening and collar surfaces; one-pixel overlap seals raster joins.
          base &= ~ndi.binary_erosion(foot,iterations=max(1,round(RASTER_SCALE)))
          if view=='back':inner[:]=False
          # Neat normal rib lines are constructed in raster space and traced as filled outlines.
          # Keep rib endpoints inside the ink border. Otherwise fine rib ends roughen its silhouette.
          rib_band=band & ~ndi.binary_dilation(ink,iterations=max(1,round(RASTER_SCALE*.5)))
          rib_masks=[cv2.resize(m.astype(np.float32),(1024,1024),interpolation=cv2.INTER_AREA)>=.5 for m in [rib_band,inner,base]]
          ribs=make_ribs(*rib_masks,view,kind)
          for finish in ['ribbed','clean','raw']:
            if kind=='polo' and finish=='raw':continue
            raw=finish=='raw'
            b=base.copy(); neck=band.copy();opening=inner.copy();i=ink.copy()
            if raw:
              # Raw neckline follows the original outer binding edge, with back fabric visible inside.
              opening=foot.copy() if view=='front' else opening
              if view=='back':b|=band
              # Keep only the outer neckline ink, remove every internal seam/rib.
              i=ink & ~ndi.binary_erosion(foot,iterations=max(1,round(3*RASTER_SCALE)))
            title=f'{fit} {kind} {view} {finish} raster traced'
            ink_mask=hd_ink*(~ndi.binary_erosion(foot,iterations=max(1,round(3*RASTER_SCALE)))) if raw else hd_ink
            masks={'body':b,'outline':ink_mask}
            if not raw:masks['neck']=neck
            if view=='front':masks['inner']=opening
            # Empty stitch layer: collar masters contain no decorative stitch marks.
            empty='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-raster-neck="true"/>'
            (OUT/f'{fit}.{kind}.{view}.{finish}.stitching.svg').write_text(empty)
            for part,m in masks.items():
              if not m.any():continue
              svg=trace(m,title+' '+part,part=='outline',foot if part=='outline' else None,ribs if part=='outline' and finish=='ribbed' else None)
              (OUT/f'{fit}.{kind}.{view}.{finish}.{part}.svg').write_text(svg)
            proof=np.full((SIZE,SIZE,3),255,np.uint8);proof[b]=(94,128,178);proof[neck if not raw else np.zeros_like(neck)]=(110,145,190);proof[opening]=(145,167,197);proof[i]=(20,20,20)
            Image.fromarray(proof).save(REF/f'{fit}-{kind}-{view}-{finish}-proof.png')
            stats.append({'fit':fit,'neck':kind,'view':view,'finish':finish,'inkPixels':int(i.sum()),'bandPixels':int(neck.sum()),'innerPixels':int(opening.sum())})
          print(fit,kind,view,flush=True)
    Path(os.environ.get('NECK_TRACE_MANIFEST',str(REF/'trace-manifest.json'))).write_text(json.dumps({'source':'imagegen raster masters','contrast':1.35,'white':246,'black':120,'upsample':3,'threshold':128,'turdsize':4,'turnpolicy':'minority','alphamax':1.,'opticurve':True,'variants':stats},indent=2))

if __name__=='__main__':main()
