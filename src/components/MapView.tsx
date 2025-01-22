import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from './ui/use-toast';

interface Stop {
  id: string;
  name: string;
  coordinates: [number, number];
}

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isTokenSet, setIsTokenSet] = useState(false);

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
      addStop({
        id: Date.now().toString(),
        name: `Stop ${stops.length + 1}`,
        coordinates: [e.lngLat.lng, e.lngLat.lat]
      });
    });
  };

  const addStop = (newStop: Stop) => {
    setStops(prev => {
      const updated = [...prev, newStop];
      updateRoute(updated);
      return updated;
    });
    toast({
      title: "Stop Added",
      description: `Added ${newStop.name} to your route`
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
      name: `Suggested Stop ${stops.length + 1}`,
      coordinates: midpoint
    });
  };

  useEffect(() => {
    if (isTokenSet) {
      initializeMap();
    }
  }, [isTokenSet]);

  if (!isTokenSet) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 space-y-4">
        <div className="glass-panel p-6 rounded-lg max-w-md w-full space-y-4">
          <h2 className="text-xl font-semibold text-center">Enter Mapbox Token</h2>
          <Input
            type="text"
            placeholder="Enter your Mapbox token"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
            className="w-full"
          />
          <Button 
            onClick={() => setIsTokenSet(true)}
            className="w-full"
            disabled={!mapboxToken}
          >
            Set Token
          </Button>
          <p className="text-sm text-gray-500 text-center">
            You can find your Mapbox token in your Mapbox account dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="w-1/4 p-4 glass-panel m-4 rounded-lg space-y-4 overflow-y-auto">
        <h2 className="text-xl font-semibold">Your Road Trip</h2>
        <div className="space-y-2">
          {stops.map((stop, index) => (
            <div key={stop.id} className="flex items-center justify-between p-2 bg-white/50 rounded-lg">
              <span>{stop.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeStop(stop.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button 
          onClick={suggestStop}
          className="w-full"
          disabled={stops.length < 1}
        >
          Suggest Next Stop
        </Button>
      </div>
      <div className="flex-1 p-4">
        <div ref={mapContainer} className="map-container h-full" />
      </div>
    </div>
  );
};

export default MapView;