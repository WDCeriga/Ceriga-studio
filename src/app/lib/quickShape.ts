export type StrokePoint = { x: number; y: number };
export type QuickShape = { content: 'line' | 'rect' | 'circle' | 'ellipse' | 'semicircle-open' | 'semicircle-closed'; x: number; y: number; width: number; height: number; rotation: number };

function recognizeSemicircle(points: StrokePoint[], length: number, endpointDistance: number): QuickShape | null {
  const samples: StrokePoint[] = [points[0]];
  const spacing = length / 96;
  let travelled = 0;
  let nextSample = spacing;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const point = points[index];
    const segment = Math.hypot(point.x - previous.x, point.y - previous.y);
    while (nextSample <= travelled + segment && segment > 0) {
      const fraction = (nextSample - travelled) / segment;
      samples.push({ x: previous.x + (point.x - previous.x) * fraction, y: previous.y + (point.y - previous.y) * fraction });
      nextSample += spacing;
    }
    travelled += segment;
  }
  let start = points[0];
  let end = points[points.length - 1];
  const closed = endpointDistance < length * 0.06;
  if (closed) {
    let diameter = 0;
    for (const candidate of samples) {
      for (const other of samples) {
        const distance = Math.hypot(other.x - candidate.x, other.y - candidate.y);
        diameter = Math.max(diameter, distance);
      }
    }
    let bestError = Infinity;
    for (let index = 0; index < samples.length; index++) {
      const candidate = samples[index];
      for (const other of samples.slice(index + 1)) {
        const chordX = other.x - candidate.x;
        const chordY = other.y - candidate.y;
        const distance = Math.hypot(chordX, chordY);
        if (distance < diameter * 0.9 || distance < 24) continue;
        const centerX = (candidate.x + other.x) / 2;
        const centerY = (candidate.y + other.y) / 2;
        const denominator = distance * distance / 2;
        const local = samples.map(point => ({
          x: ((point.x - centerX) * chordX + (point.y - centerY) * chordY) / denominator,
          y: (-(point.x - centerX) * chordY + (point.y - centerY) * chordX) / denominator,
        }));
        if (local.filter(point => Math.abs(point.x) < 0.8 && Math.abs(point.y) < 0.1).length < samples.length * 0.15) continue;
        const side = local.reduce((sum, point) => sum + point.y, 0) >= 0 ? 1 : -1;
        const error = local.reduce((sum, point) => {
          const radialError = Math.abs(Math.hypot(point.x, point.y) - 1);
          const diameterError = Math.hypot(Math.max(0, Math.abs(point.x) - 1), point.y);
          return sum + Math.min(radialError, diameterError) ** 2 + Math.min(0, point.y * side) ** 2;
        }, 0);
        if (error < bestError) { bestError = error; start = candidate; end = other; }
      }
    }
    if (!Number.isFinite(bestError)) return null;
  }
  const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
  if (radius < 12) return null;
  const expectedLength = radius * (Math.PI + (closed ? 2 : 0));
  const smoothed = samples.map((point, index) => {
    if (!index || index === samples.length - 1) return point;
    const neighbours = samples.slice(Math.max(0, index - 2), Math.min(samples.length, index + 3));
    return {
      x: neighbours.reduce((sum, neighbour) => sum + neighbour.x, 0) / neighbours.length,
      y: neighbours.reduce((sum, neighbour) => sum + neighbour.y, 0) / neighbours.length,
    };
  });
  const smoothLength = smoothed.reduce((sum, point, index) => index ? sum + Math.hypot(point.x - smoothed[index - 1].x, point.y - smoothed[index - 1].y) : 0, 0);
  if (smoothLength / expectedLength < 0.8 || smoothLength / expectedLength > 1.25) return null;
  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const local = samples.map(point => ({
    x: ((point.x - centerX) * Math.cos(angle) + (point.y - centerY) * Math.sin(angle)) / radius,
    y: (-(point.x - centerX) * Math.sin(angle) + (point.y - centerY) * Math.cos(angle)) / radius,
  }));
  const side = local.reduce((sum, point) => sum + point.y, 0) >= 0 ? 1 : -1;
  for (let index = 4; index < smoothed.length - 4; index++) {
    if (Math.abs(local[index].x) > 0.75 || local[index].y * side < 0.3) continue;
    const before = smoothed[index - 4];
    const point = smoothed[index];
    const after = smoothed[index + 4];
    const incomingX = point.x - before.x;
    const incomingY = point.y - before.y;
    const outgoingX = after.x - point.x;
    const outgoingY = after.y - point.y;
    const product = Math.hypot(incomingX, incomingY) * Math.hypot(outgoingX, outgoingY);
    if (product > 0 && (incomingX * outgoingX + incomingY * outgoingY) / product < 0.5) return null;
  }
  const sectors = new Set<number>();
  const radialTolerance = closed ? 0.25 : 0.35;
  let error = 0;
  let diameterSamples = 0;
  for (const point of local) {
    const radialError = Math.abs(Math.hypot(point.x, point.y) - 1);
    const onDiameter = closed && Math.abs(point.x) < 0.8 && Math.abs(point.y) < 0.1;
    const deviation = closed ? Math.min(radialError, Math.hypot(Math.max(0, Math.abs(point.x) - 1), point.y)) : radialError;
    if (point.y * side < -0.12 || deviation > radialTolerance) return null;
    error += deviation;
    if (onDiameter) diameterSamples++;
    else if (radialError < (closed ? 0.2 : radialTolerance) && point.y * side >= 0) sectors.add(Math.min(5, Math.floor(Math.atan2(point.y * side, point.x) / Math.PI * 6)));
  }
  if (error / local.length > (closed ? 0.105 : 0.17) || sectors.size < 6 || (closed && diameterSamples < samples.length * 0.15)) return null;
  return {
    content: closed ? 'semicircle-closed' : 'semicircle-open',
    x: centerX - Math.sin(angle) * side * radius / 2,
    y: centerY + Math.cos(angle) * side * radius / 2,
    width: radius * 2, height: radius,
    rotation: (angle + (side > 0 ? Math.PI : 0)) * 180 / Math.PI,
  };
}

