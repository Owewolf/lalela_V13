export const APP_LOGO_PATH = '/images/Lalela Favicon - White on Green.png';
export const APP_LOGO_ALT_PATH = '/images/Lalela Favicon - Green on Transparent.png';

export const POST_SUBTYPE_CONFIG = {
  emergency: { urgency: 'emergency' as const, urgency_level: 'emergency' as const },
  warning: { urgency: 'high' as const, urgency_level: 'warning' as const },
  normal: { urgency: 'normal' as const, urgency_level: 'general' as const },
  information: { urgency: 'low' as const, urgency_level: 'info' as const },
} as const;

export const BUSINESS_CATEGORIES = [
  { id: 'food', label: 'Food & Drink', icon: '🍔', types: ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'liquor_store'] },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', types: ['store', 'supermarket', 'clothing_store', 'department_store', 'electronics_store', 'furniture_store', 'hardware_store', 'home_goods_store', 'jewelry_store', 'shoe_store', 'shopping_mall', 'convenience_store'] },
  { id: 'automotive', label: 'Automotive', icon: '🚗', types: ['car_repair', 'gas_station', 'car_dealer', 'car_rental', 'car_wash'] },
  { id: 'health', label: 'Health', icon: '🏥', types: ['hospital', 'doctor', 'dentist', 'pharmacy', 'physiotherapist', 'gym', 'drugstore'] },
  { id: 'services', label: 'Professional', icon: '💼', types: ['bank', 'post_office', 'real_estate_agency', 'insurance_agency', 'lawyer', 'accounting', 'laundry', 'locksmith', 'moving_company', 'storage'] },
  { id: 'home', label: 'Home Services', icon: '🏠', types: ['electrician', 'plumber', 'painter', 'roofing_contractor'] },
  { id: 'beauty', label: 'Beauty & Spa', icon: '✨', types: ['beauty_salon', 'hair_care', 'spa'] },
  { id: 'entertainment', label: 'Entertainment', icon: '🎭', types: ['movie_theater', 'night_club', 'amusement_park', 'aquarium', 'art_gallery', 'bowling_alley', 'casino', 'museum', 'stadium', 'zoo', 'tourist_attraction'] },
  { id: 'travel', label: 'Travel & Stay', icon: '🏨', types: ['lodging', 'travel_agency', 'campground', 'rv_park'] },
  { id: 'education', label: 'Education', icon: '🎓', types: ['school', 'university', 'library', 'primary_school', 'secondary_school'] },
  { id: 'public', label: 'Public Services', icon: '🏛️', types: ['police', 'fire_station', 'city_hall', 'courthouse', 'embassy', 'local_government_office'] },
  { id: 'community', label: 'Community', icon: '⛪', types: ['church', 'mosque', 'synagogue', 'hindu_temple', 'cemetery'] },
  { id: 'transport', label: 'Transport', icon: '🚉', types: ['bus_station', 'train_station', 'subway_station', 'transit_station', 'taxi_stand', 'airport'] },
  { id: 'pets', label: 'Pets', icon: '🐾', types: ['pet_store', 'veterinary_care'] },
];
