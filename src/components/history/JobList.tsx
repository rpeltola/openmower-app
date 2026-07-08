'use client';

import JobRow from '@/components/history/JobRow';
import type {MowJob} from '@/stores/schemas';
import {History as HistoryIcon} from '@mui/icons-material';
import {Box, CircularProgress, List, Typography} from '@mui/material';

interface JobListProps {
  jobs: MowJob[];
  loading: boolean;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

/** Scrollable newest-first list of mow jobs in the currently selected date range. Selecting a
 * row is what drives the History map + event list (see HistoryPage). */
export default function JobList({jobs, loading, selectedJobId, onSelectJob}: JobListProps) {
  return (
    <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0}}>
        <HistoryIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={600}>
          Jobs
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({jobs.length})
        </Typography>
        {loading && <CircularProgress size={14} sx={{ml: 'auto'}} />}
      </Box>
      <Box sx={{flex: 1, overflowY: 'auto', minHeight: 0}}>
        {jobs.length === 0 && !loading ? (
          <Box sx={{py: 3, textAlign: 'center'}}>
            <Typography variant="body2" color="text.secondary">
              No jobs in this range.
            </Typography>
          </Box>
        ) : (
          <List disablePadding dense>
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} selected={job.id === selectedJobId} onSelect={onSelectJob} />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