export function recognizeShape(input: StrokePoint[]): QuickShape | null {
  if (input.length < 8) return null;
  const points = input.filter((point, index) => !index || Math.hypot(point.x - input[index - 1].x, point.y - input[index - 1].y) > 0.1);
  if (points.length < 8) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const distance = Math.hypot(last.x - first.x, last.y - first.y);
  const length = points.reduce((sum, point, index) => index ? sum + Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) : 0, 0);
  if (distance > 16 && length < distance * 1.18 && points.every(point => Math.abs((point.x - first.x) * (last.y - first.y) - (point.y - first.y) * (last.x - first.x)) / distance < Math.max(3, distance * 0.055))) {
    return { content: 'line', x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, width: distance, height: 0, rotation: Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI };
  }
  const semicircle = recognizeSemicircle(points, length, distance);
  if (semicircle) return semicircle;
  if (length < 60) return null;
  let best: { angle: number; left: number; top: number; width: number; height: number; local: StrokePoint[] } | undefined;
  for (let degrees = 0; degrees < 90; degrees += 2) {
    const angle = degrees * Math.PI / 180;
    const local = points.map(point => ({ x: point.x * Math.cos(angle) + point.y * Math.sin(angle), y: -point.x * Math.sin(angle) + point.y * Math.cos(angle) }));
    const left = Math.min(...local.map(point => point.x));
    const top = Math.min(...local.map(point => point.y));
    const width = Math.max(...local.map(point => point.x)) - left;
    const height = Math.max(...local.map(point => point.y)) - top;
    if (!best || width * height < best.width * best.height) best = { angle, local, left, top, width, height };
  }
  if (!best || Math.min(best.width, best.height) < 12 || distance > Math.max(best.width, best.height) * 0.25) return null;
  const { angle, local, left, top } = best;
  let { width, height } = best;
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  let rectangleError = 0;
  let ellipseError = 0;
  for (const point of local) {
    const horizontal = Math.abs((point.x - centerX) / (width / 2));
    const vertical = Math.abs((point.y - centerY) / (height / 2));
    rectangleError += Math.min(Math.abs(horizontal - 1), Math.abs(vertical - 1));
    ellipseError += Math.abs(Math.hypot(horizontal, vertical) - 1);
  }
  let content: QuickShape['content'] = rectangleError < ellipseError ? 'rect' : 'ellipse';
  if (Math.min(rectangleError, ellipseError) / local.length > 0.13) return null;
  const perimeter = content === 'rect' ? 2 * (width + height) : Math.PI * (3 * (width + height) - Math.sqrt((3 * width + height) * (width + 3 * height))) / 2;
  if (length / perimeter < 0.72 || length / perimeter > 1.4) return null;
  const aspectDifference = Math.abs(width - height) / Math.max(width, height);
  if (content === 'ellipse' && aspectDifference < 0.06) {
    content = 'circle';
    width = height = (width + height) / 2;
  } else if (content === 'rect' && aspectDifference < 0.12) width = height = (width + height) / 2;
  return { content, width, height, x: centerX * Math.cos(angle) - centerY * Math.sin(angle), y: centerX * Math.sin(angle) + centerY * Math.cos(angle), rotation: angle * 180 / Math.PI };
}