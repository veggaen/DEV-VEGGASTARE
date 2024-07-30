export const fetchAllCategories = async () => {
  const res = await fetch('/api/categories');
  if (!res.ok) {
    throw new Error('Failed to fetch categories');
  }
  const categories = await res.json();
  return categories;
};

export const fetchPriceRange = async () => {
  const res = await fetch('/api/price-range');
  if (!res.ok) {
    throw new Error('Failed to fetch price range');
  }
  const priceRange = await res.json();
  return priceRange;
};

export const fetchAllTitles = async () => {
  const res = await fetch('/api/titles');
  if (!res.ok) {
    throw new Error('Failed to fetch titles');
  }
  const titles = await res.json();
  return titles;
};