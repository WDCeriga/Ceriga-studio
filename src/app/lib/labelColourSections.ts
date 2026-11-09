import type { DesignElement } from '../components/builder/PrintStudioEditor';
import type { SurfaceArtwork } from './artworkSurface';

export function addLabelColourSection(value: SurfaceArtwork, position?: 'top' | 'middle' | 'bottom') {
  const sections = value.document.elements.filter(element => element.surfaceRole === 'frame');
  const slot = position ? ['top', 'middle', 'bottom'].indexOf(position) : sections.length % 3;
  const width = value.surface.width, height = value.surface.height / 3;
  const y = height * (slot + .5), id = crypto.randomUUID();
  const name = ['Top section', 'Middle section', 'Bottom section'][slot];
  const colour = '#e5e5e5';
  const section: DesignElement = {
    id, type: 'shape', content: 'rect', layerName: name,
    x: width / 2, y, width, height, rotation: 0, side: 'front',
    shapeGeometry: 'bounds', shapeFilled: true, shapeFillColor: colour,
    color: colour, borderWidth: 0, surfaceRole: 'frame', frameId: id,
  };
  return {
    id,
    value: arrangeLabelSections({
      ...value,
      document: {
        ...value.document, revision: value.document.revision + 1,
        elements: [...value.document.elements, section],
        frames: [
          ...value.document.frames,
          { id, name, x: 0, y: y - height / 2, width, height, padding: 0, fill: colour,
            clip: false, layout: 'free' as const, leaderId: id, artworks: [id] },
        ],
      },
    }),
  };
}

/** Place section colour below the weave and folded ends of the label. */
export function arrangeLabelSections(value: SurfaceArtwork): SurfaceArtwork {
  if (value.surface.kind !== 'label' && value.surface.kind !== 'tagFace') return value;
  const sectionIds = new Set(value.document.frames.filter(frame => frame.leaderId).map(frame => frame.id));
  // Untouched legacy labels must retain their original SVG paint order.
  // Only native colour sections need the fabric/section/decoration arrangement.
  if (!sectionIds.size) return value;
  const elements = value.document.elements.map(element =>
    element.frameId && sectionIds.has(element.frameId) && element.surfaceRole !== 'frame' && !element.followSection
      ? { ...element, frameId: undefined } : element);
  const rank = (element: DesignElement) => {
    if (element.surfaceRole === 'frame') return 1;
    if (element.svgPrecision?.parents.some(parent => 'data-label-fabric' in parent.attrs)) {
      const overlay = element.svgPrecision.parents.some(parent => 'opacity' in parent.attrs) ||
        element.svgPrecision.node.attrs.fill?.startsWith('url(');
      return overlay ? 2 : 0;
    }
    return element.surfaceRole === 'border' ? 4 : 3;
  };
  return {
    ...value,
    document: { ...value.document, elements: [...elements].sort((a, b) => rank(a) - rank(b)),
      frames: value.document.frames.map(frame => ({
        ...frame, artworks: frame.artworks.filter(id => {
          const element = elements.find(item => item.id === id);
          return element && (!sectionIds.has(frame.id) || element.frameId === frame.id);
        }),
      })),
    },
  };
}
