'use client';

// Dev-only kit gallery — every shared v2 primitive in its states, for visual QA and as the
// surface for per-component visual-regression tests later. Not linked in nav; /v2/kit.
import {Button} from '@/components/v2/ui/Button';
import {Chip} from '@/components/v2/ui/Chip';
import {Fab} from '@/components/v2/ui/Fab';
import {FormField} from '@/components/v2/ui/FormField';
import {KpiTile} from '@/components/v2/ui/KpiTile';
import {ListRow} from '@/components/v2/ui/ListRow';
import {ProgressBar} from '@/components/v2/ui/ProgressBar';
import {SegmentedToggle} from '@/components/v2/ui/SegmentedToggle';
import {Sheet} from '@/components/v2/ui/Sheet';
import {Slider} from '@/components/v2/ui/Slider';
import {StatCard} from '@/components/v2/ui/StatCard';
import {Switch} from '@/components/v2/ui/Switch';
import {ChevronRight, Locate, Layers, Plus, Ruler, Sprout} from 'lucide-react';
import {useState} from 'react';

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[.7rem] font-semibold uppercase tracking-[.1em] text-ink-faint">{title}</h2>
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">{children}</div>
    </section>
  );
}

export default function KitPage() {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [height, setHeight] = useState(45);
  const [speed, setSpeed] = useState('normal');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="mx-auto grid max-w-[900px] grid-cols-1 gap-6 p-5 md:grid-cols-2">
      <header className="md:col-span-2">
        <div className="font-mono text-[.66rem] font-semibold uppercase tracking-[.1em] text-ink-faint">v2 design system</div>
        <h1 className="text-xl font-bold tracking-tight text-ink md:text-[1.4rem]">Component kit</h1>
      </header>

      <Section title="Switch">
        <ListRow title="Rain-skip" sub="Skip a run when rain is likely" trailing={<Switch checked={on} onCheckedChange={setOn} aria-label="Rain-skip" />} />
        <ListRow title="Notifications" sub="Off" trailing={<Switch checked={off} onCheckedChange={setOff} aria-label="Notifications" />} />
        <ListRow title="Disabled" trailing={<Switch checked disabled onCheckedChange={() => {}} aria-label="Disabled" />} />
      </Section>

      <Section title="Slider · FormField">
        <FormField label="Cutting height" value={height} unit=" mm" hint="Applies to the whole map unless an area overrides it.">
          <Slider value={height} min={20} max={70} step={5} onChange={setHeight} aria-label="Cutting height" />
        </FormField>
      </Section>

      <Section title="Segmented · Chips">
        <SegmentedToggle
          label="Speed"
          value={speed}
          onChange={setSpeed}
          options={[
            {value: 'slow', label: 'Slow'},
            {value: 'normal', label: 'Normal'},
            {value: 'fast', label: 'Fast'},
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          <Chip variant="ok">● RTK fixed</Chip>
          <Chip variant="warn">Rain likely</Chip>
          <Chip variant="danger">Bumper</Chip>
          <Chip variant="info">Charging</Chip>
          <Chip variant="neutral">Idle</Chip>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Start mowing</Button>
          <Button variant="ghost">Edit</Button>
          <Button variant="danger">Stop</Button>
          <Button variant="danger-solid">Stop</Button>
          <Button variant="soft" size="icon" aria-label="x">
            <Plus size={17} />
          </Button>
        </div>
      </Section>

      <Section title="ListRow">
        <ListRow icon={<Ruler size={17} className="text-ink-soft" />} title="Cutting height" sub="45 mm" trailing={<ChevronRight size={17} className="text-ink-faint" />} onClick={() => {}} />
        <ListRow icon={<Sprout size={17} className="text-accent" />} title="Etupiha" sub="Grass · 45 mm" trailing={<ChevronRight size={17} className="text-ink-faint" />} onClick={() => {}} />
      </Section>

      <Section title="KPI · ProgressBar">
        <div className="grid grid-cols-3 gap-2">
          <KpiTile value={24} unit=" min" label="Time left" accent />
          <KpiTile value={148} unit=" m²" label="Remaining" />
          <KpiTile value={71} unit=" %" label="Battery" />
        </div>
        <ProgressBar value={62} />
      </Section>

      <Section title="Fab · StatCard · Sheet">
        <div className="flex items-center gap-3">
          <Fab aria-label="Locate" icon={<Locate size={18} />} onClick={() => {}} />
          <Fab aria-label="Layers" icon={<Layers size={18} />} onClick={() => {}} />
          <Fab aria-label="Add" icon={<Plus size={18} />} onClick={() => {}} />
          <Button variant="primary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
        </div>
        <StatCard>
          <div className="text-[.82rem] font-semibold text-ink">Mowing Etupiha</div>
          <div className="text-[.72rem] text-ink-soft">62% · 24 min left</div>
        </StatCard>
      </Section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Area settings">
        <FormField label="Cutting height" value={height} unit=" mm">
          <Slider value={height} min={20} max={70} step={5} onChange={setHeight} aria-label="Cutting height" />
        </FormField>
        <ListRow title="Include in schedule" trailing={<Switch checked={on} onCheckedChange={setOn} aria-label="Include" />} />
        <Button variant="primary" className="mt-1 justify-center" onClick={() => setSheetOpen(false)}>
          Done
        </Button>
      </Sheet>
    </div>
  );
}
