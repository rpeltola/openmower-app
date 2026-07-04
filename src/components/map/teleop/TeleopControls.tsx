'use client';

import {useTeleop} from '@/hooks/useTeleop';
import {Box, Typography, useMediaQuery, useTheme} from '@mui/material';
import VirtualJoystick from './VirtualJoystick';

export default function TeleopControls({disabled = false}: {disabled?: boolean}) {
  const {setVelocity} = useTeleop();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: isMobile ? 16 : 24,
        left: isMobile ? '50%' : 24,
        transform: isMobile ? 'translateX(-50%)' : 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {/* Manual driving is only allowed in Area Recording mode. When it's off the
          joystick is greyed + inert and this hint explains why. */}
      {disabled && (
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            color: 'rgba(255,255,255,0.85)',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            textAlign: 'center',
            maxWidth: 180,
          }}
        >
          Turn on Area Recording to drive
        </Typography>
      )}
      <VirtualJoystick onVelocityChange={disabled ? () => {} : setVelocity} disabled={disabled} />
    </Box>
  );
}
