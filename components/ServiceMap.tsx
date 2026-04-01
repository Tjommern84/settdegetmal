'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import type { RankedService } from '../lib/matching';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'hue-rotate-[210deg]', // blue tint for user pin
});

function FitBounds({
  center,
  radiusKm,
}: {
  center: [number, number];
  radiusKm: number;
}) {
  const map = useMap();
  useEffect(() => {
    const radiusM = radiusKm * 1000;
    const bounds = L.latLng(center).toBounds(radiusM * 2.2);
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [center, radiusKm, map]);
  return null;
}

type Props = {
  center: { lat: number; lon: number };
  radiusKm: number;
  services: RankedService[];
  locationLabel?: string | null;
};

export default function ServiceMap({ center, radiusKm, services, locationLabel }: Props) {
  const centerLatLng: [number, number] = [center.lat, center.lon];
  const servicesWithCoords = services.filter((s) => s.lat != null && s.lon != null);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 360 }}>
      <MapContainer
        center={centerLatLng}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds center={centerLatLng} radiusKm={radiusKm} />

        {/* Radius circle */}
        <Circle
          center={centerLatLng}
          radius={radiusKm * 1000}
          pathOptions={{
            color: '#f43f5e',
            fillColor: '#f43f5e',
            fillOpacity: 0.06,
            weight: 1.5,
            opacity: 0.4,
          }}
        />

        {/* User location pin */}
        <Marker position={centerLatLng} icon={userIcon}>
          <Popup>
            <span className="font-medium">{locationLabel ?? 'Din lokasjon'}</span>
          </Popup>
        </Marker>

        {/* Service pins */}
        {servicesWithCoords.map((item) => (
          <Marker
            key={item.service.id}
            position={[item.lat!, item.lon!]}
          >
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-semibold text-sm leading-snug">{item.service.name}</p>
                {item.service.address && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.service.address}</p>
                )}
                {item.distanceKm != null && (
                  <p className="text-xs text-slate-400 mt-1">{item.distanceKm.toFixed(1)} km unna</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
