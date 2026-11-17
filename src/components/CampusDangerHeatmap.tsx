import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import L from 'leaflet';
import { motion } from 'motion/react';
import { Flame, Layers, MapPin, RotateCcw, ShieldAlert } from 'lucide-react';
import { IncidentPriority, IncidentReport, SectorDangerCluster } from '../types/safety';
import {
  computeIncidentHeatPoints,
  computeSectorDangerClusters,
} from '../utils/safetyEngine';

interface CampusDangerHeatmapProps {
  incidents: IncidentReport[];
  priorityFilter: 'All' | IncidentPriority;
}

const CAMPUS_CENTER: [number, number] = [23.8777, 90.3209];
const DEFAULT_ZOOM = 16;

const TILE_URLS = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  street: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
} as const;

const SECTOR_SHORT_LABELS: Record<string, string> = {
  'sector-main-gate': 'Main Gate',
  'sector-central-library': 'Central Library',
  'sector-engineering-block': 'Engineering Labs',
  'sector-south-dorms': 'South Dorms',
  'sector-transit-hub': 'Shuttle Terminal',
  'sector-west-walkway': 'West Lakefront',
  'sector-parking-c': 'North Lot C',
};

interface ProjectedHeatDatum {
  x: number;
  y: number;
  weight: number;
}

