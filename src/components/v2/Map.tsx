'use client';

// Map screen — the map is the hero (full-bleed), UI floats over it in pills / FABs / a stat card
// (design-language.md "The map is the hero"). Real Leaflet canvas underneath; concept chrome on top.
// Phase-1 foundation: live view + zoom FABs wired. Editing tools (RevLaw port) land in later phases.
import {Button} from '@/components/v2/ui/Button';
import {Fab} from '@/components/v2/ui/Fab';
import {OverlayChip} from '@/components/v2/ui/OverlayChip';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {StatCard} from '@/components/v2/ui/StatCard';
import type {Map as LeafletMap} from 'leaflet';
import {Layers, Locate, Minus, Plus, Square} from 'lucide-react';
import dynamic from 'next/dynamic';
import {useRef} from 'react';

const MapCanvas = dynamic(() => import('@/components/v2/map/MapCanvas').then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

const MOW = {area: 'Etupiha', coverage: 62, timeLeftMin: 24};

export function Map() {
  const mapRef = useRef<LeafletMap | null>(null);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas className="absolute inset-0 h-full w-full" onReady={(m) => (mapRef.current = m)} />

      {/* top status pills */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-center gap-2">
        <OverlayChip>
          <span className="text-accent">●</span> Mowing
        </OverlayChip>
        <OverlayChip>{MOW.area}</OverlayChip>
        <OverlayChip className="ml-auto">
          <span className="text-accent">●</span> RTK fixed
        </OverlayChip>
      </div>

      {/* map FABs */}
      <div className="absolute right-3 top-16 z-[500] flex flex-col gap-2">
        <Fab aria-label="Recenter on robot" icon={<Locate size={18} />} onClick={() => mapRef.current?.setZoom(19)} />
        <Fab aria-label="Base map" icon={<Layers size={18} />} />
        <Fab aria-label="Zoom in" icon={<Plus size={18} />} onClick={() => mapRef.current?.zoomIn()} />
        <Fab aria-label="Zoom out" icon={<Minus size={18} />} onClick={() => mapRef.current?.zoomOut()} />
      </div>

      {/* floating stat card */}
      <StatCard className="absolute inset-x-3 bottom-3 z-[500] md:left-3 md:right-auto md:w-[320px]">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 leading-tight">
            <div className="text-[.92rem] font-semibold text-ink">Mowing {MOW.area}</div>
            <div className="text-[.76rem] text-ink-soft">
              {MOW.coverage}% · {MOW.timeLeftMin} min left
            </div>
          </div>
        </div>
        <ProgressBar value={MOW.coverage} className="mt-2.5" />
        <Button variant="danger" className="mt-2.5 w-full justify-center">
          <Square size={13} fill="currentColor" /> Stop &amp; hold position
        </Button>
      </StatCard>
    </div>
  );
}
