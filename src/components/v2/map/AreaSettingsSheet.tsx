'use client';

// Per-area settings editor — AREA_SETTINGS_SPEC.md. Synthesis of v1's "mowing settings overrides",
// the v2 concept's area-settings screen (mobile M2 / desktop D2), and Yarbo/competitor per-area
// settings research. Renders as a bottom Sheet on mobile and a persistent right-hand panel on
// desktop (md+) — same content component either way. All data is MOCK/local; edits commit through
// useMapEditor (so they ride the same undo/redo as geometry edits) and nothing is sent over RPC yet.
import {boundingBox, polygonArea} from '@/components/v2/map/geometry';
import {GLOBAL_DEFAULTS, type AreaSettings, type Zone, type ZoneType} from '@/components/v2/map/mockMap';
import {Button} from '@/components/v2/ui/Button';
import {FormField} from '@/components/v2/ui/FormField';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Slider} from '@/components/v2/ui/Slider';
import {Switch} from '@/components/v2/ui/Switch';
import {AlertTriangle, ChevronDown, ChevronRight, Eye, Minus, Plus, RotateCcw, X} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';

const ZONE_TYPE_OPTIONS: {value: ZoneType; label: string}[] = [
  {value: 'mow', label: 'Mowing'},
  {value: 'nav', label: 'Navigation'},
  {value: 'obstacle', label: 'Obstacle'},
];

const ROUTE_PATTERN_OPTIONS: {value: NonNullable<AreaSettings['route_pattern']>; label: string}[] = [
  {value: 'parallel', label: 'Parallel'},
  {value: 'spiral', label: 'Spiral'},
  {value: 'grid', label: 'Grid'},
  {value: 'adaptive', label: 'Adaptive'},
];

const MOW_SPEED_OPTIONS: {value: NonNullable<AreaSettings['mow_speed']>; label: string}[] = [
  {value: 'slow', label: 'Slow'},
  {value: 'normal', label: 'Normal'},
  {value: 'fast', label: 'Fast'},
];

const TURNING_MODE_OPTIONS: {value: NonNullable<AreaSettings['turning_mode']>; label: string}[] = [
  {value: 'smart', label: 'Smart'},
  {value: 'uturn', label: 'U-turn'},
  {value: 'zeroturn', label: 'Zero-turn'},
];

const PERIMETER_DIRECTION_OPTIONS: {value: NonNullable<AreaSettings['perimeter_direction']>; label: string}[] = [
  {value: 'auto', label: 'Auto'},
  {value: 'cw', label: 'CW'},
  {value: 'ccw', label: 'CCW'},
];

const MOWING_ORDER_OPTIONS = [
  {value: 'perimeter', label: 'Perimeter first'},
  {value: 'infill', label: 'Infill first'},
];

// Keys counted toward the Advanced section's "N overrides" badge (the Primary section's own
// angle/outline_offset/cutting_height_mm aren't counted there — they're always visible, not
// tucked behind the disclosure).
const ADVANCED_KEYS: (keyof AreaSettings)[] = [
  'outline_count',
  'outline_overlap_count',
  'mow_speed',
  'turning_mode',
  'perimeter_direction',
  'perimeter_first',
  'rotate_between_sessions',
  'mow_ngz_edges',
];

const TOOL_WIDTH_M = 0.3; // mock assumed cutting width, for the Preview estimate only

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
function clampAngleDeg(deg: number): number {
  return Math.max(-180, Math.min(180, deg));
}

interface PreviewEstimate {
  areaM2: number;
  minutes: number;
  passes: number;
}

/** MOCK time/passes estimate from the zone's real polygon area — local only, never sent to ROS. */
function estimatePreview(zone: Zone): PreviewEstimate {
  const areaM2 = polygonArea(zone.outline);
  const speedMps = zone.settings?.mow_speed === 'fast' ? 0.35 : zone.settings?.mow_speed === 'slow' ? 0.15 : 0.25;
  const bbox = boundingBox(zone.outline);
  const passes = bbox ? Math.max(1, Math.round(Math.max(bbox.width, bbox.height) / TOOL_WIDTH_M)) : 1;
  const pathLengthM = areaM2 / TOOL_WIDTH_M;
  const minutes = Math.max(1, Math.round(pathLengthM / speedMps / 60));
  return {areaM2, minutes, passes};
}

