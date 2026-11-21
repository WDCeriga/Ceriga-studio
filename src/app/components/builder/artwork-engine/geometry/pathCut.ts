import type { ShapePath, ShapePathNode } from '../../../../lib/shapeGeometry';

/**
 * Scissors (Illustrator's C tool), pure. Cutting a closed path at an anchor opens it there;
 * cutting an open path at an inner anchor splits it in two. Endpoints of open paths can't be cut.
 * `subpaths` of the input stay on the main result.
 */
export function cutPathAtNode(path: ShapePath, index: number): { main: ShapePath; extra?: ShapePath } | null {
  const nodes = path.nodes, n = nodes.length;
  if (n < 2 || index < 0 || index >= n) return null;
  const copy = (node: ShapePathNode): ShapePathNode => ({ ...node, in: node.in && { ...node.in }, out: node.out && { ...node.out } });
  if (path.closed) {
    const ordered = [...nodes.slice(index), ...nodes.slice(0, index)].map(copy);
    const start = { ...ordered[0], in: undefined }, end = { ...copy(nodes[index]), out: undefined };
    return { main: { ...path, closed: false, nodes: [start, ...ordered.slice(1), end] } };
  }
  if (index === 0 || index === n - 1) return null;
  const first = nodes.slice(0, index + 1).map(copy), second = nodes.slice(index).map(copy);
  first[first.length - 1] = { ...first[first.length - 1], out: undefined };
  second[0] = { ...second[0], in: undefined };
  return { main: { ...path, closed: false, nodes: first }, extra: { closed: false, nodes: second } };
}
