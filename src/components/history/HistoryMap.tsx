'use client';

import EventMarkers from '@/components/history/EventMarkers';
import HistoryLayersButton from '@/components/history/HistoryLayersButton';
import ReplayControls from '@/components/history/ReplayControls';
import ReplayMarker from '@/components/history/ReplayMarker';
import ControlButton from '@/components/map/ControlButton';
import DockingStationMarker from '@/components/map/DockingStationMarker';
import {DrawControl} from '@/components/map/DrawControl';
import {drawStyles} from '@/components/map/drawStyles';
import HeatmapLayer from '@/components/map/HeatmapLayer';
import {mapStyles} from '@/components/map/mapStyles';
import PlannedPathLayer from '@/components/map/PlannedPathLayer';
import TrackLayer from '@/components/map/TrackLayer';
import {
  MapContextProvider,
  useFitToBounds,
  useMapboxDraw,
  useMapContext,
  withDisplaySortKeys,
} from '@/contexts/MapContext';
import {useHeatmap} from '@/hooks/useHeatmap';
import {useHeatmapMetrics} from '@/hooks/useHeatmapMetrics';
import {useJobPlannedPath} from '@/hooks/useJobPlannedPath';
import {useJobTrack} from '@/hooks/useJobTrack';
import {useMapVersion} from '@/hooks/useMapVersion';
import {useReplay} from '@/hooks/useReplay';
import {useSelectedMower} from '@/stores/mowersStore';
import type {AreaProps, HeatmapMetric, MowerEvent, MowJob} from '@/stores/schemas';
import {featuresToDockingStations} from '@/utils/area-converter';
import {datumToRelative} from '@/utils/coordinates';
import {countTrackPoints, replayPointCount, sampleTrackAt, trimPastTrack} from '@/utils/replay-track';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import StaticMode from '@mapbox/mapbox-gl-draw-static-mode';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {Box, Typography, useTheme, type SxProps} from '@mui/material';
import type {Feature, Polygon} from 'geojson';
import {FocusIcon} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RFullscreenControl, RMap} from 'maplibre-react-components';
import {useEffect, useMemo, useState} from 'react';

interface HistoryMapProps {
  job: MowJob | null;
  events: MowerEvent[];
  activeEventId: string | null;
  onSelectEvent: (id: string) => void;
  onHoverEvent: (id: string | null) => void;
  sx?: SxProps;
}

/**
 * The History page's map: it owns its OWN MapContextProvider (a separate MapLibre instance +
 * feature collection from the LIVE map page's), fed by the selected job's stored map version
 * (useMapVersion) instead of the live mapToFeatures pipeline -- see app/history/page.tsx.
 *
 * Deliberately NOT a reuse of the live MowerMap component: MowerMap bundles live-mower-only
 * controls (teleop joystick, mission composer, area editing + save-to-mower) that operate on
 * the CURRENTLY SELECTED MOWER regardless of which map is on screen -- embedding those here
 * would let a user drive/command the real mower from what's supposed to be a read-only past-job
 * view. Instead this reuses the same lower-level building blocks unchanged: DrawControl +
 * drawStyles (area/dock rendering), DockingStationMarker, HeatmapLayer/TrackLayer/
 * PlannedPathLayer, and a layer-toggle popover with the same options as LayersButton (see
 * HistoryLayersButton for why it doesn't reuse LayersButton itself).
 */
export default function HistoryMap(props: HistoryMapProps) {
  return (
    <MapContextProvider id="history-map">
      <HistoryMapInner {...props} />
    </MapContextProvider>
  );
}

