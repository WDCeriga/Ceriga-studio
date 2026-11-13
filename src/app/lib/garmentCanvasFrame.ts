export interface GarmentDrawingBounds {left:number;right:number;top:number;bottom:number;scale?:number}

// Match the T-shirt canvas's visible height and center using the raised hoodie
// as the reference, so shorter hoods and hoodless necklines do not reframe it.
const HOODIE_DRAWING_FRAME: GarmentDrawingBounds = { left: 110, right: 890, top: 3, bottom: 975 };
// Shift the camera center to the hoodless silhouette while keeping its scale.
const HOODLESS_DRAWING_FRAME: GarmentDrawingBounds = {
  ...HOODIE_DRAWING_FRAME,
  top: HOODIE_DRAWING_FRAME.top + 140,
  bottom: HOODIE_DRAWING_FRAME.bottom + 140,
};

const tshirtDrawingFrame: GarmentDrawingBounds = {
 ...HOODIE_DRAWING_FRAME,
 top: 14,
 bottom: 986,
};
// Use the same camera scale for a given fit in both garment builders.
const canvasFitScale: Record<string, number> = { slim: .925, regular: 1, boxy: .967, oversized: .967 };

function drawingFrameForFit(frame: GarmentDrawingBounds, fit?: string): GarmentDrawingBounds {
 return { ...frame, scale: canvasFitScale[fit ?? 'regular'] ?? 1 };
}

export function tshirtDrawingFrameForFit(fit?: string): GarmentDrawingBounds {
 return drawingFrameForFit(tshirtDrawingFrame, fit);
}

export function hoodieDrawingFrameForFit(fit?: string, hoodless = false): GarmentDrawingBounds {
 return drawingFrameForFit(hoodless ? HOODLESS_DRAWING_FRAME : HOODIE_DRAWING_FRAME, fit);
}
/** A single camera frame for both the garment builder and the artwork studio. */
export function garmentFrameStyle(bounds:GarmentDrawingBounds,phone=false,zoom=100) {
 const scale = bounds.scale ?? 1;
 const width=`min(calc(100cqw / ${(bounds.right-bounds.left+(phone?100:160))/(900*scale)}),calc(100cqh / ${(bounds.bottom-bounds.top+100)/(900*scale)}))`;
 return {zoom:zoom/100,width,height:width,transform:`translate(${-100*(bounds.left+bounds.right)/2000}%,${-100*(bounds.top+bounds.bottom)/2000}%)`};
}

/** The garment SVG is square; the legacy artwork coordinates remain 800 x 700. */
export function artworkSceneScale(frame:{width:number;height:number},board:{width:number;height:number},assetMode=false){
 const reference=assetMode?board:{width:Math.min(board.width,board.height),height:Math.min(board.width,board.height)};
 return Math.min(frame.width/reference.width,frame.height/reference.height);
}
