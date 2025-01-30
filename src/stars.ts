export const starPacks = [
  { stars: 5, price: 5, label: '5 ⭐' },
  { stars: 10, price: 10, label: '10 ⭐' },
  { stars: 20, price: 20, label: '20 ⭐' },
  { stars: 50, price: 50, label: '50 ⭐' }
];

export const getStarPackLabel = (stars: number): string => {
  const pack = starPacks.find(p => p.stars === stars);
  return pack ? pack.label : `${stars} ⭐`;
};

export const formatPrice = (amount: number, currency: string = 'XTR'): string => {
  return `${amount} ${currency}`;
};