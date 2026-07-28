import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BranchPerformanceItem } from '../../dashboardMetrics';
import { getBranchImage } from '../../dashboardBranchMedia';

interface BranchIntelligenceProps {
  branches: BranchPerformanceItem[];
}

const healthStyles: Record<BranchPerformanceItem['health'], string> = {
  healthy: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200',
  attention: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  critical: 'border-rose-300/50 bg-rose-400/20 text-rose-100',
};

const healthLabels: Record<BranchPerformanceItem['health'], string> = {
  healthy: 'Healthy',
  attention: 'Needs attention',
  critical: 'Critical',
};

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '0';
}

export default function BranchIntelligence({ branches }: BranchIntelligenceProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedBranch, setSelectedBranch] = useState<BranchPerformanceItem | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const carouselRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTriggerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = () => setSelectedBranch(null);

  useEffect(() => {
    setActiveIndex(current => Math.min(current, Math.max(branches.length - 1, 0)));
    setSelectedBranch(current => current
      ? branches.find(branch => branch.branch === current.branch) || null
      : null);
  }, [branches]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!(branches.length > 1) || isPaused || prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % branches.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [branches.length, isPaused, prefersReducedMotion]);

  useEffect(() => {
    if (!selectedBranch) return;
    const trigger = dialogTriggerRef.current;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog();
        return;
      }
      const isTabKey = event.key === 'Tab';
      if (!isTabKey) return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = (Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )) as HTMLElement[]).filter(element => element.tabIndex >= 0);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => dialogTriggerRef.current?.focus());
      if (!trigger?.isConnected) dialogTriggerRef.current = null;
    };
  }, [selectedBranch]);

  useEffect(() => {
    if (!selectedBranch || typeof document === 'undefined') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const backgroundElements = (Array.from(document.body.children) as HTMLElement[])
      .filter(element => !element.contains(dialog));
    const previousAttributes = backgroundElements.map(element => ({
      element,
      inert: element.hasAttribute('inert'),
      ariaHidden: element.getAttribute('aria-hidden'),
    }));

    for (const element of backgroundElements) {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    }

    return () => {
      for (const { element, inert, ariaHidden } of previousAttributes) {
        if (!inert) element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
    };
  }, [selectedBranch]);

  if (branches.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 p-8 text-center text-slate-300">
        <h2 className="text-lg font-black text-white">Branch Intelligence</h2>
        <p className="mt-2 text-sm">No branch performance data</p>
      </section>
    );
  }

  const previous = () => setActiveIndex(current => (current - 1 + branches.length) % branches.length);
  const next = () => setActiveIndex(current => (current + 1) % branches.length);

  return (
    <section
      ref={carouselRef}
      aria-label="Branch intelligence"
      aria-roledescription="carousel"
      className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 text-white shadow-2xl shadow-cyan-950/30"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (!carouselRef.current?.contains(document.activeElement)) setIsPaused(false);
      }}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
      }}
    >
      <div inert={Boolean(selectedBranch)} aria-hidden={selectedBranch ? 'true' : undefined}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_42%)]" />
      <header className="relative flex flex-col gap-2 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">Live filtered operations</p>
          <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Branch Intelligence</h2>
        </div>
        <p className="text-xs text-slate-400">{activeIndex + 1} / {branches.length}</p>
      </header>

      <div className="relative min-h-[39rem] sm:min-h-[31rem] lg:min-h-[28rem]">
        {branches.map((branch, index) => (
          <article
            key={branch.branch}
            aria-hidden={index !== activeIndex}
            className={`absolute inset-0 grid gap-0 transition-opacity duration-700 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] ${
              index === activeIndex ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <div className="relative aspect-[16/9] min-w-0 overflow-hidden lg:aspect-auto">
              {failedImages.has(branch.branch) ? (
                <div
                  role="img"
                  aria-label={`Image unavailable for ${branch.branch}`}
                  className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-center"
                >
                  <div className="rounded-2xl border border-cyan-300/20 bg-blue-950/80 px-6 py-5 shadow-inner">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Branch image unavailable</p>
                    <p className="mt-2 text-sm font-semibold text-slate-300">{branch.branch}</p>
                  </div>
                </div>
              ) : (
                <img
                  src={getBranchImage(branch.branch)}
                  alt={`${branch.branch} branch facility`}
                  loading="lazy"
                  onError={() => setFailedImages(current => new Set(current).add(branch.branch))}
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-slate-950" />
            </div>

            <div className="flex min-w-0 flex-col justify-center p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Current branch</p>
                  <h3 className="mt-1 break-words text-xl font-black leading-tight sm:text-2xl">{branch.branch}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${healthStyles[branch.health]}`}>
                  {healthLabels[branch.health]}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Inspections', branch.inspections],
                  ['Defects', branch.inspectionDefects],
                  ['Open incidents', branch.openIncidents],
                  ['Repairing', branch.repairing],
                  ['PM alerts', branch.pmDueSoon + branch.pmOverdue],
                  ['Completed', branch.completed],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="mt-1 text-lg font-black text-white">{formatNumber(value as number)}</p>
                  </div>
                ))}
                <div className="col-span-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Repair cost</p>
                  <p className="mt-1 break-words text-lg font-black text-cyan-200">LAK {formatNumber(branch.repairCost)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Latest status</p>
                  <p className="mt-1 break-words text-sm font-bold text-slate-200">{branch.latestStatus}</p>
                </div>
                <button
                  type="button"
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={(event) => {
                    dialogTriggerRef.current = event.currentTarget;
                    setSelectedBranch(branch);
                  }}
                  className="shrink-0 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                >
                  View details
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <footer className="relative z-20 flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-7">
        <button
          type="button"
          aria-label="Previous branch"
          onClick={previous}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-lg transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        >
          ‹
        </button>
        <div className="flex min-w-0 flex-wrap justify-center gap-2">
          {branches.map((branch, index) => (
            <button
              key={branch.branch}
              type="button"
              aria-label={`Go to branch ${index + 1}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                index === activeIndex ? 'w-8 bg-cyan-300' : 'w-2.5 bg-slate-600 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next branch"
          onClick={next}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-lg transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        >
          ›
        </button>
      </footer>
      </div>

      {selectedBranch && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-detail-title"
            tabIndex={-1}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-300/25 bg-slate-900 p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Read-only branch detail</p>
                <h3 id="branch-detail-title" className="mt-1 break-words text-xl font-black sm:text-2xl">{selectedBranch.branch}</h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close branch details"
                onClick={closeDialog}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-xl text-slate-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Inspections', selectedBranch.inspections],
                ['Inspection defects', selectedBranch.inspectionDefects],
                ['Open incidents', selectedBranch.openIncidents],
                ['High severity', selectedBranch.highSeverity],
                ['Waiting assessment', selectedBranch.waitingAssessment],
                ['Waiting approval', selectedBranch.waitingApproval],
                ['Repairing', selectedBranch.repairing],
                ['Completed', selectedBranch.completed],
                ['PM due soon', selectedBranch.pmDueSoon],
                ['PM overdue', selectedBranch.pmOverdue],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="break-words text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-1 text-lg font-black">{formatNumber(value as number)}</p>
                </div>
              ))}
              <div className="col-span-2 min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:col-span-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Repair cost</p>
                <p className="mt-1 break-words text-lg font-black text-cyan-200">LAK {formatNumber(selectedBranch.repairCost)}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Health</p>
                <p className="mt-1 break-words text-sm font-black">{healthLabels[selectedBranch.health]}</p>
              </div>
            </div>
            <div className="mt-3 min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Latest status</p>
              <p className="mt-1 break-words text-sm font-bold">{selectedBranch.latestStatus}</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