export function CampusDangerHeatmap({
  incidents,
  priorityFilter,
}: CampusDangerHeatmapProps) {
  const [statusScope, setStatusScope] = useState<'all' | 'active'>('all');
  const [basemap, setBasemap] = useState<'dark' | 'street'>('dark');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('sector-west-walkway');
  const [hoveredCluster, setHoveredCluster] = useState<{
    cluster: SectorDangerCluster;
    x: number;
    y: number;
  } | null>(null);

  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const d3SvgRef = useRef<SVGSVGElement | null>(null);
  const legendSvgRef = useRef<SVGSVGElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const clusters = useMemo(
    () =>
      computeSectorDangerClusters(incidents, {
        statusScope,
        priorityFilter,
      }),
    [incidents, statusScope, priorityFilter]
  );

  const heatPoints = useMemo(
    () =>
      computeIncidentHeatPoints(incidents, {
        statusScope,
        priorityFilter,
      }),
    [incidents, statusScope, priorityFilter]
  );

  // Keep selected sector synced to top hotspot if current selection disappears or on initial mount
  const activeCluster = useMemo(() => {
    return clusters.find((c) => c.sector.id === selectedSectorId) || clusters[0];
  }, [clusters, selectedSectorId]);

  const clustersRef = useRef(clusters);
  clustersRef.current = clusters;
  const heatPointsRef = useRef(heatPoints);
  heatPointsRef.current = heatPoints;
  const selectedSectorIdRef = useRef(activeCluster?.sector.id || 'sector-west-walkway');
  selectedSectorIdRef.current = activeCluster?.sector.id || 'sector-west-walkway';

  const renderD3Overlay = useCallback((animateDataChange: boolean) => {
    const map = mapInstanceRef.current;
    const svgEl = d3SvgRef.current;
    const wrapperEl = mapWrapperRef.current;
    if (!map || !svgEl || !wrapperEl) return;

    const width = wrapperEl.clientWidth;
    const height = wrapperEl.clientHeight;
    if (width <= 0 || height <= 0) return;

    const svg = d3
      .select(svgEl)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Ensure structural groups exist in stable paint order
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
      const glow = defs
        .append('filter')
        .attr('id', 'd3-heat-blur')
        .attr('x', '-25%')
        .attr('y', '-25%')
        .attr('width', '150%')
        .attr('height', '150%');
      glow.append('feGaussianBlur').attr('stdDeviation', '9');
    }

    let contourLayer = svg.select<SVGGElement>('g.d3-contour-layer');
    if (contourLayer.empty()) {
      contourLayer = svg
        .append('g')
        .attr('class', 'd3-contour-layer')
        .attr('filter', 'url(#d3-heat-blur)');
    }

    let clusterLayer = svg.select<SVGGElement>('g.d3-cluster-layer');
    if (clusterLayer.empty()) {
      clusterLayer = svg.append('g').attr('class', 'd3-cluster-layer');
    }

    // 1. Project weighted incident points into current container coordinates
    const currentPoints = heatPointsRef.current;
    const projectedPoints: ProjectedHeatDatum[] = [];

    for (const pt of currentPoints) {
      const containerPt = map.latLngToContainerPoint([pt.lat, pt.lng]);
      projectedPoints.push({
        x: containerPt.x,
        y: containerPt.y,
        weight: pt.weight,
      });
      // Add subtle weighted neighborhood reinforcement for high/critical points so D3 contour bands radiate cleanly
      if (pt.weight >= 0.7) {
        projectedPoints.push({
          x: containerPt.x + 8,
          y: containerPt.y - 6,
          weight: pt.weight * 0.65,
        });
        projectedPoints.push({
          x: containerPt.x - 7,
          y: containerPt.y + 7,
          weight: pt.weight * 0.65,
        });
      }
    }

    // Also include cluster centers proportional to incident density for strong cluster halos
    const currentClusters = clustersRef.current;
    for (const c of currentClusters) {
      if (c.incidentCount > 0) {
        const pt = map.latLngToContainerPoint([c.sector.simulatedLat, c.sector.simulatedLng]);
        projectedPoints.push({
          x: pt.x,
          y: pt.y,
          weight: Math.min(1.6, 0.45 + c.weightedDangerScore / 95),
        });
      }
    }

    const zoomScale = Math.pow(2, map.getZoom() - DEFAULT_ZOOM);
    const bandwidth = Math.max(24, Math.min(64, 40 * zoomScale));

    const contours =
      projectedPoints.length > 0
        ? d3
            .contourDensity<ProjectedHeatDatum>()
            .x((d) => d.x)
            .y((d) => d.y)
            .weight((d) => d.weight)
            .size([width, height])
            .bandwidth(bandwidth)
            .thresholds(14)(projectedPoints)
        : [];

    const maxDensity = d3.max(contours, (d) => d.value) || 0.01;
    const colorScale = d3
      .scaleSequential((t) => d3.interpolateYlOrRd(0.18 + t * 0.82))
      .domain([0, maxDensity]);
    const opacityScale = d3.scaleLinear().domain([0, maxDensity]).range([0.14, 0.72]);
    const geoPath = d3.geoPath();

    const contourPaths = contourLayer
      .selectAll<SVGPathElement, d3.ContourMultiPolygon>('path.heat-contour')
      .data(contours, (_d, i) => String(i));

    contourPaths.exit().remove();

    const contourEnter = contourPaths
      .enter()
      .append('path')
      .attr('class', 'heat-contour')
      .attr('stroke', 'none')
      .attr('opacity', 0);

    const mergedContours = contourEnter.merge(contourPaths);
    mergedContours
      .attr('d', (d) => geoPath(d) || '')
      .attr('fill', (d) => colorScale(d.value));

    if (animateDataChange) {
      mergedContours
        .transition()
        .duration(520)
        .ease(d3.easeCubicOut)
        .attr('opacity', (d) => opacityScale(d.value));
    } else {
      mergedContours.attr('opacity', (d) => opacityScale(d.value));
    }

    // 2. Render D3 Sector Cluster Bubbles
    const maxCount = Math.max(1, ...currentClusters.map((c) => c.incidentCount));
    const radiusScale = d3.scaleSqrt().domain([0, maxCount]).range([10, 22]);

    const clusterData = currentClusters.map((c) => {
      const pt = map.latLngToContainerPoint([c.sector.simulatedLat, c.sector.simulatedLng]);
      return {
        cluster: c,
        x: pt.x,
        y: pt.y,
        r: c.incidentCount === 0 ? 9 : radiusScale(c.incidentCount),
      };
    });

    const nodeSelection = clusterLayer
      .selectAll<SVGGElement, (typeof clusterData)[number]>('g.d3-cluster-node')
      .data(clusterData, (d) => d.cluster.sector.id);

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection
      .enter()
      .append('g')
      .attr('class', 'd3-cluster-node')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer')
      .attr('role', 'button')
      .attr('tabindex', 0);

    // Animated pulse ring for Critical/High clusters
    nodeEnter.append('circle').attr('class', 'pulse-ring campus-pulse-ring').attr('fill', 'none');
    // Selection outer dashed halo
    nodeEnter
      .append('circle')
      .attr('class', 'selection-halo')
      .attr('fill', 'none')
      .attr('stroke-dasharray', '4 3');
    // Main D3 proportional cluster circle
    nodeEnter.append('circle').attr('class', 'cluster-core');
    // Count label
    nodeEnter
      .append('text')
      .attr('class', 'cluster-count')
      .attr('text-anchor', 'middle')
      .attr('dy', '3.5')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-weight', '700');
    // Short sector label pill background
    nodeEnter
      .append('rect')
      .attr('class', 'cluster-label-bg')
      .attr('rx', 4)
      .attr('height', 17);
    // Short sector label text
    nodeEnter
      .append('text')
      .attr('class', 'cluster-label-text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '600');

    const nodeMerge = nodeEnter.merge(nodeSelection);

    nodeMerge
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .attr(
        'aria-label',
        (d) =>
          `${d.cluster.sector.name}: ${d.cluster.incidentCount} incident(s), danger score ${d.cluster.weightedDangerScore}`
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedSectorId(d.cluster.sector.id);
        map.panTo([d.cluster.sector.simulatedLat, d.cluster.sector.simulatedLng], {
          animate: true,
          duration: 0.45,
        });
      })
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedSectorId(d.cluster.sector.id);
        }
      })
      .on('mouseenter', (_event, d) => {
        setHoveredCluster({
          cluster: d.cluster,
          x: d.x,
          y: d.y,
        });
      })
      .on('mouseleave', () => {
        setHoveredCluster(null);
      });

    const strokeForRisk = (risk: SectorDangerCluster['riskLevel'], count: number) => {
      if (count === 0) return '#22C55E';
      if (risk === 'Critical Cluster') return '#EF4444';
      if (risk === 'High Cluster') return '#F97316';
      return '#F59E0B';
    };

    const fillForRisk = (risk: SectorDangerCluster['riskLevel'], count: number) => {
      if (count === 0) return 'rgba(11, 17, 32, 0.88)';
      if (risk === 'Critical Cluster') return 'rgba(127, 29, 29, 0.92)';
      if (risk === 'High Cluster') return 'rgba(124, 45, 18, 0.92)';
      return 'rgba(120, 53, 15, 0.9)';
    };

    nodeMerge
      .select<SVGCircleElement>('circle.pulse-ring')
      .attr('r', (d) => d.r + 3)
      .attr('stroke', (d) =>
        d.cluster.riskLevel === 'Critical Cluster' ? '#EF4444' : '#F97316'
      )
      .attr('stroke-width', 2)
      .attr('display', (d) =>
        d.cluster.incidentCount > 0 &&
        (d.cluster.riskLevel === 'Critical Cluster' || d.cluster.riskLevel === 'High Cluster')
          ? null
          : 'none'
      );

    nodeMerge
      .select<SVGCircleElement>('circle.selection-halo')
      .attr('r', (d) => d.r + 7)
      .attr('stroke', '#60A5FA')
      .attr('stroke-width', 2)
      .attr('display', (d) =>
        d.cluster.sector.id === selectedSectorIdRef.current ? null : 'none'
      );

    const coreSel = nodeMerge.select<SVGCircleElement>('circle.cluster-core');
    if (animateDataChange) {
      coreSel
        .transition()
        .duration(400)
        .attr('r', (d) => d.r)
        .attr('fill', (d) => fillForRisk(d.cluster.riskLevel, d.cluster.incidentCount))
        .attr('stroke', (d) => strokeForRisk(d.cluster.riskLevel, d.cluster.incidentCount))
        .attr('stroke-width', 2.2);
    } else {
      coreSel
        .attr('r', (d) => d.r)
        .attr('fill', (d) => fillForRisk(d.cluster.riskLevel, d.cluster.incidentCount))
        .attr('stroke', (d) => strokeForRisk(d.cluster.riskLevel, d.cluster.incidentCount))
        .attr('stroke-width', 2.2);
    }

    nodeMerge
      .select<SVGTextElement>('text.cluster-count')
      .attr('font-size', (d) => (d.cluster.incidentCount > 0 ? '11px' : '9px'))
      .attr('fill', '#F8FAFC')
      .text((d) =>
        d.cluster.incidentCount > 0 ? String(d.cluster.incidentCount) : d.cluster.sector.shortCode
      );

    nodeMerge.each(function updateLabel(d) {
      const label = SECTOR_SHORT_LABELS[d.cluster.sector.id] || d.cluster.sector.shortCode;
      const boxW = Math.max(76, label.length * 6.4 + 14);
      const yOffset = d.r + 17;
      const isSelected = d.cluster.sector.id === selectedSectorIdRef.current;

      d3.select(this)
        .select<SVGRectElement>('rect.cluster-label-bg')
        .attr('x', -boxW / 2)
        .attr('y', yOffset - 11)
        .attr('width', boxW)
        .attr('fill', 'rgba(11, 17, 32, 0.9)')
        .attr(
          'stroke',
          isSelected ? 'rgba(96, 165, 250, 0.8)' : 'rgba(148, 163, 184, 0.25)'
        )
        .attr('stroke-width', 1);

      d3.select(this)
        .select<SVGTextElement>('text.cluster-label-text')
        .attr('y', yOffset + 1)
        .attr('fill', isSelected ? '#93C5FD' : '#E2E8F0')
        .text(label);
    });
  }, []);

  // Initialize Leaflet map once
  useEffect(() => {
    const container = leafletContainerRef.current;
    if (!container || mapInstanceRef.current) return;

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

    mapInstanceRef.current = map;
    tileLayerRef.current = layer;

    const handleMapTransform = () => renderD3Overlay(false);
    map.on('move', handleMapTransform);
    map.on('zoom', handleMapTransform);
    map.on('viewreset', handleMapTransform);
    map.on('resize', handleMapTransform);

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      renderD3Overlay(false);
    });
    if (mapWrapperRef.current) {
      observer.observe(mapWrapperRef.current);
    }

    // Initial animated D3 contour render
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      renderD3Overlay(true);
    });

    return () => {
      observer.disconnect();
      map.off('move', handleMapTransform);
      map.off('zoom', handleMapTransform);
      map.off('viewreset', handleMapTransform);
      map.off('resize', handleMapTransform);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
    };
  }, [renderD3Overlay]);

  // Swap basemap tiles cleanly
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(TILE_URLS[basemap]);
    }
  }, [basemap]);

  // Redraw D3 heatmap contours whenever incidents, filter, or selection change
  useEffect(() => {
    renderD3Overlay(true);
  }, [clusters, heatPoints, selectedSectorId, renderD3Overlay]);

  // Render D3 continuous heat gradient bar in legend
  useEffect(() => {
    const el = legendSvgRef.current;
    if (!el) return;
    const svg = d3.select(el);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const grad = defs
      .append('linearGradient')
      .attr('id', 'd3-danger-legend-grad')
      .attr('x1', '0%')
      .attr('x2', '100%');

    const stops = [0, 0.25, 0.5, 0.75, 1];
    stops.forEach((t) => {
      grad
        .append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', d3.interpolateYlOrRd(0.18 + t * 0.82));
    });

    svg
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 140)
      .attr('height', 8)
      .attr('rx', 4)
      .attr('fill', 'url(#d3-danger-legend-grad)');
  }, []);

  const handleRecenter = () => {
    mapInstanceRef.current?.setView(CAMPUS_CENTER, DEFAULT_ZOOM, { animate: true });
  };

  const handleFocusCluster = (cluster: SectorDangerCluster) => {
    setSelectedSectorId(cluster.sector.id);
    mapInstanceRef.current?.setView(
      [cluster.sector.simulatedLat, cluster.sector.simulatedLng],
      17,
      { animate: true }
    );
  };

  const riskTextColor = (risk: SectorDangerCluster['riskLevel'], count: number) => {
    if (count === 0) return 'text-emerald-400';
    if (risk === 'Critical Cluster') return 'text-red-400';
    if (risk === 'High Cluster') return 'text-orange-400';
    return 'text-amber-300';
  };

  const riskBarColor = (risk: SectorDangerCluster['riskLevel'], count: number) => {
    if (count === 0) return 'bg-emerald-500';
    if (risk === 'Critical Cluster') return 'bg-red-500';
    if (risk === 'High Cluster') return 'bg-orange-500';
    return 'bg-amber-400';
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-[#111827] border border-slate-800/90 rounded-xl overflow-hidden"
      aria-label="Campus Danger Heatmap"
      data-testid="campus-danger-heatmap"
    >
      {/* Header Controls */}
      <div className="px-5 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-100">Campus Danger Heatmap</h3>
          </div>
          <p className="text-xs text-slate-400">
            D3 kernel density clusters overlaid on campus streets · {heatPoints.length} incident point(s) plotted
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scope Segmented Toggle */}
          <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setStatusScope('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusScope === 'all'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Incidents
            </button>
            <button
              type="button"
              onClick={() => setStatusScope('active')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusScope === 'active'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Only
            </button>
          </div>

          {/* Basemap Style Toggle */}
          <button
            type="button"
            onClick={() => setBasemap((prev) => (prev === 'dark' ? 'street' : 'dark'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span>{basemap === 'dark' ? 'Dark Map' : 'Street Map'}</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            aria-label="Reset heatmap view to campus center"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>Recenter</span>
          </button>
        </div>
      </div>

      {/* Main 12-Col Grid: Map (8 cols) + Hotspot Ranking & Inspector (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12">
        {/* Interactive Leaflet + D3 Map Surface */}
        <div className="xl:col-span-8 relative campus-leaflet-map border-b xl:border-b-0 xl:border-r border-slate-800/80">
          <div
            ref={mapWrapperRef}
            className="relative w-full h-[380px] sm:h-[440px] bg-[#0B1221] overflow-hidden"
          >
            <div
              ref={leafletContainerRef}
              className="absolute inset-0 w-full h-full z-0"
              aria-label="Interactive Campus Danger Heatmap Base Map"
            />
            <svg
              ref={d3SvgRef}
              data-testid="d3-heatmap-overlay"
              className="pointer-events-none absolute inset-0 w-full h-full z-[400]"
            />

            {/* Empty Filter State Banner */}
            {heatPoints.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-[450] flex justify-center px-4">
                <div className="px-4 py-2 rounded-lg bg-[#0B1120]/90 border border-slate-700 text-xs text-slate-300">
                  No incidents match the current filter — switch to &ldquo;All Incidents&rdquo; or &ldquo;All&rdquo; priority to view clusters.
                </div>
              </div>
            )}

            {/* D3 Hover Tooltip */}
            {hoveredCluster && (
              <div
                role="status"
                className="pointer-events-none absolute z-[500] w-56 rounded-lg bg-[#0B1120]/95 border border-slate-700 px-3.5 py-2.5 shadow-lg space-y-1 text-xs"
                style={{
                  left: Math.min(Math.max(12, hoveredCluster.x + 18), 420),
                  top: Math.max(12, hoveredCluster.y - 68),
                }}
              >
                <div className="font-semibold text-slate-100 truncate">
                  {hoveredCluster.cluster.sector.name}
                </div>
                <div className="flex items-center justify-between text-slate-300 font-mono tabular-nums">
                  <span>Danger Index</span>
                  <span
                    className={`font-semibold ${riskTextColor(
                      hoveredCluster.cluster.riskLevel,
                      hoveredCluster.cluster.incidentCount
                    )}`}
                  >
                    {hoveredCluster.cluster.weightedDangerScore}/100
                  </span>
                </div>
                <div className="text-slate-400">
                  {hoveredCluster.cluster.incidentCount} total · {hoveredCluster.cluster.activeCount} active
                </div>
                {hoveredCluster.cluster.dominantCategory !== 'None' && (
                  <div className="text-slate-400 truncate">
                    Top: {hoveredCluster.cluster.dominantCategory}
                  </div>
                )}
              </div>
            )}

            {/* Floating D3 Continuous Color Legend */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-[450] rounded-lg bg-[#0B1120]/90 border border-slate-800 px-3 py-2 space-y-1">
              <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                <span>Cluster Density</span>
                <span className="font-mono tabular-nums text-slate-400">0 → 100</span>
              </div>
              <svg ref={legendSvgRef} width={140} height={8} aria-hidden="true" />
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Low</span>
                <span>Moderate</span>
                <span>Critical</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sector Hotspot Ranking & Selected Cluster Inspector */}
        <div className="xl:col-span-4 p-5 flex flex-col justify-between gap-5">
          {/* Sector Cluster Ranking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300">Sector Hotspot Ranking</h4>
              <span className="text-xs text-slate-400">Click zone to inspect</span>
            </div>

            <div className="space-y-2">
              {clusters.map((item) => {
                const isSelected = activeCluster?.sector.id === item.sector.id;
                return (
                  <button
                    key={item.sector.id}
                    type="button"
                    onClick={() => handleFocusCluster(item)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors space-y-1.5 ${
                      isSelected
                        ? 'bg-slate-800/85'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-100 truncate">
                        {item.sector.shortCode} · {SECTOR_SHORT_LABELS[item.sector.id] || item.sector.name}
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold shrink-0 ${riskTextColor(
                          item.riskLevel,
                          item.incidentCount
                        )}`}
                      >
                        {item.weightedDangerScore}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#0B1120] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${riskBarColor(
                          item.riskLevel,
                          item.incidentCount
                        )}`}
                        style={{
                          width: `${item.weightedDangerScore === 0 ? 4 : Math.max(8, item.weightedDangerScore)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                      <span>{item.incidentCount} incident(s)</span>
                      <span>{item.activeCount} active · {item.sosCount} SOS</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Cluster Details (Hairline Divider) */}
          {activeCluster && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 min-w-0">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{activeCluster.sector.name}</span>
                </div>
                <span
                  className={`text-xs font-semibold shrink-0 ${riskTextColor(
                    activeCluster.riskLevel,
                    activeCluster.incidentCount
                  )}`}
                >
                  {activeCluster.incidentCount === 0 ? 'Clear' : activeCluster.riskLevel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-400">
                <div>
                  Dominant Type:{' '}
                  <span className="text-slate-200 block truncate">
                    {activeCluster.dominantCategory}
                  </span>
                </div>
                <div>
                  Lighting:{' '}
                  <span className="text-slate-200 block">
                    {activeCluster.sector.lightingLevel}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums pt-1">
                <MapPin className="w-3 h-3 text-blue-400 shrink-0" aria-hidden="true" />
                <span>
                  {activeCluster.sector.simulatedLat.toFixed(4)}° N,{' '}
                  {activeCluster.sector.simulatedLng.toFixed(4)}° E ·{' '}
                  {activeCluster.sector.nearestGuardPost}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