export interface AreaSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  zone: Zone | undefined;
  onSwitchZone: () => void;
  onRename: (name: string) => void;
  onSetType: (type: ZoneType) => void;
  onSetActive: (active: boolean) => void;
  onUpdateSettings: (patch: Partial<AreaSettings>) => void;
  onResetSettings: () => void;
}

export function AreaSettingsSheet(props: AreaSettingsSheetProps) {
  const {open, onClose, zone} = props;
  if (!zone) return null;
  return (
    <>
      {/* Mobile: bottom sheet. */}
      <div className="md:hidden">
        <Sheet open={open} onClose={onClose} title={zone.name}>
          <AreaSettingsContent key={zone.id} {...props} zone={zone} />
        </Sheet>
      </div>

      {/* Desktop (md+): persistent right-hand panel, map stays interactive. */}
      {open && (
        <div className="absolute right-3 top-16 bottom-3 z-[500] hidden w-[360px] flex-col overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-[var(--shadow-s)] md:flex">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[.95rem] font-semibold text-ink">{zone.name}</div>
            <Button variant="soft" size="icon" className="h-8 w-8" aria-label="Close" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
          <AreaSettingsContent key={zone.id} {...props} zone={zone} />
        </div>
      )}
    </>
  );
}

function AreaSettingsContent({
  zone,
  onSwitchZone,
  onRename,
  onSetType,
  onSetActive,
  onUpdateSettings,
  onResetSettings,
}: AreaSettingsSheetProps & {zone: Zone}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewEstimate | null>(null);
  const settings = zone.settings ?? {};
  const areaM2 = polygonArea(zone.outline);
  const overrideCount = ADVANCED_KEYS.filter((k) => settings[k] !== undefined).length;

  const angleDeg = settings.angle !== undefined ? Math.round(radToDeg(settings.angle)) : null;
  const setAngleDeg = (deg: number) => onUpdateSettings({angle: degToRad(clampAngleDeg(deg))});

  return (
    <div className="space-y-3.5">
      <Button variant="ghost" size="sm" className="w-full justify-between" onClick={onSwitchZone}>
        <span className="font-normal text-ink-soft">
          {zone.type} · {areaM2.toFixed(0)} m²
        </span>
        <span>Change zone ›</span>
      </Button>

      {/* Basics — every zone type. */}
      <FormField label="Name">
        <input
          key={zone.id}
          type="text"
          defaultValue={zone.name}
          onBlur={(e) => onRename(e.target.value || zone.name)}
          className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface-2 px-2.5 text-sm text-ink"
        />
      </FormField>

      <FormField label="Type">
        <SegmentedToggle options={ZONE_TYPE_OPTIONS} value={zone.type} onChange={(v) => onSetType(v as ZoneType)} />
      </FormField>

      <FormField label="Active">
        <div className="flex items-center justify-between">
          <span className="text-[.78rem] text-ink-soft">
            {zone.active === false ? 'Skipped during mowing' : 'Included when mowing'}
          </span>
          <Switch checked={zone.active !== false} onCheckedChange={onSetActive} aria-label="Zone active" />
        </div>
      </FormField>

      {zone.type === 'mow' && (
        <>
          <div className="h-px bg-border" />

          {/* Primary mowing settings. */}
          <FormField label="Route pattern">
            <SegmentedToggle
              options={ROUTE_PATTERN_OPTIONS}
              value={settings.route_pattern ?? GLOBAL_DEFAULTS.route_pattern}
              onChange={(v) => onUpdateSettings({route_pattern: v as AreaSettings['route_pattern']})}
            />
          </FormField>

          <FormField label="Mow angle" hint={angleDeg === null ? 'Auto-detected from the outline.' : undefined}>
            <div className="flex items-center gap-2">
              <Button
                variant="soft"
                size="icon"
                className="h-9 w-9"
                aria-label="Decrease angle"
                onClick={() => setAngleDeg((angleDeg ?? 0) - 5)}
              >
                <Minus size={14} />
              </Button>
              <div className="flex-1 text-center font-mono text-sm tabular-nums text-ink">
                {angleDeg === null ? 'Auto' : `${angleDeg}°`}
              </div>
              <Button
                variant="soft"
                size="icon"
                className="h-9 w-9"
                aria-label="Increase angle"
                onClick={() => setAngleDeg((angleDeg ?? 0) + 5)}
              >
                <Plus size={14} />
              </Button>
            </div>
            {angleDeg !== null && (
              <Button variant="ghost" size="sm" className="mt-1.5 w-full justify-center" onClick={() => onUpdateSettings({angle: undefined})}>
                Reset to auto
              </Button>
            )}
          </FormField>

          <DebouncedSliderField
            label="Outline offset"
            value={settings.outline_offset ?? GLOBAL_DEFAULTS.outline_offset}
            display={(v) => v.toFixed(2)}
            unit=" m"
            min={0}
            max={0.5}
            step={0.01}
            inherited={settings.outline_offset === undefined}
            onCommit={(v) => onUpdateSettings({outline_offset: v})}
          />

          <DebouncedSliderField
            label="Cutting height"
            value={settings.cutting_height_mm ?? GLOBAL_DEFAULTS.cutting_height_mm}
            display={(v) => Math.round(v).toString()}
            unit=" mm"
            min={20}
            max={80}
            step={1}
            inherited={settings.cutting_height_mm === undefined}
            onCommit={(v) => onUpdateSettings({cutting_height_mm: Math.round(v)})}
          >
            <div className="mt-1.5 flex items-start gap-1.5 text-[.7rem] leading-[1.4] text-ink-faint">
              <AlertTriangle size={12} className="mt-[.1rem] flex-none" />
              <span>No motorized deck — you&apos;ll confirm this on the mower before a lower cut.</span>
            </div>
          </DebouncedSliderField>

          {/* Advanced — collapsed by default. */}
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
          >
            <span>
              Advanced{overrideCount > 0 ? ` · ${overrideCount} override${overrideCount === 1 ? '' : 's'}` : ''}
            </span>
            {advancedOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </Button>

          {advancedOpen && (
            <div className="space-y-3.5">
              <NumberStepperField
                label="Outline count"
                value={settings.outline_count}
                placeholder={GLOBAL_DEFAULTS.outline_count}
                min={0}
                hint="≥4 recommended"
                onChange={(v) => onUpdateSettings({outline_count: v})}
              />
              <NumberStepperField
                label="Outline overlap count"
                value={settings.outline_overlap_count}
                placeholder={GLOBAL_DEFAULTS.outline_overlap_count}
                min={0}
                onChange={(v) => onUpdateSettings({outline_overlap_count: v})}
              />
              <FormField label="Mowing speed">
                <SegmentedToggle
                  options={MOW_SPEED_OPTIONS}
                  value={settings.mow_speed ?? GLOBAL_DEFAULTS.mow_speed}
                  onChange={(v) => onUpdateSettings({mow_speed: v as AreaSettings['mow_speed']})}
                />
              </FormField>
              <FormField label="Turning mode">
                <SegmentedToggle
                  options={TURNING_MODE_OPTIONS}
                  value={settings.turning_mode ?? GLOBAL_DEFAULTS.turning_mode}
                  onChange={(v) => onUpdateSettings({turning_mode: v as AreaSettings['turning_mode']})}
                />
              </FormField>
              <FormField label="Perimeter direction">
                <SegmentedToggle
                  options={PERIMETER_DIRECTION_OPTIONS}
                  value={settings.perimeter_direction ?? GLOBAL_DEFAULTS.perimeter_direction}
                  onChange={(v) => onUpdateSettings({perimeter_direction: v as AreaSettings['perimeter_direction']})}
                />
              </FormField>
              <FormField label="Mowing order">
                <SegmentedToggle
                  options={MOWING_ORDER_OPTIONS}
                  value={(settings.perimeter_first ?? GLOBAL_DEFAULTS.perimeter_first) ? 'perimeter' : 'infill'}
                  onChange={(v) => onUpdateSettings({perimeter_first: v === 'perimeter'})}
                />
              </FormField>
              <FormField label="Rotate pattern between sessions">
                <div className="flex items-center justify-between">
                  <span className="text-[.72rem] text-ink-faint">Anti-rut.</span>
                  <Switch
                    checked={settings.rotate_between_sessions ?? GLOBAL_DEFAULTS.rotate_between_sessions}
                    onCheckedChange={(v) => onUpdateSettings({rotate_between_sessions: v})}
                    aria-label="Rotate pattern between sessions"
                  />
                </div>
              </FormField>
              <FormField label="Mow along no-go / obstacle edges">
                <div className="flex items-center justify-between">
                  <span className="text-[.72rem] text-ink-faint">&nbsp;</span>
                  <Switch
                    checked={settings.mow_ngz_edges ?? GLOBAL_DEFAULTS.mow_ngz_edges}
                    onCheckedChange={(v) => onUpdateSettings({mow_ngz_edges: v})}
                    aria-label="Mow along no-go/obstacle edges"
                  />
                </div>
              </FormField>
            </div>
          )}

          <div className="h-px bg-border" />

          {/* Footer. */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={onResetSettings}>
              <RotateCcw size={14} /> Restore defaults
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={() => setPreview(estimatePreview(zone))}>
              <Eye size={14} /> Preview
            </Button>
          </div>

          {preview && (
            <>
              <div className="text-center text-[.78rem] font-semibold text-accent">Preview {preview.minutes} min</div>
              <div className="grid grid-cols-3 gap-2">
                <KpiTile value={preview.minutes} unit=" min" label="Est. time" />
                <KpiTile value={preview.areaM2.toFixed(0)} unit=" m²" label="Area" />
                <KpiTile value={preview.passes} label="Passes" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface NumberStepperFieldProps {
  label: string;
  value: number | undefined;
  placeholder: number;
  min?: number;
  step?: number;
  hint?: string;
  onChange: (value: number) => void;
}

/** A "− N +" stepper for an optional non-negative integer override; shows the inherited global
 *  default as the displayed value (and a hint) until the user touches it. */
function NumberStepperField({label, value, placeholder, min = 0, step = 1, hint, onChange}: NumberStepperFieldProps) {
  const display = value ?? placeholder;
  return (
    <FormField label={label} hint={value === undefined ? [hint, `Inherited: ${placeholder}`].filter(Boolean).join(' · ') : hint}>
      <div className="flex items-center gap-2">
        <Button
          variant="soft"
          size="icon"
          className="h-9 w-9"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, display - step))}
        >
          <Minus size={14} />
        </Button>
        <div className="flex-1 text-center font-mono text-sm tabular-nums text-ink">{display}</div>
        <Button variant="soft" size="icon" className="h-9 w-9" aria-label={`Increase ${label}`} onClick={() => onChange(display + step)}>
          <Plus size={14} />
        </Button>
      </div>
    </FormField>
  );
}

interface DebouncedSliderFieldProps {
  label: string;
  value: number;
  display: (value: number) => string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
  /** True when `value` is the inherited GLOBAL_DEFAULTS fallback (the field itself is unset) —
   *  shows the same "Inherited: …" affordance as the Advanced steppers. */
  inherited?: boolean;
  children?: ReactNode;
}

/**
 * A Slider whose value updates live while dragging (for the on-screen badge) but only commits to
 * the undo-tracked editor state once, on pointer/touch release — "debounce slider drags to one
 * entry on release" (AREA_SETTINGS_SPEC.md). Wraps the shared kit Slider rather than changing it,
 * since Slider is used well beyond the map editor.
 */
function DebouncedSliderField({label, value, display, unit, min, max, step, onCommit, inherited, children}: DebouncedSliderFieldProps) {
  const [draft, setDraft] = useState(value);
  // Re-sync when the committed value changes for a reason OTHER than our own drag (switching
  // zones, Restore defaults, undo/redo) — a no-op while dragging, since `value` only changes once
  // we ourselves commit it.
  useEffect(() => setDraft(value), [value]);
  return (
    <FormField
      label={label}
      value={display(draft)}
      unit={unit}
      hint={inherited ? `Inherited: ${display(value)}${unit ?? ''}` : undefined}
    >
      <div
        onPointerUp={() => onCommit(draft)}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            onCommit(draft);
          }
        }}
      >
        <Slider value={draft} min={min} max={max} step={step} onChange={setDraft} aria-label={label} />
      </div>
      {children}
    </FormField>
  );
}
