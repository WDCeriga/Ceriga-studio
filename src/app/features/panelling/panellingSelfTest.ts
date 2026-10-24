import { distance, flattenPathContours, flattenSeam, mirrorSeam, pointInSurface } from './panellingGeometry';
import { bendSeamSegment,closestSeamLocation,pointOnCurve,straightenSeamSegment,removeSeamAnchor,convertSeamToCurve, insertSeamAnchor, moveSeamAnchor, setAnchorMode, snapAnchor } from './panellingSeams';
import { recomputeGarmentPanellingTopology, recomputePanellingTopology } from './panellingTopology';
import type { BoundaryLoop, PanellingSeam } from './panellingTypes';

const rectangle: BoundaryLoop[] = [{ id: 'body', role: 'outer', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] }];
const seam = (id: string, points: [number, number][]): PanellingSeam => ({ id, label: id, construction: 'standard', anchors: points.map(([x, y], index) => ({ id: `${id}-${index}`, x, y })) });
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

export function runPanellingSelfTests() {
  const results: { name: string; passed: boolean }[] = [];
  const test = (name: string, run: () => void) => { run(); results.push({ name, passed: true }); };

  test('boundary-to-boundary seam creates two inherited panels', () => {
    const topology = recomputePanellingTopology(rectangle, [seam('center', [[50, 0], [50, 100]])]);
    assert(topology.panels.length === 2, `Expected 2 panels; received ${topology.panels.length}`);
    assert(topology.panels.every(panel => panel.parentId === 'body' && !panel.fillOverride), 'Panels must inherit their parent material by default.');
  });
  test('crossing seams create a shared junction and four faces', () => {
    const topology = recomputePanellingTopology(rectangle, [seam('vertical', [[50, 0], [50, 100]]), seam('horizontal', [[0, 50], [100, 50]])]);
    assert(topology.nodes.some(node => node.kind === 'intersection' && node.seamIds.length === 2), 'Crossing did not create a shared seam junction.');
    assert(topology.panels.length === 4, `Expected 4 panels; received ${topology.panels.length}`);
  });
  test('a seam joining an existing seam creates a junction and third face', () => {
    const topology = recomputePanellingTopology(rectangle, [seam('vertical', [[50, 0], [50, 100]]), seam('side-join', [[0, 50], [50, 50]])]);
    assert(topology.nodes.some(node => node.kind === 'intersection' && node.seamIds.length === 2), 'Seam connection did not create a shared junction.');
    assert(topology.panels.length === 3, `Expected 3 panels; received ${topology.panels.length}`);
  });
  test('closed internal loop creates its own panel without overlap', () => {
    const square = seam('square', [[30, 30], [70, 30], [70, 70], [30, 70], [30, 30]]);
    const panels = recomputePanellingTopology(rectangle, [square]).panels;
    assert(panels.length === 2, `Expected square and surrounding panels; received ${panels.length}`);
    assert(Math.abs(panels.reduce((sum, panel) => sum + panel.area, 0) - 10000) < 1, 'Generated regions do not conserve parent area.');
  });
  test('curved seam flattens for topology while retaining Bezier controls', () => {
    const curved = seam('curve', [[0, 50], [100, 50]]);
    curved.anchors[0].outgoing = { x: 35, y: 15 };
    curved.anchors[1].incoming = { x: 65, y: 85 };
    assert(flattenSeam(curved).length > 10, 'Bezier segment was not sampled.');
    assert(recomputePanellingTopology(rectangle, [curved]).panels.length === 2, 'Curved boundary-to-boundary seam did not split the surface.');
  });
  test('mirroring reflects curved geometry without reversing handle direction', () => {
    const curved = seam('mirror', [[20, 40], [60, 70]]);
    curved.anchors[0].outgoing = { x: 28, y: 30 };
    const reflected = mirrorSeam(curved, 50);
    assert(reflected.anchors[0].x === 80 && reflected.anchors[0].outgoing?.x === 72, 'Mirror axis or handle reflection is incorrect.');
  });
  test('mirrored curves match the source at every sampled point',()=>{
    const original=convertSeamToCurve(seam('curved-mirror',[[20,0],[20,100]]),0);
    const bent=bendSeamSegment(original,0,.5,{x:40,y:50}),left=flattenSeam(bent),right=flattenSeam(mirrorSeam(bent,50));
    assert(left.every((point,index)=>Math.abs(100-point.x-right[index].x)<1e-6&&Math.abs(point.y-right[index].y)<1e-6),'Reflected curve changed shape.');
  });
  test('two-point seam bends through the dragged position without moving its ends',()=>{
    const original=seam('bend',[[20,0],[20,100]]),bent=bendSeamSegment(original,0,.5,{x:45,y:50});
    assert(bent.anchors.length===2&&bent.anchors[0].x===20&&bent.anchors[1].x===20,'Bending changed endpoints or added points.');
    assert(distance(pointOnCurve(bent.anchors[0],bent.anchors[1],.5),{x:45,y:50})<1e-6,'Curve missed the drag position.');
    assert(recomputePanellingTopology(rectangle,[bent]).panels.length===2,'Bending no longer divides the garment.');
  });
  test('panel identity survives curve reshaping and adding a point',()=>{
    const original=seam('stable',[[20,0],[20,100]]),before=recomputePanellingTopology(rectangle,[original]).panels.map(panel=>panel.id).sort();
    const bent=bendSeamSegment(original,0,.5,{x:45,y:50}),inserted=insertSeamAnchor(bent,{x:45,y:50});
    assert(JSON.stringify(before)===JSON.stringify(recomputePanellingTopology(rectangle,[bent]).panels.map(panel=>panel.id).sort()),'Bending changed panel identities and would lose materials.');
    assert(JSON.stringify(before)===JSON.stringify(recomputePanellingTopology(rectangle,[inserted]).panels.map(panel=>panel.id).sort()),'Adding an anchor changed panel identities.');
  });
  test('bending one segment preserves the neighbouring curve handles',()=>{
    const original=convertSeamToCurve(convertSeamToCurve(seam('multi',[[0,0],[50,50],[100,100]]),0),1),prior=JSON.stringify(original.anchors[1].outgoing);
    const bent=bendSeamSegment(original,0,.3,{x:30,y:10});
    assert(JSON.stringify(bent.anchors[1].outgoing)===prior,'Adjacent segment handles changed.');
    assert(distance(pointOnCurve(bent.anchors[0],bent.anchors[1],.3),{x:30,y:10})<1e-6,'Off-centre drag missed its parameter.');
  });
  test('straightening removes only the selected segment curve',()=>{
    const original=convertSeamToCurve(convertSeamToCurve(seam('straighten',[[0,0],[50,50],[100,100]]),0),1),straight=straightenSeamSegment(original,0);
    assert(!straight.anchors[0].outgoing&&!straight.anchors[1].incoming&&Boolean(straight.anchors[1].outgoing),'Straighten affected the wrong handles.');
  });
  test('removing an interior point preserves endpoint identities',()=>{
    const original=seam('remove',[[0,0],[30,40],[60,50],[100,100]]),removed=removeSeamAnchor(original,original.anchors[1].id);
    assert(removed.anchors.length===3&&removed.anchors[0]===original.anchors[0]&&removed.anchors.at(-1)===original.anchors.at(-1),'Point removal damaged the endpoints.');
    assert(removeSeamAnchor(original,original.anchors[0].id)===original,'Boundary endpoint should not be removed.');
  });
  test('curve hit testing identifies the intended segment and parameter',()=>{
    const original=convertSeamToCurve(seam('locate',[[0,0],[100,100]]),0),at=pointOnCurve(original.anchors[0],original.anchors[1],.25),hit=closestSeamLocation(original,at);
    assert(hit?.segmentIndex===0&&Math.abs(hit.t-.25)<.001,'Curve hit did not resolve the selected position.');
  });
  test('adding a point at an existing endpoint does not duplicate it',()=>{
    const original=seam('endpoint-insert',[[0,0],[100,100]]);
    assert(insertSeamAnchor(original,{x:0,y:0})===original&&insertSeamAnchor(original,{x:100,y:100})===original,'Endpoint insertion created a degenerate segment.');
  });
  test('segment insertion and anchor movement preserve seam identity', () => {
    const original = seam('editable', [[10, 50], [90, 50]]);
    const inserted = insertSeamAnchor(original, { x: 45, y: 52 });
    assert(inserted.id === original.id && inserted.anchors.length === 3, 'Insertion created a duplicate seam or missed the new point.');
    const moved = moveSeamAnchor(inserted, inserted.anchors[1].id, { x: 45, y: 65 });
    assert(moved.anchors[1].y === 65, 'Anchor move did not update seam geometry.');
  });
  test('inserting a point into a curved segment preserves its curve', () => {
    const curved = seam('curve-insert', [[0, 50], [100, 50]]);
    curved.anchors[0].outgoing = { x: 20, y: 10 };
    curved.anchors[1].incoming = { x: 80, y: 10 };
    const before = flattenSeam(curved, 48), inserted = insertSeamAnchor(curved, { x: 50, y: 20 }), after = flattenSeam(inserted, 48);
    assert(inserted.anchors.length === 3, 'Curve insertion did not add an anchor.');
    assert(before.every(point => Math.min(...after.map(candidate => distance(point, candidate))) < 1), 'Curve changed shape during insertion.');
  });
  test('straight segments convert to editable curves without an initial geometry jump', () => {
    const straight = seam('convert', [[10, 50], [90, 50]]), converted = convertSeamToCurve(straight, 0);
    assert(converted.anchors[0].outgoing && converted.anchors[1].incoming, 'Conversion did not create Bezier handles.');
    assert(flattenSeam(straight).every((point, index) => Math.abs(point.y - flattenSeam(converted)[index].y) < 1e-6), 'Conversion changed the initial straight appearance.');
  });
  test('anchor modes remove, align, or preserve independent handles', () => {
    const curve = seam('modes', [[0, 50], [50, 50], [100, 50]]);
    const smooth = setAnchorMode(curve, 'modes-1', 'smooth'), point = smooth.anchors[1];
    assert(point.incoming && point.outgoing && Math.abs(point.incoming.y - point.outgoing.y) < 1e-6, 'Smooth mode did not create aligned handles.');
    const corner = setAnchorMode(smooth, point.id, 'corner').anchors[1];
    assert(!corner.incoming && !corner.outgoing, 'Corner mode kept curve handles.');
    assert(setAnchorMode(smooth, point.id, 'independent').anchors[1].handleMode === 'independent', 'Independent mode was not retained.');
  });
  test('snap resolves a nearby garment boundary', () => {
    const anchor = snapAnchor({ x: 48, y: 1 }, rectangle, [], 4);
    assert(anchor.boundaryId === 'body' && anchor.y === 0, 'Boundary snap failed.');
  });
  test('hole boundary is excluded from garment material', () => {
    const boundaries: BoundaryLoop[] = [...rectangle, { id: 'neckline', role: 'hole', points: [{ x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 }, { x: 40, y: 20 }] }];
    assert(!pointInSurface({ x: 50, y: 10 }, boundaries), 'Neck opening was treated as garment material.');
    assert(pointInSurface({ x: 20, y: 20 }, boundaries), 'Body material was incorrectly classified as a hole.');
  });

  test('one multi-anchor concave seam creates exactly two panels and conserves area', () => {
    const panels = recomputePanellingTopology(rectangle, [seam('bent', [[0,45],[25,75],[65,25],[100,55]])]).panels;
    assert(panels.length === 2, 'Polyline anchors created phantom panels.');
    assert(Math.abs(panels.reduce((sum,p) => sum+p.area,0)-10000) < .01, 'Polyline split lost or duplicated area.');
    assert(panels.every(p => p.seamIds.length === 1), 'A complete seam lost its identity.');
  });
  test('open seams have no invisible closing chord', () => {
    const panels = recomputePanellingTopology(rectangle, [seam('open', [[0,40],[25,70],[60,30]])]).panels;
    assert(panels.length === 1 && Math.abs(panels[0].area-10000) < .01, 'Dangling path created a phantom face.');
  });
  test('SVG subpaths never join across moveto or distance gaps', () => {
    const contours = flattenPathContours('M0 0 L100 0 L100 100 L0 100 Z M20 20 L20 30 L30 30 L30 20 Z', 18);
    assert(contours.length === 2 && contours[0].length > 4, 'Closed subpaths were lost or fragmented.');
    assert(flattenPathContours('M0 0 L100 0 L100 100').length === 0, 'Open SVG path acquired a closing chord.');
  });
  const pieces: BoundaryLoop[] = [-1,0,1].map((index) => ({ id: String(index), surfaceId: index === -1 ? 'sleeveLeft' : index === 1 ? 'sleeveRight' : 'base', role: 'outer',
    points: [{x:index*100,y:0},{x:(index+1)*100,y:0},{x:(index+1)*100,y:100},{x:index*100,y:100}] }));
  test('sleeve-only seam leaves both other semantic surfaces unchanged', () => {
    const panels = recomputeGarmentPanellingTopology(pieces, [seam('sleeve', [[-100,50],[-50,65],[0,50]])]).panels;
    assert(panels.filter(p=>p.parentId==='sleeveLeft').length === 2, 'Sleeve did not split into two.');
    assert(panels.filter(p=>p.parentId==='base').length === 1 && panels.filter(p=>p.parentId==='sleeveRight').length === 1, 'Uncrossed surface was partitioned.');
  });
  test('one cross-surface seam partitions only the three crossed surfaces', () => {
    const graph = recomputeGarmentPanellingTopology(pieces, [seam('continuous', [[-100,50],[-50,55],[50,45],[200,50]])]);
    for (const id of ['base','sleeveLeft','sleeveRight']) {
      const panels = graph.panels.filter(p=>p.parentId===id);
      assert(panels.length===2, id+' should contain exactly two faces.');
      assert(Math.abs(panels.reduce((sum,p)=>sum+p.area,0)-10000)<.01, id+' lost area.');
      assert(panels.every(p=>p.seamIds.includes('continuous') && !p.fillOverride), 'Cross-surface identity or inheritance lost.');
    }
  });
  test('duplicate and overlapping seams do not add faces', () => {
    const panels = recomputePanellingTopology(rectangle, [seam('one',[[0,50],[100,50]]), seam('two',[[100,50],[50,50],[0,50]])]).panels;
    assert(panels.length===2, 'Overlapping seams generated phantom faces.');
  });
  test('tiny clipping vertices do not invalidate a complete surface', () => {
    const clipped: BoundaryLoop[]=[{id:'clipped',role:'outer',points:[{x:0,y:0},{x:.000001,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]}];
    const panels=recomputePanellingTopology(clipped,[]).panels;
    assert(panels.length===1 && Math.abs(panels[0].area-10000)<.01,'Small first edge discarded a real surface.');
  });
  test('cross-surface construction boundaries expose shared junctions', () => {
    const graph=recomputeGarmentPanellingTopology(pieces,[seam('all',[[-100,50],[200,50]])]);
    assert(graph.nodes.filter(node=>node.kind==='intersection' && (node.surfaceIds?.length??0)>1).length===2,'Armhole crossings must be shared topology junctions.');
  });
  test('disconnected source contours retain one untouched semantic parent without closing chords', () => {
    const other: BoundaryLoop={id:'island',surfaceId:'base',role:'outer',points:[{x:200,y:0},{x:210,y:0},{x:210,y:10},{x:200,y:10}]};
    const panels=recomputeGarmentPanellingTopology([...rectangle.map(loop=>({...loop,surfaceId:'base'})),other],[]).panels;
    assert(panels.length===1 && Math.abs(panels[0].area-10100)<.01,'Source subpaths must not create user seam subdivisions.');
    assert((panels[0].path.match(/M/g)??[]).length===2,'Disconnected contours must remain separate paths.');
  });
  return results;
}