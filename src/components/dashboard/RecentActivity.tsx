import React from 'react';
import { Activity, CalendarDays, MapPin } from 'lucide-react';
import type { RecentActivityItem } from '../../dashboardMetrics';

interface RecentActivityProps {
  items: RecentActivityItem[];
}

const sourceStyles: Record<string, string> = {
  Inspection: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100',
  Incident: 'border-rose-300/40 bg-rose-400/10 text-rose-100',
  Assessment: 'border-violet-300/40 bg-violet-400/10 text-violet-100',
  Approval: 'border-amber-300/40 bg-amber-400/10 text-amber-100',
  Tracking: 'border-blue-300/40 bg-blue-400/10 text-blue-100',
  'Repair History': 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100',
  'PM History': 'border-yellow-300/40 bg-yellow-400/10 text-yellow-100',
};

export default function RecentActivity({ items }: RecentActivityProps) {
  const visibleItems = items.slice(0, 10);

  return (
    <section
      id="dashboard-recent-activity"
      aria-label="Recent activity timeline"
      className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 px-4 py-5 text-slate-100 shadow-[0_22px_70px_-35px_rgba(34,211,238,0.7)] sm:px-6"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl motion-safe:animate-pulse motion-reduce:animate-none" />

      <header className="relative mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-300">Operations stream</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-black text-white sm:text-lg">
            <Activity aria-hidden="true" className="h-5 w-5 text-cyan-300" />
            Recent Activity
          </h2>
        </div>
        <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-100">
          Latest {visibleItems.length}
        </span>
      </header>

      {visibleItems.length === 0 ? (
        <p className="relative rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-10 text-center text-sm font-semibold text-slate-300">
          ຍັງບໍ່ມີກິດຈະກຳ
        </p>
      ) : (
        <div className="relative max-h-[32rem] overflow-y-auto pr-1 [scrollbar-color:rgba(34,211,238,0.45)_rgba(15,23,42,0.8)]">
          <ol role="list" aria-label="Recent activity events" className="space-y-3">
            {visibleItems.map((item) => (
              <li
                key={`${item.source}:${item.id}`}
                role="listitem"
                tabIndex={0}
                className="group relative rounded-xl border border-slate-700/80 bg-slate-900/85 p-3 outline-none transition-colors hover:border-cyan-300/45 hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-4"
              >
                <div aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-0.5 rounded-full bg-gradient-to-b from-cyan-300 via-blue-500 to-amber-300 opacity-75" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${sourceStyles[item.source] || 'border-slate-500 bg-slate-700/50 text-slate-100'}`}>
                      {item.source}
                    </span>
                    <h3 className="mt-2 break-words text-sm font-bold text-white sm:text-base">{item.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300" />
                        {item.branch}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />
                        {item.displayDate}
                      </span>
                    </div>
                  </div>
                  <span className="w-fit shrink-0 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-100">
                    {item.status}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
