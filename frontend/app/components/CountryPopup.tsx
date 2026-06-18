"use client";

import React from 'react';
import { Popup } from 'react-map-gl';

export interface HoverInfo {
  country: string;
  longitude: number;
  latitude: number;
}

interface CountryPopupProps {
  hoverInfo: HoverInfo | null;
}

export default function CountryPopup({ hoverInfo }: CountryPopupProps) {
  if (!hoverInfo) return null;

  return (
    <>
      <Popup
        longitude={hoverInfo.longitude}
        latitude={hoverInfo.latitude}
        closeButton={false}
        closeOnClick={false}
        anchor="top"
        offset={[0, -10]}
        className="!bg-transparent !border-none !shadow-none"
      >
        <div className="relative inline-block">
          <div className="relative bg-primary/20 backdrop-blur-md border border-primary/50 rounded-full px-8 py-4 text-[var(--color-primary)] font-semibold text-xl">
            {hoverInfo.country}
          </div>
        </div>
      </Popup>
      <style jsx global>{` 
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
        }
        .mapboxgl-popup-tip {
          display: none !important;
        }
      `}</style>
    </>
  );
}