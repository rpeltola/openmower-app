'use client';

import HistoryEventList from '@/components/history/HistoryEventList';
import HistoryMap from '@/components/history/HistoryMap';
import JobList from '@/components/history/JobList';
import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import StatsRangeSelector, {type RangePreset} from '@/components/stats/StatsRangeSelector';
import {useJobEvents} from '@/hooks/useJobEvents';
import {useMowJobs} from '@/hooks/useMowJobs';
import {useSessions} from '@/hooks/useSessions';
import {outerCardStyles} from '@/lib/cardStyles';
import {EventNote as EventIcon, History as HistoryIcon, PlayCircle as JobIcon} from '@mui/icons-material';
import {Box, Card, CardContent, MenuItem, Select, Stack, Typography, useMediaQuery, useTheme} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Mirrors JobRow's formatJobDate -- same options, used for the session dropdown's entries.
function formatSessionTime(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Mirrors the Stats page's rangeForPreset (see app/stats/page.tsx) -- same preset vocabulary,
// same StatsRangeSelector component, applied here to narrow the job list instead of a chart.
function rangeForPreset(preset: RangePreset, customFrom: string, customTo: string): {from: number; to: number} {
  const now = new Date();
  switch (preset) {
    case 'today':
      return {from: startOfDay(now).getTime(), to: now.getTime()};
    case 'week':
      return {from: now.getTime() - 7 * DAY_MS, to: now.getTime()};
    case 'month':
      return {from: now.getTime() - 30 * DAY_MS, to: now.getTime()};
    case 'all':
      return {from: 0, to: 0};
    case 'custom': {
      const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)).getTime() : 0;
      const to = customTo ? endOfDay(new Date(`${customTo}T00:00:00`)).getTime() : now.getTime();
      return {from, to};
    }
  }
}

export default function HistoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [preset, setPreset] = useState<RangePreset>('week');
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date(Date.now() - 7 * DAY_MS)));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const {from, to} = useMemo(() => rangeForPreset(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const {jobs, loading: jobsLoading} = useMowJobs(from, to);
  const {sessions} = useSessions(from, to);

  // 'All sessions' (null) shows every job in range, matching the previous (pre-filter) behavior.
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const filteredJobs = useMemo(
    () => (selectedSessionId === null ? jobs : jobs.filter((j) => j.session_id === selectedSessionId)),
    [jobs, selectedSessionId],
  );

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectedJob = useMemo(
    () => filteredJobs.find((j) => j.id === selectedJobId) ?? null,
    [filteredJobs, selectedJobId],
  );

  // Default to the most recent job (within the session filter) once the list arrives, so the
  // map/event view isn't empty on first visit. Doesn't fight a user's own selection (only fires
  // while nothing is picked); changing the session filter clears the selection (see
  // handleSelectSession) so this re-picks the most recent job in the newly filtered set.
  useEffect(() => {
    if (selectedJobId === null && filteredJobs.length > 0) {
      setSelectedJobId(filteredJobs[0].id);
    }
  }, [selectedJobId, filteredJobs]);

  const handleSelectSession = (sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    setSelectedJobId(null);
  };

  const {events, loading: eventsLoading} = useJobEvents(selectedJob);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const activeEventId = hoveredEventId ?? selectedEventId;

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedEventId(null);
    setHoveredEventId(null);
  };

  const rangeCard = (
    <Card sx={outerCardStyles(theme)}>
      <CardContent>
        <StatsRangeSelector
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={setPreset}
          onCustomChange={(f, t) => {
            setCustomFrom(f);
            setCustomTo(t);
          }}
        />
        <Box sx={{mt: 1.5, display: 'flex', alignItems: 'center', gap: 1}}>
          <Typography variant="body2" color="text.secondary" sx={{flexShrink: 0}}>
            Session
          </Typography>
          <Select<string>
            size="small"
            fullWidth
            value={selectedSessionId ?? ''}
            displayEmpty
            onChange={(e) => handleSelectSession(e.target.value === '' ? null : e.target.value)}
          >
            <MenuItem value="">All sessions</MenuItem>
            {sessions.map((session) => (
              <MenuItem key={session.id} value={session.id}>
                {formatSessionTime(session.started_at)} · {session.job_count} job{session.job_count === 1 ? '' : 's'}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </CardContent>
    </Card>
  );

  const jobListCard = (
    <Card sx={{...outerCardStyles(theme), flex: isMobile ? undefined : '0 1 45%', minHeight: 0, display: 'flex'}}>
      <CardContent sx={{flex: 1, minHeight: 0, display: 'flex', height: isMobile ? 320 : undefined}}>
        <JobList jobs={filteredJobs} loading={jobsLoading} selectedJobId={selectedJobId} onSelectJob={handleSelectJob} />
      </CardContent>
    </Card>
  );

  const eventListCard = (
    <Card sx={{...outerCardStyles(theme), flex: isMobile ? undefined : '1 1 55%', minHeight: 0, display: 'flex'}}>
      <CardContent sx={{flex: 1, minHeight: 0, display: 'flex', height: isMobile ? 400 : undefined}}>
        <HistoryEventList
          events={events}
          loading={eventsLoading}
          mapVersionId={selectedJob?.map_version_id ?? null}
          activeEventId={activeEventId}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          onHoverEvent={setHoveredEventId}
        />
      </CardContent>
    </Card>
  );

  const map = (
    <HistoryMap
      job={selectedJob}
      events={events}
      activeEventId={activeEventId}
      onSelectEvent={setSelectedEventId}
      onHoverEvent={setHoveredEventId}
      sx={{
        ...outerCardStyles(theme),
        backgroundColor: 'black',
        backdropFilter: 'unset',
        height: '100%',
        outline: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.3)' : undefined,
      }}
    />
  );

  return (
    <Page sx={{height: isMobile ? undefined : 'calc(100% - 16px)'}}>
      <PageHeader title="History" subtitle="Review past mow jobs, the map they used, and their events">
        <HeaderStat icon={<HistoryIcon />} value={filteredJobs.length} label="Jobs in range" />
        <HeaderStat icon={<JobIcon />} value={selectedJob ? 1 : 0} label="Job selected" />
        <HeaderStat icon={<EventIcon />} value={events.length} label="Events shown" />
      </PageHeader>

      <PageContent sx={{flex: isMobile ? undefined : 1, position: 'relative', display: 'flex', flexDirection: 'column'}}>
        {isMobile ? (
          <>
            {/* Sticky map on top -- NOT list-then-map -- so the map stays visible while
                scrolling through jobs/events below it on small screens. */}
            <Box sx={{position: 'sticky', top: 0, zIndex: 2, height: '45vh', mb: 2}}>{map}</Box>
            <Stack spacing={2}>
              {rangeCard}
              {jobListCard}
              {eventListCard}
            </Stack>
          </>
        ) : (
          <Box sx={{display: 'flex', gap: 2, flex: 1, minHeight: 0}}>
            <Box sx={{width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0}}>
              {rangeCard}
              {jobListCard}
              {eventListCard}
            </Box>
            <Box sx={{flex: 1, position: 'relative'}}>{map}</Box>
          </Box>
        )}
      </PageContent>
    </Page>
  );
}
