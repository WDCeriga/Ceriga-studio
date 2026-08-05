/** How the user started or last edited the project — drives “Open / Continue” links. */
export type ProjectFlowType = 'techpack' | 'packaging' | 'manufacturer';

export function builderPath(
  productId: string,
  flow: ProjectFlowType,
  projectId?: string,
): string {
  let path: string;
  if (flow === 'packaging') {
    path = '/packaging';
  } else if (flow === 'manufacturer') {
    path = `/studio/manufacturer?productId=${encodeURIComponent(productId)}`;
  } else {
    path = `/builder/${productId}`;
  }

  if (!projectId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}projectId=${encodeURIComponent(projectId)}`;
}
