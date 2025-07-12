"use client";
import dynamic from 'next/dynamic';
import MapLoading from './components/MapLoading';
import { Header } from './components/Header';

const Map = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function MapPage() {
  return (
   <>
    <div className="flex flex-col min-h-screen">
      <Header/>
      <main className="flex-1">
        <div className="relative w-full h-[calc(100vh-24rem)]">
          <Map/>
        </div>
      </main>
    </div>
   </>
  );
}