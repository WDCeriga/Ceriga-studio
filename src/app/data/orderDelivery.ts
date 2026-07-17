/** Shared delivery address shape from brand checkout / Delivery page. */

export type OrderDeliveryInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  country: string;
  instructions?: string;
};

export type OrderTechPackLink = {
  id: string;
  name: string;
  garmentType: string;
  builderProductId: string;
  projectId: string;
  exportFormat?: 'pdf' | 'pdf_bundle';
  pageCount?: number;
};

export function builderTechPackUrl(techPack: OrderTechPackLink): string {
  const params = new URLSearchParams({ project: techPack.projectId });
  return `/builder/${techPack.builderProductId}?${params.toString()}`;
}

export function formatDeliveryLines(d: OrderDeliveryInfo): string[] {
  return [
    d.address1,
    d.address2,
    `${d.city}${d.postcode ? ` ${d.postcode}` : ''}`.trim(),
    d.country,
  ].filter((x): x is string => Boolean(x && String(x).trim()));
}

export function mockDelivery(partial: {
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  country: string;
  phone?: string;
  address1?: string;
  address2?: string;
  postcode?: string;
  instructions?: string;
}): OrderDeliveryInfo {
  const postcodes: Record<string, string> = {
    UK: 'M1 2AB',
    US: '10001',
    DE: '10115',
    NL: '1012 AB',
    CA: 'M5V 2T6',
    AU: '2000',
    EU: '10115',
  };
  return {
    firstName: partial.firstName,
    lastName: partial.lastName,
    email: partial.email,
    phone: partial.phone ?? '+44 7700 900123',
    address1: partial.address1 ?? '14 Commerce Street',
    address2: partial.address2 ?? 'Suite 2',
    city: partial.city,
    postcode: partial.postcode ?? postcodes[partial.country] ?? '00000',
    country: partial.country,
    instructions: partial.instructions,
  };
}
