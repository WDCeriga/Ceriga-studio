/** How the user started or last edited the project — drives “Open / Continue” links. */
export type ProjectFlowType = 'techpack' | 'packaging' | 'manufacturer';

export function builderPath(productId: string, flow: ProjectFlowType): string {
  if (flow === 'packaging') {
    return '/packaging';
  }
  if (flow === 'manufacturer') {
    return `/studio/manufacturer?productId=${encodeURIComponent(productId)}`;
  }
  return `/builder/${productId}`;
}
