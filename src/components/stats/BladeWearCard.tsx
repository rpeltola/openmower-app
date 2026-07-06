'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import type {BladeStatus} from '@/stores/schemas';
import {ContentCut as BladeIcon} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  LinearProgress,
  Typography,
  useTheme,
} from '@mui/material';
import {useState} from 'react';

interface BladeWearCardProps {
  blade: BladeStatus | null;
  onResetBlade: () => void;
}

/** Blade-wear card: total + left/right run hours, a change-due indicator, and the
 * "Changed blades" action that publishes `blade/reset` (see persistence/DESIGN.md's
 * ResetBlade service / MQTT contract) after a confirm dialog. Shows a clean "no data" state
 * until stats/json arrives -- never fabricated wear figures. */
export default function BladeWearCard({blade, onResetBlade}: BladeWearCardProps) {
  const theme = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const total = blade?.total_hours ?? 0;
  const interval = blade?.interval_hours ?? 0;
  const percent = interval > 0 ? Math.min(100, (total / interval) * 100) : 0;
  const remaining = Math.max(0, interval - total);
  const progressColor = blade?.due ? 'error' : percent > 80 ? 'warning' : 'primary';

  const handleConfirm = () => {
    onResetBlade();
    setConfirmOpen(false);
  };

  return (
    <Card sx={outerCardStyles(theme)}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap'}}>
          <Box sx={{color: 'primary.main', display: 'flex'}}>
            <BladeIcon />
          </Box>
          <Typography variant="h6" component="h2">
            Blade wear
          </Typography>
          {blade?.due && <Chip size="small" color="error" label="Change due" />}
        </Box>

        {blade ? (
          <>
            <Box sx={{mb: 2}}>
              <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 0.5}}>
                <Typography variant="body2" color="text.secondary">
                  Total run time
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {total.toFixed(1)} h / {interval.toFixed(0)} h
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={percent}
                color={progressColor}
                sx={{height: 6, borderRadius: 3}}
              />
              <Typography variant="caption" color="text.secondary" sx={{mt: 0.5, display: 'block'}}>
                {blade.due ? 'Change interval reached' : `${remaining.toFixed(1)} h until change due`}
              </Typography>
            </Box>
            <Divider sx={{my: 1}} />
            <Box sx={{display: 'flex', justifyContent: 'space-between', py: 0.5}}>
              <Typography variant="body2" color="text.secondary">
                Left side
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {blade.left_hours.toFixed(1)} h
              </Typography>
            </Box>
            <Box sx={{display: 'flex', justifyContent: 'space-between', py: 0.5}}>
              <Typography variant="body2" color="text.secondary">
                Right side
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {blade.right_hours.toFixed(1)} h
              </Typography>
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.disabled">
            No blade data yet.
          </Typography>
        )}

        <Button variant="outlined" color="warning" sx={{mt: 2}} onClick={() => setConfirmOpen(true)} disabled={!blade}>
          Changed blades
        </Button>

        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Reset blade wear counters?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This resets the blade run-time counters to zero and starts tracking a new blade
              lifetime. Only confirm after you&apos;ve physically changed the blades.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} variant="contained" color="warning">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
