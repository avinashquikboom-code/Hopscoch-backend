export const DEFAULT_SELLER_CONFIG = {
  name: 'Fashion City India Ltd',
  legalName: 'Fashion City India Ltd',
  gstin: '24GUKPS9446A1ZA',
  supportEmail: 'fashioncityinidia18@gmail.com',
  address: 'F/7 Jethabhai Park, Narayan Nagar Road, Paldi',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '380007',
  country: 'India',
  fullAddress: 'F/7 Jethabhai Park, Narayan Nagar Road, Paldi, Ahmedabad, Gujarat - 380007, India',
  contactNumber: '+91 96015 11596',
};

export function normalizeSellerName(name?: string | null): string {
  if (!name || typeof name !== 'string') return DEFAULT_SELLER_CONFIG.name;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'fci' ||
    lower === 'fci seller' ||
    lower === 'fci-seller' ||
    lower === 'fciseller' ||
    lower === 'fci ecommerce'
  ) {
    return DEFAULT_SELLER_CONFIG.name;
  }
  return trimmed;
}

