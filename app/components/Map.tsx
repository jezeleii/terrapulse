"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'mapbox-gl/dist/mapbox-gl.css';
import CountryPopup, { HoverInfo } from './CountryPopup';
import { NewsCallout } from './NewsCallout';
import { Source, Layer, MapRef, MapLayerMouseEvent } from 'react-map-gl';

// Dynamically import the Map component
const ReactMap = dynamic(
  () => import('react-map-gl').then(mod => mod.Map),
  { ssr: false }
);

const initialView = {
  longitude: 0,
  latitude: 80,
  zoom: 0.01
}

export default function WorldMap({ className = '', ...props}) {
  const [primaryColor, setPrimaryColor] = useState<string>('');
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [clickedInfo, setClickedInfo] = useState<HoverInfo | null>(null);
  const mapRef = useRef<MapRef>(null);
  
  useEffect(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const color = rootStyle.getPropertyValue('--color-primary').trim();
    setPrimaryColor(color || '#85e5e0');
  }, []);

  const lastCountry = useRef<string | null>(null);

  // Debounced hover handler to avoid jitter
  const handleHover = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const name = feature?.properties?.name_en;
    if (feature && name && name !== lastCountry.current) {
      lastCountry.current = name;
      setHoverInfo({
        country: name,
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat
      });
    }
  }, []);

  const handleClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const name = feature?.properties?.name_en; 
    if (feature && name) {
      // If clicking the same country again, deselect it
      if (clickedInfo?.country === name) {
        setClickedInfo(null);
      } else {
        setClickedInfo({
          country: name, 
          longitude: event.lngLat.lng, 
          latitude: event.lngLat.lat,
        });
      }
    } else {
      // Clicked outside a country - clear selection
      setClickedInfo(null);
    }
  }, [clickedInfo]);

  const onMouseMove = (e: MapLayerMouseEvent) => handleHover(e);
  const onMouseLeave = () => { 
    lastCountry.current = null; 
    setHoverInfo(null); 
  };

  // Layer definitions
  const countrySource = {
    id: 'countries',
    type: 'vector',
    url: 'mapbox://mapbox.country-boundaries-v1'
  } as const;

  const fillLayer = {
    id: 'country-fill',
    type: 'fill',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: { 'fill-color': '#ffffff', 'fill-opacity': 0 }
  } as const;

  const highlightLayer = {
    id: 'country-highlight',
    type: 'fill',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: {
      'fill-color': '#7ef6e0',
      'fill-opacity': 0.3,
      'fill-outline-color': '#ffffff'
    },
    filter: ['any',
      hoverInfo ? ['==', ['get', 'name_en'], hoverInfo.country] : ['==', ['get', 'name_en'], ''],
      clickedInfo ? ['==', ['get', 'name_en'], clickedInfo.country] : ['==', ['get', 'name_en'], '']
    ]
  } as any;

  const borderLayer = {
    id: 'country-borders',
    type: 'line',
    source: 'countries',
    'source-layer': 'country_boundaries',
    paint: { 'line-color': primaryColor, 'line-width': 1, 'line-opacity': 0.75 },
  } as const;

  return (
    <div className="relative h-full w-full bg-[var(--color-background)] overflow-hidden">
      <ReactMap
        ref={mapRef}
        initialViewState={initialView}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        interactiveLayerIds={[fillLayer.id]}
        scrollZoom={true}
        dragPan={true}
        onClick={handleClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        renderWorldCopies={false}
        doubleClickZoom={false} 
      >
        <Source {...countrySource} />
        <Layer {...fillLayer} />
        <Layer {...highlightLayer} />
        <CountryPopup hoverInfo={hoverInfo} />
        <Layer {...borderLayer} />
      </ReactMap>
      
      {hoverInfo && (
        <NewsCallout
          country={hoverInfo.country}
          side="right"
          isOpen={!!hoverInfo}
          onClose={() => setHoverInfo(null)} 
          children={undefined}        
        />
      )}
      
      {clickedInfo && (
        <NewsCallout
          country={clickedInfo.country}
          side="right"
          isOpen={!!clickedInfo}
          onClose={() => setClickedInfo(null)}
          children={undefined}
        />
      )}
    </div>
  );
}