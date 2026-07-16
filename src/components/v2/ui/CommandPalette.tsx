'use client';

import {cn} from '@/components/v2/lib/cn';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';

export interface CommandPaletteAction {
  id: string;
  label: string;
  /** Right-aligned shortcut hint, e.g. "Ctrl+Z". */
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onRun: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: CommandPaletteAction[];
  placeholder?: string;
}

/** A `Ctrl/Cmd+K`-style filterable action list — run any command by typing its name. Generic:
 *  callers supply the action list, this only handles search/keyboard nav/run. */
export function CommandPalette({open, onClose, actions, placeholder = 'Type a command…'}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  if (!open) return null;

  const run = (action: CommandPaletteAction | undefined) => {
    if (!action || action.disabled) return;
    onClose();
    action.onRun();
  };

  return (
    <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
      <div
        aria-hidden
        onClick={onClose}
        style={{background: 'color-mix(in srgb, var(--ink) 32%, transparent)'}}
        className="absolute inset-0"
      />
      <div className="absolute left-1/2 top-[12%] w-[min(92vw,480px)] -translate-x-1/2 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-s)]">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClose();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(filtered[activeIndex]);
            }
          }}
          className="h-12 w-full border-0 border-b border-border bg-transparent px-3.5 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-[.8rem] text-ink-faint">No matching commands.</div>
          ) : (
            filtered.map((action, i) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                onClick={() => run(action)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[10px] border-0 px-2.5 py-2 text-left text-[.85rem] text-ink disabled:opacity-40',
                  i === activeIndex ? 'bg-accent-wash text-accent' : 'bg-transparent',
                )}
              >
                {action.icon ? <span className="flex-none">{action.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                {action.hint ? <span className="flex-none font-mono text-[.7rem] text-ink-faint">{action.hint}</span> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
