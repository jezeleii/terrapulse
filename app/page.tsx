"use client";
import React from 'react'
import dynamic from 'next/dynamic';
import MapLoading from './components/MapLoading';
import { Header } from './components/Header';

const Map = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function MapPage() {
  return (
    <div className="relative w-full h-screen isolate">
      <Map className="absolute inset-0 z-0" />
      <Header className="absolute inset-x-0 top-0 z-10" />
    </div>
  );
}
