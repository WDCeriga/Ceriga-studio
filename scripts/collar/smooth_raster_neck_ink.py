"""Smooth raster ink centre-lines and redraw uniform black strokes before Potrace."""
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

def thin(mask):
    image=mask.copy()
    for iteration in range(100):
        changed=False
        for phase in (0,1):
            p=[np.roll(np.roll(image,dy,axis=0),dx,axis=1) for dy,dx in [(1,0),(1,-1),(0,-1),(-1,-1),(-1,0),(-1,1),(0,1),(1,1)]]
            count=sum(q.astype(np.uint8) for q in p)
            transitions=sum((~p[i]&p[(i+1)%8]).astype(np.uint8) for i in range(8))
            remove=image&(count>=2)&(count<=6)&(transitions==1)
            if phase==0:remove &= ~(p[0]&p[2]&p[4])&~(p[2]&p[4]&p[6])
            else:remove &= ~(p[0]&p[2]&p[6])&~(p[0]&p[4]&p[6])
            if remove.any():image[remove]=False;changed=True
        if not changed:break
    return image

def smooth_ink(ink, width=3.6, supersample=3):
    yy,xx=np.nonzero(ink); x0=max(0,int(xx.min())-8);y0=max(0,int(yy.min())-8)
    x1=min(ink.shape[1],int(xx.max())+9);y1=min(ink.shape[0],int(yy.max())+9)
    skeleton=thin(ink[y0:y1,x0:x1])
    ys,xs=np.nonzero(skeleton);pixels=set(zip(xs.tolist(),ys.tolist()))
    graph={}
    for x,y in pixels:
        neighbours=[]
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                if not (dx or dy):continue
                q=(x+dx,y+dy)
                if q not in pixels:continue
                if dx and dy and ((x+dx,y) in pixels or (x,y+dy) in pixels):continue
                neighbours.append(q)
        graph[(x,y)]=neighbours
    # Remove short raster-noise spurs so they cannot split a smooth contour into tiny pieces.
    for _ in range(3):
        remove=set()
        for start,neighbours in graph.items():
            if len(neighbours)!=1:continue
            path=[start];previous=start;current=neighbours[0]
            while len(path)<12 and len(graph[current])==2:
                path.append(current);nxt=next(p for p in graph[current] if p!=previous);previous,current=current,nxt
            if len(path)<12 and len(graph[current])>2:remove.update(path)
        if not remove:break
        graph={p:[q for q in neighbours if q not in remove] for p,neighbours in graph.items() if p not in remove}
    visited=set();paths=[]
    def edge(a,b):return tuple(sorted((a,b)))
    def walk(a,b):
        points=[a];previous=a;current=b;visited.add(edge(a,b))
        while True:
            points.append(current)
            if len(graph[current])!=2:break
            nxt=next((p for p in graph[current] if p!=previous),None)
            if nxt is None or edge(current,nxt) in visited:break
            visited.add(edge(current,nxt));previous,current=current,nxt
        return points
    for a,neighbours in graph.items():
        if len(neighbours)==2:continue
        for b in neighbours:
            if edge(a,b) not in visited:paths.append(walk(a,b))
    for a,neighbours in graph.items():
        for b in neighbours:
            if edge(a,b) not in visited:paths.append(walk(a,b))
    canvas=Image.new('1',(ink.shape[1]*supersample,ink.shape[0]*supersample));draw=ImageDraw.Draw(canvas)
    for path in paths:
        if len(path)<2:continue
        points=np.asarray(path,dtype=float);closed=np.linalg.norm(points[0]-points[-1])<2
        smooth=ndi.gaussian_filter1d(points,7,axis=0,mode='wrap' if closed else 'nearest')
        if not closed:
            for i in range(min(8,len(points))):
                t=i/8;smooth[i]=points[i]*(1-t)+smooth[i]*t;smooth[-i-1]=points[-i-1]*(1-t)+smooth[-i-1]*t
        # Construction corners and V mitres stay sharp.
        for i in range(7,len(points)-7):
            a=points[i]-points[i-7];b=points[i+7]-points[i]
            if np.dot(a,b)/(np.linalg.norm(a)*np.linalg.norm(b)+1e-9)<.4:
                smooth[max(0,i-2):i+3]=points[max(0,i-2):i+3]
        coords=[((x+x0)*supersample,(y+y0)*supersample) for x,y in smooth]
        draw.line(coords,fill=1,width=max(1,round(width*supersample)),joint='curve')
    high=np.asarray(canvas).copy()
    alpha=cv2.resize(high.astype(np.float32),(ink.shape[1],ink.shape[0]),interpolation=cv2.INTER_AREA)
    return alpha>=.5,alpha
