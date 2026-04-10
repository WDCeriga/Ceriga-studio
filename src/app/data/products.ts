export interface Product {
  id: string;
  name: string;
  description: string;
  categories: string[];
  garmentType: 'tshirt' | 'hoodie' | 'sweatshirt' | 'trousers' | 'shorts' | 'jacket' | 'dress' | 'skirt';
  image: string;
  moq: number;
  startingPrice: number;
  leadTime: string;
  origin: string;
}

export const products: Product[] = [
  {
    id: 'ts-001',
    name: 'Premium Cotton T-Shirt',
    description: 'High-quality cotton tee with customizable fit and construction',
    categories: ['Tops', 'All'],
    garmentType: 'tshirt',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=600&fit=crop',
    moq: 50,
    startingPrice: 12.99,
    leadTime: '4-6 weeks',
    origin: 'Made in Portugal'
  },
  {
    id: 'hd-001',
    name: 'Classic Pullover Hoodie',
    description: 'Versatile hoodie with multiple hood and closure options',
    categories: ['Tops', 'Outerwear', 'All'],
    garmentType: 'hoodie',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=600&fit=crop',
    moq: 100,
    startingPrice: 28.50,
    leadTime: '6-8 weeks',
    origin: 'Made in Portugal'
  },
  {
    id: 'sw-001',
    name: 'French Terry Sweatshirt',
    description: 'Premium sweatshirt with refined details',
    categories: ['Tops', 'All'],
    garmentType: 'sweatshirt',
    image: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800&h=600&fit=crop',
    moq: 75,
    startingPrice: 22.00,
    leadTime: '4-6 weeks',
    origin: 'Made in Portugal'
  },
  {
    id: 'tr-001',
    name: 'Performance Joggers',
    description: 'Comfortable joggers with adjustable waist and pockets',
    categories: ['Bottoms', 'All'],
    garmentType: 'trousers',
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=600&fit=crop',
    moq: 100,
    startingPrice: 26.00,
    leadTime: '6-8 weeks',
    origin: 'Made in Turkey'
  },
  {
    id: 'sh-001',
    name: 'Athletic Shorts',
    description: 'Versatile shorts for active and casual wear',
    categories: ['Bottoms', 'All'],
    garmentType: 'shorts',
    image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&h=600&fit=crop',
    moq: 75,
    startingPrice: 16.50,
    leadTime: '4-6 weeks',
    origin: 'Made in Turkey'
  },
  {
    id: 'jk-001',
    name: 'Lightweight Bomber Jacket',
    description: 'Modern bomber with customizable collar and zip options',
    categories: ['Outerwear', 'All'],
    garmentType: 'jacket',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=600&fit=crop',
    moq: 100,
    startingPrice: 42.00,
    leadTime: '8-10 weeks',
    origin: 'Made in Portugal'
  },
  {
    id: 'dr-001',
    name: 'Casual Midi Dress',
    description: 'Comfortable dress with multiple neckline and sleeve options',
    categories: ['Dresses', 'All'],
    garmentType: 'dress',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=600&fit=crop',
    moq: 50,
    startingPrice: 24.00,
    leadTime: '6-8 weeks',
    origin: 'Made in Portugal'
  },
  {
    id: 'sk-001',
    name: 'A-Line Skirt',
    description: 'Versatile skirt with waist and hem customization',
    categories: ['Bottoms', 'All'],
    garmentType: 'skirt',
    image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&h=600&fit=crop',
    moq: 50,
    startingPrice: 18.00,
    leadTime: '4-6 weeks',
    origin: 'Made in Turkey'
  }
];

export const getProductById = (id: string): Product | undefined => {
  return products.find(p => p.id === id);
};

export const getProductsByCategory = (category: string): Product[] => {
  if (category === 'All') return products;
  return products.filter(p => p.categories.includes(category));
};
