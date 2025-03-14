import { useState, useEffect, useRef } from 'react';
import { loader } from '../lib/googleMapsLoader';
import toast from 'react-hot-toast';

interface AddressAutocompleteProps {
  onAddressSelect: (address: {
    formattedAddress: string;
    streetAddress: string;
    postalCode: string;
    city: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  }) => void;
  initialAddress?: string;
  initialPostalCode?: string;
  initialCity?: string;
  className?: string;
  placeholder?: string;
}

// Generate deterministic mock coordinates based on address
const generateMockCoordinates = (
  streetAddress: string,
  postalCode: string,
  city: string
) => {
  // Simple hash function to generate deterministic coordinates
  const hash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };
  
  const addressHash = hash(`${streetAddress}${postalCode}${city}`);
  
  // Helsinki coordinates as base
  const lat = 60.1699 + (addressHash % 100) / 1000;
  const lng = 24.9384 + (addressHash % 100) / 1000;
  
  return { lat, lng };
};

const AddressAutocomplete = ({
  onAddressSelect,
  initialAddress = '',
  initialPostalCode = '',
  initialCity = '',
  className = '',
  placeholder = 'Enter address'
}: AddressAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(initialAddress);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempted, setLoadAttempted] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is not configured');
      setIsLoaded(true);
      setLoadAttempted(true);
      return;
    }

    if (loadAttempted) return;

    setLoadAttempted(true);
    loader.load()
      .then(() => {
        setIsLoaded(true);
        setError(null);
        
        // Initialize autocomplete after successful load
        if (inputRef.current) {
          try {
            autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
              types: ['address'],
              fields: ['address_components', 'formatted_address', 'geometry'],
              componentRestrictions: { country: 'fi' }
            });
            
            // Add listener for place selection
            autocompleteRef.current.addListener('place_changed', handlePlaceSelect);
          } catch (err) {
            console.error('Error initializing autocomplete:', err);
            setError('Failed to initialize address autocomplete');
          }
        }
      })
      .catch(err => {
        console.error('Error loading Google Maps API:', err);
        setError('Failed to load Google Maps API. Using manual input mode.');
        setIsLoaded(true);
        toast.error('Failed to load address autocomplete');
      });
  }, [loadAttempted]);
  
  const handlePlaceSelect = () => {
    try {
      const place = autocompleteRef.current?.getPlace();
      
      if (!place || !place.address_components) {
        console.error('Invalid place selected');
        handleManualAddressInput();
        return;
      }
      
      // Extract address components
      let streetNumber = '';
      let route = '';
      let postalCode = '';
      let city = '';
      
      place.address_components.forEach(component => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          streetNumber = component.long_name;
        } else if (types.includes('route')) {
          route = component.long_name;
        } else if (types.includes('postal_code')) {
          postalCode = component.long_name;
        } else if (types.includes('locality') || types.includes('postal_town')) {
          city = component.long_name;
        }
      });
      
      const streetAddress = streetNumber ? `${route} ${streetNumber}` : route;
      
      // Use place geometry if available, otherwise generate mock coordinates
      const coordinates = place.geometry?.location ? {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      } : generateMockCoordinates(streetAddress, postalCode, city);
      
      onAddressSelect({
        formattedAddress: place.formatted_address || `${streetAddress}, ${postalCode} ${city}`,
        streetAddress,
        postalCode,
        city,
        coordinates
      });
    } catch (err) {
      console.error('Error handling place selection:', err);
      handleManualAddressInput();
    }
  };
  
  // Update input value when initialAddress changes
  useEffect(() => {
    if (initialAddress) {
      setInputValue(initialAddress);
    }
  }, [initialAddress]);
  
  // Handle manual address input when API fails
  const handleManualAddressInput = () => {
    // Parse the input value to extract address components
    const addressParts = inputValue.split(',').map(part => part.trim());
    
    let streetAddress = addressParts[0] || initialAddress || '';
    let postalCode = '';
    let city = '';
    
    // Try to extract postal code and city from the second part
    if (addressParts.length > 1) {
      const secondPart = addressParts[1];
      const postalMatch = secondPart.match(/\d{5}/);
      
      if (postalMatch) {
        postalCode = postalMatch[0];
        city = secondPart.replace(postalCode, '').trim();
      } else {
        city = secondPart;
      }
    }
    
    // Use initial values as fallbacks
    postalCode = postalCode || initialPostalCode || '';
    city = city || initialCity || '';
    
    // Generate mock coordinates
    const coordinates = generateMockCoordinates(streetAddress, postalCode, city);
    
    onAddressSelect({
      formattedAddress: `${streetAddress}, ${postalCode} ${city}`,
      streetAddress,
      postalCode,
      city,
      coordinates
    });
  };
  
  // Handle manual form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleManualAddressInput();
  };
  
  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${className}`}
          disabled={!isLoaded}
        />
        {error && (
          <p className="mt-1 text-xs text-amber-500">{error}</p>
        )}
        {!isLoaded && !error && (
          <p className="mt-1 text-xs text-gray-500">Loading address autocomplete...</p>
        )}
        {!autocompleteRef.current && isLoaded && (
          <button 
            type="submit" 
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
          >
            Validate
          </button>
        )}
      </div>
    </form>
  );
};

export default AddressAutocomplete;