function HistoryMapInner({job, events, activeEventId, onSelectEvent, onHoverEvent, sx}: HistoryMapProps) {
  const theme = useTheme();
  const {datum, datumOrFallback, setDatum, features, setFeatures, bounds} = useMapContext();
  const draw = useMapboxDraw();
  const fitToBounds = useFitToBounds();

  // Local x/y (track, planned path, heatmap, event positions) are recorded relative to the
  // mower's GPS datum, which -- unlike the map's areas/docks -- doesn't get versioned per job:
  // it's set once from the mower's GPS fix and stays stable for the install's lifetime, so the
  // CURRENT live datum is reused here too (same assumption the live Map page's own past-job
  // track viewer already makes -- see useTrackFeatures).
  const liveDatum = useSelectedMower((s) => s?.map.datum);

  useEffect(() => {
    setDatum(liveDatum ?? null);
  }, [liveDatum, setDatum]);

  const {features: versionFeatures} = useMapVersion(job?.map_version_id ?? null);

  useEffect(() => {
    if (!draw) return;
    draw.set(withDisplaySortKeys(versionFeatures));
    setFeatures(versionFeatures, false);
  }, [draw, versionFeatures, setFeatures]);

  useEffect(() => {
    fitToBounds(true);
  }, [bounds]); // eslint-disable-line react-hooks/exhaustive-deps -- fitToBounds is a useEffectEvent (see MapContext), not a reactive dep

  const dockingStations = useMemo(
    () => featuresToDockingStations(features, datumToRelative([datumOrFallback.long, datumOrFallback.lat])),
    [features, datumOrFallback],
  );

  const [showSatellite, setShowSatellite] = useState(false);
  const [showTrack, setShowTrack] = useState(true);
  const [showPlannedPath, setShowPlannedPath] = useState(true);
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric | null>(null);

  const jobId = job?.id ?? null;
  const {pastTrack, loading: trackLoading} = useJobTrack(jobId);
  const {plannedPath} = useJobPlannedPath(jobId);
  const heatmap = useHeatmap(heatmapMetric, job?.map_version_id);
  const {metrics: heatmapMetrics} = useHeatmapMetrics();
  const heatmapMetricInfo = heatmapMetrics.find((m) => m.key === heatmapMetric);

  const areaCount = useMemo(
    () => (features.features.filter((f) => f.geometry.type === 'Polygon') as Feature<Polygon, AreaProps>[]).length,
    [features],
  );

  // Animated replay: the playhead drives a progressive (up-to-t) view of the track + events
  // instead of always showing the whole job at once. `job.started_at`/`ended_at` are unix
  // seconds, matching the event `t` convention (see useJobEvents); NOT wall-clock "now".
  const startedAt = job?.started_at ?? 0;
  const endedAt = job ? (job.ended_at ?? Math.floor(Date.now() / 1000)) : 0;
  const replay = useReplay(jobId, startedAt, endedAt);

  // Track points carry no per-point timestamp (see useJobTrack), so the marker + progressive
  // track are driven by INDEX, mapped from the playhead's 0..1 progress -- see utils/replay-track.
  const totalTrackPoints = useMemo(() => countTrackPoints(pastTrack), [pastTrack]);
  const trackIndex = totalTrackPoints > 1 ? replay.progress * (totalTrackPoints - 1) : 0;
  const replaySample = useMemo(() => sampleTrackAt(pastTrack, trackIndex), [pastTrack, trackIndex]);
  const replayTrack = useMemo(
    () => (pastTrack ? trimPastTrack(pastTrack, replayPointCount(totalTrackPoints, trackIndex)) : null),
    [pastTrack, totalTrackPoints, trackIndex],
  );

  // Events do carry their own `t` (unix seconds), so they're filtered directly against the playhead.
  const visibleEvents = useMemo(() => events.filter((e) => e.t <= replay.t), [events, replay.t]);

  return (
    <Box sx={{...sx, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
      <Box sx={{flex: 1, minHeight: 0, position: 'relative'}}>
        <RMap
          id="history-map"
          style={{width: '100%', height: '100%'}}
          mapStyle={mapStyles[datum && showSatellite ? 'satellite' : 'white']}
          initialAttributionControl={false}
          maxZoom={25}
          initialPitchWithRotate={false}
          dragRotate={false}
          onLoad={(e) => e.target.touchZoomRotate.disableRotation()}
        >
          <DrawControl
            displayControlsDefault={false}
            controls={{}}
            styles={drawStyles}
            modes={{...MapboxDraw.modes, static: StaticMode}}
            defaultMode="static"
            userProperties={true}
          />

          <RFullscreenControl />
          <ControlButton
            position="top-right"
            icon={FocusIcon}
            title="Fit to bounds"
            onClick={() => fitToBounds(false)}
          />
          <HistoryLayersButton
            datum={datum}
            showSatellite={showSatellite}
            onShowSatelliteChange={setShowSatellite}
            showTrack={showTrack}
            onShowTrackChange={setShowTrack}
            trackLoading={trackLoading}
            showPlannedPath={showPlannedPath}
            onShowPlannedPathChange={setShowPlannedPath}
            heatmapMetric={heatmapMetric}
            onHeatmapMetricChange={setHeatmapMetric}
            heatmapLoading={heatmap.loading}
            heatmapEmpty={!!heatmapMetric && !heatmap.loading && heatmap.cells.length === 0}
          />

          {dockingStations.map((station) => (
            <DockingStationMarker key={station.id} station={station} datum={datumOrFallback} />
          ))}
          <PlannedPathLayer visible={showPlannedPath} datum={datumOrFallback} plannedPath={plannedPath} />
          <TrackLayer visible={showTrack} pastTrack={replayTrack} loading={trackLoading} />
          {heatmapMetric && (
            <HeatmapLayer
              visible
              cells={heatmap.cells}
              cellSize={heatmap.cellSize}
              datum={datumOrFallback}
              higherIsBetter={heatmapMetricInfo?.higher_is_better}
            />
          )}
          {job && (
            <EventMarkers
              events={visibleEvents}
              datum={datumOrFallback}
              mapVersionId={job.map_version_id}
              activeEventId={activeEventId}
              onSelectEvent={onSelectEvent}
              onHoverEvent={onHoverEvent}
            />
          )}
          {job && <ReplayMarker sample={replaySample} datum={datumOrFallback} />}
        </RMap>

        {!job && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
              pointerEvents: 'none',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Select a job to see its map
            </Typography>
          </Box>
        )}
        {job && areaCount === 0 && !versionFeatures.features.length && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              bgcolor: 'background.paper',
              borderRadius: 1,
              px: 1.5,
              py: 0.75,
              boxShadow: 2,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No map data for this job&apos;s version.
            </Typography>
          </Box>
        )}
      </Box>

      {job && (
        <Box sx={{flexShrink: 0, borderTop: 1, borderColor: 'divider'}}>
          <ReplayControls
            t={replay.t}
            startedAt={replay.startedAt}
            endedAt={replay.endedAt}
            playing={replay.playing}
            speed={replay.speed}
            onScrub={replay.setT}
            onTogglePlay={replay.togglePlay}
            onSpeedChange={replay.setSpeed}
          />
        </Box>
      )}
    </Box>
  );
}
