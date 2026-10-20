"""Fine straight raster ribs, traced with Potrace; includes collar returns and polo leaves."""
from pathlib import Path
from io import BytesIO
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
import cv2,cairosvg,sys
from trace_reference_neck import trace_alpha
ROOT=Path(__file__).resolve().parents[2]
PACK=ROOT/'src/assets/tshirt-necks'

def make_ribs(band,inner,base,view,kind):
    size=band.shape[0];target=inner if view=='front' else base
    texture=Image.new('1',(size*3,size*3));draw=ImageDraw.Draw(texture)
    contours,_=cv2.findContours(target.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    for contour in contours:
      points=contour[:,0,:].astype(float)
      if len(points)<8:continue
      smooth=ndi.gaussian_filter1d(points,4,axis=0,mode='wrap');delta=np.roll(smooth,-1,axis=0)-smooth
      arc=np.r_[0,np.cumsum(np.linalg.norm(delta,axis=1))]
      for at in np.arange(0,arc[-1],2.8):
        idx=min(len(points)-1,max(0,np.searchsorted(arc,at)-1));q=smooth[idx];v=delta[idx]
        normal=np.array([-v[1],v[0]])/(np.linalg.norm(v) or 1)
        def inside(p):
          x,y=np.round(p).astype(int);return 0<=x<size and 0<=y<size and band[y,x]
        if not inside(q+normal*3):normal=-normal
        segment=[];started=False
        for step in np.arange(0,120,.25):
          p=q+normal*step
          if inside(p):segment.append(p);started=True
          elif started:break
        if len(segment)>8:draw.line([tuple(segment[2]*3),tuple(segment[-3]*3)],fill=1,width=1)
    ribs=np.asarray(texture).copy()
    band3=np.asarray(Image.fromarray(band).resize((size*3,size*3),Image.Resampling.NEAREST))
    if view=='front' and inner.any():
      iy,ix=np.nonzero(inner);yy,xx=np.indices(ribs.shape,dtype=np.float32);xx/=3;yy/=3
      # The collar returns sit above the front opening. Continue straight ribs through
      # those shoulder caps instead of ending the texture at the opening's rear edge.
      left=(xx<ix.min()+8)&(yy<iy.min()+14);right=(xx>ix.max()-8)&(yy<iy.min()+14)
      caps=(left|right)&band3
      pattern=np.where(left,(yy+xx*.35)%2.8,(yy-xx*.35)%2.8)<.35
      ribs[caps]=pattern[caps]
      if kind=='polo':
        # Texture belongs to the folded collar and rear strip, not the opening/placket.
        placket=band3 & (yy>iy.max()-8)
        ribs[placket]=((xx%2.8)<.35)[placket]
      elif kind in ['vneck','deep-vneck']:
        tipx=float(np.mean(ix[iy>iy.max()-2]));theta=np.arctan2(np.abs(xx-tipx),np.maximum(.01,yy-iy.max()+2))
        tip=band3 & (yy>iy.max()-3)
        ribs[tip]=((theta%.16)<.025)[tip]
    ribs &= band3
    return ribs

def render(file):
    im=Image.open(BytesIO(cairosvg.svg2png(url=str(file),output_width=1024,output_height=1024))).convert('RGBA')
    return np.asarray(im)[:,:,3]>127

def main():
    for fit in ['slim','regular','boxy','oversized']:
      for kind in ['crew','vneck','deep-vneck','thincrew','scoop','polo']:
        for view in (['front'] if '--front' in sys.argv else ['front','back']):
          stem=f'{fit}.{kind}.{view}';band=render(PACK/(stem+'.clean.neck.svg'));base=render(PACK/(stem+'.clean.body.svg'))
          inner=render(PACK/(stem+'.clean.inner.svg')) if view=='front' else np.zeros_like(band)
          ribs=make_ribs(band,inner,base,view,kind);d,count=trace_alpha(ribs.astype(float))
          assert ribs.any() and count>20,(stem,count)
          clean=(PACK/(stem+'.clean.outline.svg')).read_text()
          markup=f'<g data-neck-rib-texture="true" transform="scale({2048/ribs.shape[0]})" opacity=".35"><path fill="#141414" fill-rule="evenodd" d="{d}"/></g>'
          (PACK/(stem+'.ribbed.outline.svg')).write_text(clean.replace('</svg>',markup+'</svg>'))
          print(stem,count,'traced ribs',flush=True)
if __name__=='__main__':main()
