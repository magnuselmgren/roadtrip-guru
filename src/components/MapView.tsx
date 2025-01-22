import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from './ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Search } from 'lucide-react';

interface Stop {
  id: string;
  name: string;
  coordinates: [number, number];
}

interface SearchResult {
  place_name: string;
  center: [number, number];
}

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isTokenSet, setIsTokenSet] = useState(false);
  const [newStopName, setNewStopName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [18.0686, 59.3293], // Stockholm
      zoom: 5
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('click', (e) => {
      if (newStopName) {
        addStop({
          id: Date.now().toString(),
          name: newStopName,
          coordinates: [e.lngLat.lng, e.lngLat.lat]
        });
        setNewStopName('');
      } else {
        toast({
          title: "Ange ett namn",
          description: "Vänligen ange ett namn för stoppet först"
        });
      }
    });
  };

  const searchLocations = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=se`
      );
      const data = await response.json();
      setSearchResults(data.features.map((feature: any) => ({
        place_name: feature.place_name,
        center: feature.center
      })));
    } catch (error) {
      console.error('Error searching locations:', error);
      toast({
        title: "Sökfel",
        description: "Kunde inte söka efter platser just nu"
      });
    }
  };

  const handleSearchSelect = (result: SearchResult) => {
    if (newStopName) {
      addStop({
        id: Date.now().toString(),
        name: newStopName,
        coordinates: result.center
      });
      setNewStopName('');
      setSearchQuery('');
      setSearchResults([]);
      
      if (map.current) {
        map.current.flyTo({
          center: result.center,
          zoom: 12
        });
      }
    } else {
      toast({
        title: "Ange ett namn",
        description: "Vänligen ange ett namn för stoppet först"
      });
    }
  };

  const addStop = (newStop: Stop) => {
    setStops(prev => {
      const updated = [...prev, newStop];
      updateRoute(updated);
      return updated;
    });
    toast({
      title: "Stopp tillagt",
      description: `${newStop.name} har lagts till i din rutt`
    });
  };

  const removeStop = (id: string) => {
    setStops(prev => {
      const updated = prev.filter(stop => stop.id !== id);
      updateRoute(updated);
      return updated;
    });
  };

  const updateRoute = async (currentStops: Stop[]) => {
    if (!map.current || currentStops.length < 2) return;

    const coordinates = currentStops.map(stop => stop.coordinates).join(';');
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&access_token=${mapboxToken}`
    );
    const data = await response.json();

    if (map.current.getSource('route')) {
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: data.routes[0].geometry
      });
    } else {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: data.routes[0].geometry
        }
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#000',
          'line-width': 4,
          'line-opacity': 0.75
        }
      });
    }
  };

  const suggestStop = async () => {
    if (stops.length < 2) return;
    
    const lastStop = stops[stops.length - 1];
    const midpoint: [number, number] = [
      lastStop.coordinates[0] + 2,
      lastStop.coordinates[1]
    ];
    
    addStop({
      id: Date.now().toString(),
      name: `Föreslaget stopp ${stops.length + 1}`,
      coordinates: midpoint
    });
  };

  useEffect(() => {
    if (isTokenSet) {
      initializeMap();
    }
  }, [isTokenSet]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        searchLocations(searchQuery);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  if (!isTokenSet) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 space-y-4">
        <div className="glass-panel p-6 rounded-lg max-w-md w-full space-y-4">
          <h2 className="text-xl font-semibold text-center">Ange Mapbox Token</h2>
          <Input
            type="text"
            placeholder="Ange din Mapbox token"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
            className="w-full"
          />
          <Button 
            onClick={() => setIsTokenSet(true)}
            className="w-full"
            disabled={!mapboxToken}
          >
            Sätt token
          </Button>
          <p className="text-sm text-gray-500 text-center">
            Du hittar din Mapbox token i din Mapbox kontrollpanel
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="w-1/4 p-4 glass-panel m-4 rounded-lg space-y-4 overflow-y-auto">
        <h2 className="text-xl font-semibold">Din bilsemester</h2>
        
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Ange namn på stopp"
            value={newStopName}
            onChange={(e) => setNewStopName(e.target.value)}
            className="w-full"
          />
          <div className="relative">
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Sök plats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
              <Button variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                    onClick={() => handleSearchSelect(result)}
                  >
                    {result.place_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Klicka på kartan eller sök efter en plats för att lägga till ett stopp
          </p>
        </div>

        <div className="space-y-2">
          {stops.map((stop, index) => (
            <div key={stop.id} className="flex items-center justify-between p-2 bg-white/50 rounded-lg">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    {stop.name}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  <DropdownMenuItem onClick={() => removeStop(stop.id)}>
                    Ta bort stopp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>

        <Button 
          onClick={suggestStop}
          className="w-full"
          disabled={stops.length < 1}
        >
          Föreslå nästa stopp
        </Button>
      </div>
      <div className="flex-1 p-4">
        <div ref={mapContainer} className="map-container h-full rounded-lg" />
      </div>
    </div>
  );
};

export default MapView;
