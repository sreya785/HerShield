import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import L from 'leaflet';
import { Layers, RotateCcw } from 'lucide-react';
import { CampusSector, IncidentReport } from '../types/safety';
import { CAMPUS_SECTORS } from '../utils/safetyEngine';

interface CampusMapProps {
  selectedSectorId: string;
  onSelectSector: (sectorId: string, customCoords?: { lat: number; lng: number }) => void;
  incidents: IncidentReport[];
  customCoords?: { lat: number; lng: number } | null;
  interactiveCoords?: boolean;
  highlightedRouteSectorIds?: string[];
}

const CAMPUS_CENTER: [number, number] = [23.8777, 90.3209];
const DEFAULT_ZOOM = 16;

const TILE_URLS = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  street: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
} as const;

const MAP_SHORT_NAMES: Record<string, string> = {
  'sector-main-gate': 'Main Gate',
  'sector-central-library': 'Central Library',
  'sector-engineering-block': 'Engineering Labs',
  'sector-south-dorms': 'South Dorms',
  'sector-transit-hub': 'Shuttle Terminal',
  'sector-west-walkway': 'West Lakefront',
  'sector-parking-c': 'North Lot C',
};

export function CampusMap({
  selectedSectorId,
  onSelectSector,
  incidents,
  customCoords,
  interactiveCoords = false,
  highlightedRouteSectorIds = [],
}: CampusMapProps) {
  const [basemap, setBasemap] = useState<'dark' | 'street'>('dark');

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  const activeIncidents = useMemo(
    () => incidents.filter((i) => i.status !== 'Resolved'),
    [incidents]
  );

  const routePoints = useMemo(
    () =>
      highlightedRouteSectorIds
        .map((id) => CAMPUS_SECTORS.find((s) => s.id === id))
        .filter((s): s is CampusSector => Boolean(s)),
    [highlightedRouteSectorIds]
  );

  // Refs for latest reactive state inside Leaflet event listeners
  const stateRef = useRef({
    selectedSectorId,
    activeIncidents,
    customCoords,
    interactiveCoords,
    routePoints,
    onSelectSector,
  });
  stateRef.current = {
    selectedSectorId,
    activeIncidents,
    customCoords,
    interactiveCoords,
    routePoints,
    onSelectSector,
  };

  const renderOverlay = useCallback((animateData: boolean) => {
    const map = mapRef.current;
    const svgEl = svgRef.current;
    const wrapperEl = wrapperRef.current;
    if (!map || !svgEl || !wrapperEl) return;

    const width = wrapperEl.clientWidth;
    const height = wrapperEl.clientHeight;
    if (width <= 0 || height <= 0) return;

    const {
      selectedSectorId: curSelectedId,
      activeIncidents: curActive,
      customCoords: curCustom,
      routePoints: curRoute,
      onSelectSector: selectCb,
    } = stateRef.current;

    const svg = d3
      .select(svgEl)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
      defs = svg.append('defs');

      const redGrad = defs
        .append('radialGradient')
        .attr('id', 'map-heat-red')
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');
      redGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(239, 68, 68, 0.45)');
      redGrad.append('stop').attr('offset', '55%').attr('stop-color', 'rgba(239, 68, 68, 0.16)');
      redGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(239, 68, 68, 0)');

      const amberGrad = defs
        .append('radialGradient')
        .attr('id', 'map-heat-amber')
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');
      amberGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(245, 158, 11, 0.34)');
      amberGrad.append('stop').attr('offset', '60%').attr('stop-color', 'rgba(245, 158, 11, 0.1)');
      amberGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(245, 158, 11, 0)');
    }

    let heatLayer = svg.select<SVGGElement>('g.map-heat-layer');
    if (heatLayer.empty()) heatLayer = svg.append('g').attr('class', 'map-heat-layer');

    let routeLayer = svg.select<SVGGElement>('g.map-route-layer');
    if (routeLayer.empty()) {
      routeLayer = svg
        .append('g')
        .attr('class', 'map-route-layer')
        .attr('data-testid', 'campus-map-route-overlay');
    }

    let nodeLayer = svg.select<SVGGElement>('g.map-node-layer');
    if (nodeLayer.empty()) nodeLayer = svg.append('g').attr('class', 'map-node-layer');

    let pinLayer = svg.select<SVGGElement>('g.map-pin-layer');
    if (pinLayer.empty()) pinLayer = svg.append('g').attr('class', 'map-pin-layer');

    const zoomFactor = Math.pow(2, map.getZoom() - DEFAULT_ZOOM);

    // 1. Heat Plumes
    const heatData = CAMPUS_SECTORS.map((sector) => {
      const secInc = curActive.filter((i) => i.sectorId === sector.id);
      const hasCritical = secInc.some(
        (i) => i.priority === 'Critical' || i.priority === 'High'
      );
      const pt = map.latLngToContainerPoint([sector.simulatedLat, sector.simulatedLng]);
      return {
        sector,
        secInc,
        hasCritical,
        x: pt.x,
        y: pt.y,
        r: (secInc.length > 0 ? 64 : 44) * Math.max(0.75, Math.min(1.35, zoomFactor)),
      };
    }).filter((d) => d.secInc.length > 0 || d.sector.baseSafetyScore <= 5);

    const heatSel = heatLayer
      .selectAll<SVGCircleElement, (typeof heatData)[number]>('circle.heat-plume')
      .data(heatData, (d) => d.sector.id);
    heatSel.exit().remove();

    const heatEnter = heatSel
      .enter()
      .append('circle')
      .attr('class', 'heat-plume')
      .attr('opacity', 0);

    const heatMerge = heatEnter
      .merge(heatSel)
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('fill', (d) =>
        d.hasCritical || d.secInc.length > 0 ? 'url(#map-heat-red)' : 'url(#map-heat-amber)'
      );

    if (animateData) {
      heatMerge.transition().duration(450).attr('r', (d) => d.r).attr('opacity', 1);
    } else {
      heatMerge.attr('r', (d) => d.r).attr('opacity', 1);
    }

    // 2. Highlighted Safe Route Path
    routeLayer.selectAll('*').remove();
    if (curRoute.length >= 2) {
      const projectedRoute = curRoute.map((s) => {
        const p = map.latLngToContainerPoint([s.simulatedLat, s.simulatedLng]);
        return { sector: s, x: p.x, y: p.y };
      });
      const pointsAttr = projectedRoute.map((p) => `${p.x},${p.y}`).join(' ');

      routeLayer
        .append('polyline')
        .attr('points', pointsAttr)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(16, 185, 129, 0.28)')
        .attr('stroke-width', 12)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');

      routeLayer
        .append('polyline')
        .attr('class', 'campus-route-flow')
        .attr('points', pointsAttr)
        .attr('fill', 'none')
        .attr('stroke', '#10B981')
        .attr('stroke-width', 3.5)
        .attr('stroke-dasharray', '8 5')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');

      const stepGroups = routeLayer
        .selectAll('g.route-waypoint')
        .data(projectedRoute)
        .enter()
        .append('g')
        .attr('class', 'route-waypoint')
        .attr('transform', (d) => `translate(${d.x - 18}, ${d.y - 14})`);

      stepGroups
        .append('circle')
        .attr('r', 8.5)
        .attr('fill', '#10B981')
        .attr('stroke', '#0B1120')
        .attr('stroke-width', 1.5);

      stepGroups
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '3')
        .attr('fill', '#042F2E')
        .attr('font-size', '8.5')
        .attr('font-weight', '800')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text((_d, idx) => String(idx + 1));
    }

    // 3. Interactive Sector Nodes
    const sectorNodesData = CAMPUS_SECTORS.map((sector) => {
      const secInc = curActive.filter((i) => i.sectorId === sector.id);
      const pt = map.latLngToContainerPoint([sector.simulatedLat, sector.simulatedLng]);
      return {
        sector,
        secInc,
        hasActive: secInc.length > 0,
        isCaution: secInc.length === 0 && sector.baseSafetyScore <= 6,
        isSelected: sector.id === curSelectedId,
        x: pt.x,
        y: pt.y,
      };
    });

    const nodeSel = nodeLayer
      .selectAll<SVGGElement, (typeof sectorNodesData)[number]>('g.campus-sector-node')
      .data(sectorNodesData, (d) => d.sector.id);

    nodeSel.exit().remove();

    const nodeEnter = nodeSel
      .enter()
      .append('g')
      .attr('class', 'campus-sector-node')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .attr('role', 'button')
      .attr('tabindex', 0);

    nodeEnter.append('circle').attr('class', 'alert-pulse campus-pulse-ring').attr('fill', 'none');
    nodeEnter.append('circle').attr('class', 'select-halo').attr('fill', 'none');
    nodeEnter.append('circle').attr('class', 'node-core');
    nodeEnter
      .append('text')
      .attr('class', 'node-code')
      .attr('text-anchor', 'middle')
      .attr('dy', '3.5')
      .attr('fill', '#F8FAFC')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('font-family', 'JetBrains Mono, monospace');

    const alertBadge = nodeEnter.append('g').attr('class', 'node-alert-badge');
    alertBadge
      .append('circle')
      .attr('r', 8)
      .attr('fill', '#DC2626')
      .attr('stroke', '#0B1120')
      .attr('stroke-width', 1.5);
    alertBadge
      .append('text')
      .attr('class', 'node-alert-count')
      .attr('text-anchor', 'middle')
      .attr('dy', '3.5')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('font-family', 'JetBrains Mono, monospace');

    const labelGrp = nodeEnter.append('g').attr('class', 'node-label-grp');
    labelGrp.append('rect').attr('class', 'node-label-bg').attr('rx', 4).attr('height', 18);
    labelGrp
      .append('text')
      .attr('class', 'node-label-text')
      .attr('text-anchor', 'middle')
      .attr('dy', '3.5')
      .attr('font-size', '10px')
      .attr('font-weight', '500');

    const nodeMerge = nodeEnter.merge(nodeSel);

    nodeMerge
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .attr(
        'aria-label',
        (d) =>
          `Select ${d.sector.name}${d.hasActive ? `, ${d.secInc.length} active alert` : ''}`
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        selectCb(d.sector.id);
      })
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectCb(d.sector.id);
        }
      });

    nodeMerge
      .select<SVGCircleElement>('circle.alert-pulse')
      .attr('r', 16)
      .attr('stroke', '#EF4444')
      .attr('stroke-width', 2)
      .attr('display', (d) => (d.hasActive ? null : 'none'));

    nodeMerge
      .select<SVGCircleElement>('circle.select-halo')
      .attr('r', 21)
      .attr('stroke', '#60A5FA')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 3')
      .attr('display', (d) => (d.isSelected ? null : 'none'));

    nodeMerge
      .select<SVGCircleElement>('circle.node-core')
      .attr('r', 14)
      .attr('fill', '#0B1120')
      .attr('stroke', (d) =>
        d.hasActive ? '#EF4444' : d.isCaution ? '#F59E0B' : '#22C55E'
      )
      .attr('stroke-width', 2.5);

    nodeMerge
      .select<SVGTextElement>('text.node-code')
      .text((d) => d.sector.shortCode);

    nodeMerge
      .select<SVGGElement>('g.node-alert-badge')
      .attr('transform', 'translate(14, -12)')
      .attr('display', (d) => (d.hasActive ? null : 'none'))
      .select<SVGTextElement>('text.node-alert-count')
      .text((d) => String(d.secInc.length));

    nodeMerge.each(function updateNodeLabel(d) {
      const label = MAP_SHORT_NAMES[d.sector.id] || d.sector.name;
      const boxW = Math.max(82, label.length * 6.5 + 14);
      const grp = d3.select(this).select<SVGGElement>('g.node-label-grp');
      grp.attr('transform', 'translate(0, 27)');
      grp
        .select<SVGRectElement>('rect.node-label-bg')
        .attr('x', -boxW / 2)
        .attr('y', -9)
        .attr('width', boxW)
        .attr('fill', 'rgba(11, 17, 32, 0.92)')
        .attr(
          'stroke',
          d.isSelected ? 'rgba(96, 165, 250, 0.78)' : 'rgba(148, 163, 184, 0.24)'
        );
      grp
        .select<SVGTextElement>('text.node-label-text')
        .attr('fill', d.isSelected ? '#93C5FD' : '#E2E8F0')
        .text(label);
    });

    // 4. Custom GPS Coordinate Pin
    pinLayer.selectAll('*').remove();
    if (curCustom) {
      const p = map.latLngToContainerPoint([curCustom.lat, curCustom.lng]);
      const pinG = pinLayer.append('g').attr('transform', `translate(${p.x}, ${p.y})`);
      pinG
        .append('circle')
        .attr('class', 'campus-pulse-ring')
        .attr('r', 12)
        .attr('fill', 'none')
        .attr('stroke', '#60A5FA')
        .attr('stroke-width', 2);
      pinG
        .append('circle')
        .attr('r', 6.5)
        .attr('fill', '#3B82F6')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);
    }
  }, []);

  // Initialize Leaflet Map once
  useEffect(() => {
    const container = leafletRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: CAMPUS_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 14,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    });

    const layer = L.tileLayer(TILE_URLS.dark, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    mapRef.current = map;
    tileRef.current = layer;

    const syncOverlay = () => renderOverlay(false);
    map.on('move', syncOverlay);
    map.on('zoom', syncOverlay);
    map.on('viewreset', syncOverlay);
    map.on('resize', syncOverlay);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!stateRef.current.interactiveCoords) return;
      const lat = Number(e.latlng.lat.toFixed(4));
      const lng = Number(e.latlng.lng.toFixed(4));
      let closest = CAMPUS_SECTORS[0];
      let minDist = Infinity;
      for (const s of CAMPUS_SECTORS) {
        const d = Math.hypot(s.simulatedLat - lat, s.simulatedLng - lng);
        if (d < minDist) {
          minDist = d;
          closest = s;
        }
      }
      stateRef.current.onSelectSector(closest.id, { lat, lng });
    });

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      renderOverlay(false);
    });
    if (wrapperRef.current) observer.observe(wrapperRef.current);

    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      renderOverlay(true);
    });

    return () => {
      observer.disconnect();
      map.off('move', syncOverlay);
      map.off('zoom', syncOverlay);
      map.off('viewreset', syncOverlay);
      map.off('resize', syncOverlay);
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, [renderOverlay]);

  useEffect(() => {
    if (tileRef.current) {
      tileRef.current.setUrl(TILE_URLS[basemap]);
    }
  }, [basemap]);

  useEffect(() => {
    renderOverlay(true);
  }, [selectedSectorId, activeIncidents, customCoords, routePoints, renderOverlay]);

  const handleRecenter = () => {
    mapRef.current?.setView(CAMPUS_CENTER, DEFAULT_ZOOM, { animate: true });
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800/90 bg-[#0D1526]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-[#111827]">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Campus Safety Map</h3>
          <p className="text-xs text-slate-400">
            {interactiveCoords
              ? 'Click any location marker or tap anywhere on the map to set GPS coordinates'
              : 'Real campus street map — click any location marker to inspect safety details'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/85 inline-block" aria-hidden="true" />
              Safe
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/85 inline-block" aria-hidden="true" />
              Caution
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" aria-hidden="true" />
              Alert
            </span>
          </div>

          <button
            type="button"
            onClick={() => setBasemap((prev) => (prev === 'dark' ? 'street' : 'dark'))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span>{basemap === 'dark' ? 'Dark Map' : 'Street Map'}</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            aria-label="Recenter campus map"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className={`relative w-full h-[300px] sm:h-[380px] campus-leaflet-map bg-[#0B1221] overflow-hidden ${
          interactiveCoords ? 'cursor-crosshair' : ''
        }`}
        data-testid="campus-safety-map"
      >
        <div
          ref={leafletRef}
          className="absolute inset-0 w-full h-full z-0"
          aria-label="Interactive University Campus Safety Map"
        />
        <svg
          ref={svgRef}
          className="pointer-events-none absolute inset-0 w-full h-full z-[400]"
        />
      </div>
    </div>
  );
}
