export const MAP_DEFAULT_CENTER = { lat: 17.4300, lng: 78.4400 }; // Hyderabad fallback
export const MAP_DEFAULT_ZOOM = 12;

export const CITY_MAP_CONFIG: Record<string, { lat: number; lng: number; zoom: number }> = {
  'All Cities': { lat: 20.5937, lng: 78.9629, zoom: 5 }, // India Center
  'Hyderabad': { lat: 17.3850, lng: 78.4867, zoom: 11 },
  'Mumbai': { lat: 19.0760, lng: 72.8777, zoom: 11 },
  'Chennai': { lat: 13.0827, lng: 80.2707, zoom: 11 },
  'Delhi': { lat: 28.7041, lng: 77.1025, zoom: 10 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946, zoom: 11 },
  'Kolkata': { lat: 22.5726, lng: 88.3639, zoom: 11 }
};

export const HYDERABAD_COORDINATES = {
  BANJARA_HILLS: { lat: 17.4102, lng: 78.4482 },
  JUBILEE_HILLS: { lat: 17.4325, lng: 78.4071 },
  GACHIBOWLI: { lat: 17.4401, lng: 78.3489 },
  KONDAPUR: { lat: 17.4600, lng: 78.3626 },
  MADHAPUR: { lat: 17.4485, lng: 78.3908 },
  KUKATPALLY: { lat: 17.4849, lng: 78.4138 },
  SECUNDERABAD: { lat: 17.4399, lng: 78.4983 },
  LB_NAGAR: { lat: 17.3483, lng: 78.5481 },
};
