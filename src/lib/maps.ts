import { loader } from './googleMapsLoader';

// Interface for geocoding results
interface GeocodingResult {
  formatted_address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  success: boolean;
  error?: string;
}

/**
 * Geocode an address to get coordinates and formatted address
 * @param address The address to geocode
 * @param postalCode Optional postal code to improve accuracy
 * @param city Optional city to improve accuracy
 * @returns Promise with geocoding result
 */
export const geocodeAddress = async (
  address: string,
  postalCode?: string,
  city?: string
): Promise<GeocodingResult> => {
  try {
    // Load Google Maps API
    const google = await loader.load();
    const geocoder = new google.maps.Geocoder();
    
    // Build full address string
    let fullAddress = address;
    if (postalCode) fullAddress += `, ${postalCode}`;
    if (city) fullAddress += `, ${city}`;
    
    // Perform geocoding
    const result = await geocoder.geocode({ address: fullAddress });
    
    if (result.results && result.results.length > 0) {
      const location = result.results[0].geometry.location;
      return {
        formatted_address: result.results[0].formatted_address,
        coordinates: {
          lat: location.lat(),
          lng: location.lng()
        },
        success: true
      };
    } else {
      return {
        formatted_address: `${address}, ${postalCode || ''} ${city || ''}`,
        coordinates: { lat: 0, lng: 0 },
        success: false,
        error: 'No results found for this address'
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    
    return {
      formatted_address: `${address}, ${postalCode || ''} ${city || ''}`,
      coordinates: { lat: 0, lng: 0 },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Initialize a map in the specified container
 * @param elementId The ID of the HTML element to contain the map
 * @param center The center coordinates for the map
 * @param zoom The zoom level
 * @returns The map instance
 */
export const initializeMap = async (
  elementId: string,
  center: { lat: number; lng: number },
  zoom: number = 13
): Promise<google.maps.Map> => {
  try {
    const google = await loader.load();
    
    const mapElement = document.getElementById(elementId);
    if (!mapElement) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }
    
    return new google.maps.Map(mapElement, {
      center,
      zoom,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });
  } catch (error) {
    console.error('Error initializing map:', error);
    
    // Create a fallback map element with an error message
    const mapElement = document.getElementById(elementId);
    if (mapElement) {
      mapElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background-color: #f0f0f0; color: #666; text-align: center; padding: 20px;">
          <div>
            <p>Map could not be loaded.</p>
            <p>Please check your Google Maps API key.</p>
          </div>
        </div>
      `;
    }
    
    // Return a mock map object to prevent errors
    return {
      setCenter: () => {},
      setZoom: () => {},
      controls: [],
      data: { add: () => {}, addGeoJson: () => {} },
      setOptions: () => {},
    } as unknown as google.maps.Map;
  }
};

/**
 * Add a marker to a map
 * @param map The map instance
 * @param position The marker position
 * @param title Optional marker title
 * @returns The marker instance
 */
export const addMarker = async (
  map: google.maps.Map,
  position: { lat: number; lng: number },
  title?: string
): Promise<google.maps.Marker> => {
  try {
    const google = await loader.load();
    
    return new google.maps.Marker({
      position,
      map,
      title,
      animation: google.maps.Animation.DROP
    });
  } catch (error) {
    console.error('Error adding marker:', error);
    // Return a mock marker object to prevent errors
    return { setMap: () => {}, setPosition: () => {} } as unknown as google.maps.Marker;
  }
};

/**
 * Add a circle to represent campaign radius
 * @param map The map instance
 * @param center The circle center
 * @param radius The radius in meters
 * @returns The circle instance
 */
export const addRadiusCircle = async (
  map: google.maps.Map,
  center: { lat: number; lng: number },
  radius: number
): Promise<google.maps.Circle> => {
  try {
    const google = await loader.load();
    
    return new google.maps.Circle({
      map,
      center,
      radius,
      strokeColor: '#6A1B9A',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#6A1B9A',
      fillOpacity: 0.2
    });
  } catch (error) {
    console.error('Error adding radius circle:', error);
    // Return a mock circle object to prevent errors
    return { setMap: () => {}, setCenter: () => {}, setRadius: () => {} } as unknown as google.maps.Circle;
  }
};