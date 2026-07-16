// VESC ESC fault codes. The firmware reports the ESC's own `mc_fault_code` (0 = no fault),
// which the app_gateway forwards verbatim as `fault_code`; this turns the raw number into a
// short human phrase for the sensors page. Values and order MUST match the firmware enum in
// fw-openmower-v2 src/drivers/motor/vesc/datatypes.h (mc_fault_code, 0..29) -- an ESC whose
// driver cannot name a fault reports 0, so 0 always reads as "OK", never as a real fault.

const ESC_FAULT_LABELS: Record<number, string> = {
  0: 'OK',
  1: 'Over-voltage',
  2: 'Under-voltage',
  3: 'DRV fault',
  4: 'Over-current',
  5: 'Over-temp (FET)',
  6: 'Over-temp (motor)',
  7: 'Gate driver over-voltage',
  8: 'Gate driver under-voltage',
  9: 'MCU under-voltage',
  10: 'Booting from watchdog reset',
  11: 'Encoder SPI',
  12: 'Encoder amplitude low',
  13: 'Encoder amplitude high',
  14: 'Flash corruption',
  15: 'Current sensor 1 offset',
  16: 'Current sensor 2 offset',
  17: 'Current sensor 3 offset',
  18: 'Unbalanced currents',
  19: 'Brake fault',
  20: 'Resolver LOT',
  21: 'Resolver DOS',
  22: 'Resolver LOS',
  23: 'Flash corruption (app cfg)',
  24: 'Flash corruption (mc cfg)',
  25: 'Encoder: no magnet',
  26: 'Encoder: magnet too strong',
  27: 'Phase filter',
  28: 'Encoder fault',
  29: 'LV output fault',
};

/** True for any reported fault, i.e. a non-zero code. */
export function escHasFault(code: number | null | undefined): boolean {
  return code != null && code !== 0;
}

/**
 * Human label for an ESC fault code. Unknown (out-of-range) codes fall back to their number
 * rather than "OK", so a firmware that gains a code the app doesn't know still reads as a
 * fault instead of silently looking healthy.
 */
export function fmtEscFault(code: number | null | undefined): string {
  if (code == null) return '—';
  return ESC_FAULT_LABELS[code] ?? `Fault ${code}`;
}
