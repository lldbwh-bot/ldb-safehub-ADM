import {
  AlertTriangle,
  Banknote,
  BrainCircuit,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock3,
  ListChecks,
  ShieldAlert,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardMetricModel, ExecutiveInsight } from '../../dashboardMetrics';
import RepairFrequencyReport from './RepairFrequencyReport';

interface DashboardOperationsReportsProps {
  metrics: DashboardMetricModel;
}

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const tooltipStyle = {
  backgroundColor: '#071426',
  border: '1px solid rgba(34, 211, 238, 0.35)',
  borderRadius: '12px',
  color: '#e2e8f0',
};

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-cyan-300/20 bg-slate-950/25 px-6 text-center">
      <div>
        <ListChecks className="mx-auto h-7 w-7 text-cyan-300/45" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold text-slate-300">No matching operational data</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function ReportPanel({
  id,
  title,
  subtitle,
  icon: Icon,
  className = '',
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`min-w-0 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#08182b]/95 p-4 shadow-[0_18px_45px_rgba(2,8,23,0.24)] sm:p-5 ${className}`}
    >
      <header className="mb-4 flex items-start gap-3 border-b border-cyan-300/10 pb-3">
        <span className="rounded-xl border border-cyan-300/15 bg-cyan-300/10 p-2 text-cyan-200">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black tracking-wide text-white">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

const insightStyles: Record<ExecutiveInsight['severity'], string> = {
  critical: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
  warning: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
  info: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  positive: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
};

const slaStyles = {
  overdue: 'border-rose-300/30 bg-rose-400/10 text-rose-200',
  near: 'border-amber-300/30 bg-amber-400/10 text-amber-200',
  within: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
};

export default function DashboardOperationsReports({ metrics }: DashboardOperationsReportsProps) {
  const densityHasData = metrics.issueDensity.some(item => item.totalCases > 0);
  const costHasData = metrics.branchRepairCosts.some(item => item.costLak > 0);
  const trendHasData = metrics.monthlyBranchTrend.some(
    item => item.inspections > 0 || item.incidents > 0 || item.repairCost > 0,
  );
  const monthlyChartData = metrics.monthlyBranchTrend.map(item => ({
    ...item,
    periodBranch: `${item.month} · ${item.branch}`,
  }));

  return (
    <div className="mt-5 space-y-5" aria-label="Operational dashboard reports">
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-12">
        <ReportPanel
          id="issue-density-report"
          title="ຕາຕະລາງຄວາມໜາແໜ້ນຂອງບັນຫາ (Issue Density Matrix)"
          subtitle="Unique Incident cases by branch, system category, and asset reference."
          icon={ShieldAlert}
          className="xl:col-span-8"
        >
          {densityHasData ? (
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-left text-xs">
                <thead className="bg-cyan-300/5 text-[10px] uppercase tracking-wider text-cyan-100">
                  <tr>
                    <th className="p-3">ສາຂາ</th>
                    <th className="p-3 text-center">ລວມ</th>
                    <th className="p-3 text-center">ຄວາມປອດໄພ</th>
                    <th className="p-3 text-center">ມີຊັບສິນ</th>
                    <th className="p-3 text-center">ດ້ານນອກ</th>
                    <th className="p-3 text-center">ດ້ານໃນ</th>
                    <th className="p-3 text-center">ຕິດຕັ້ງອາຄານ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-300/10 text-slate-200">
                  {metrics.issueDensity.map(item => (
                    <tr key={item.branch} className="transition hover:bg-cyan-300/5">
                      <td className="p-3 font-bold text-white">{item.branch}</td>
                      <td className="p-3 text-center font-black text-cyan-200">{item.totalCases}</td>
                      <td className="p-3 text-center text-rose-200">{item.safetySystem}</td>
                      <td className="p-3 text-center text-amber-200">{item.hasAsset}</td>
                      <td className="p-3 text-center">{item.exteriorBuilding}</td>
                      <td className="p-3 text-center">{item.interiorBuilding}</td>
                      <td className="p-3 text-center">{item.buildingInstallation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState label="Issue density will appear when Incident records match the slicer filters." />}
        </ReportPanel>

        <ReportPanel
          id="top-problem-branches-report"
          title="Top 10 ສາຂາທີ່ມີບັນຫາຫຼາຍທີ່ສຸດ"
          subtitle="Ranked by unique Incident cases, not duplicated workflow rows."
          icon={Building2}
          className="xl:col-span-4"
        >
          {metrics.topProblemBranches.length ? (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topProblemBranches} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#cbd5e1', fontSize: 9 }} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Cases" fill="#22d3ee" radius={[0, 6, 6, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState label="Branch ranking requires Incident records in the selected scope." />}
        </ReportPanel>
      </div>

      <ReportPanel
        id="active-tracking-report"
        title="ຕາຕະລາງລາຍລະອຽດວຽກດ່ວນ (Detail Active Tracking Records)"
        subtitle="All active repair-tracking records; cases already in Repair History are excluded."
        icon={Wrench}
      >
        {metrics.activeTracking.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-xs">
              <thead className="bg-cyan-300/5 text-[10px] uppercase tracking-wider text-cyan-100">
                <tr>
                  {['PID', 'ສາຂາ', 'ລະບົບ / ລາຍການ', 'Owner / Vendor', 'ສະຖານະ', 'Progress', 'Start', 'Expected', 'SLA', 'Cost (LAK)'].map(label => (
                    <th key={label} className="p-3">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-300/10">
                {metrics.activeTracking.map(item => (
                  <tr key={item.id} className="text-slate-300 transition hover:bg-cyan-300/5">
                    <td className="p-3 font-mono text-cyan-200">{item.pid}</td>
                    <td className="p-3 font-bold text-white">{item.branch}</td>
                    <td className="p-3"><strong className="block text-slate-100">{item.system}</strong><span className="text-slate-500">{item.item}</span></td>
                    <td className="p-3"><strong className="block text-slate-200">{item.owner}</strong><span className="text-slate-500">{item.vendor}</span></td>
                    <td className="p-3 text-cyan-100">{item.status}</td>
                    <td className="p-3">
                      <div className="w-28 overflow-hidden rounded-full bg-slate-950/70">
                        <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${item.progressPercent}%` }} />
                      </div>
                      <span className="mt-1 block text-[10px] font-bold text-cyan-200">{item.progressPercent}%</span>
                    </td>
                    <td className="p-3">{item.startDate || '—'}</td>
                    <td className="p-3">{item.expectedFinishDate || '—'}</td>
                    <td className="p-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${slaStyles[item.slaState]}`}>{item.slaState}</span></td>
                    <td className="p-3 text-right font-mono font-bold text-amber-200">{numberFormat.format(item.repairCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState label="There are no active Tracking records after History reconciliation." />}
      </ReportPanel>

      <ReportPanel
        id="repair-timeline-report"
        title="ແຜນວາດທາມລາຍການສ້ອມແປງ (Repair Timeline & Milestones)"
        subtitle="ເຫດການ → ປະເມີນ → ອະນຸມັດ → ເລີ່ມສ້ອມ → ຄືບໜ້າ → ສຳເລັດ (Incident → Assessment → Approval → Start → Progress → Completed)"
        icon={CalendarRange}
      >
        {metrics.repairTimeline.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {metrics.repairTimeline.slice(0, 20).map(item => (
              <article key={`${item.branch}-${item.pid}`} className="rounded-xl border border-cyan-300/10 bg-slate-950/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] text-cyan-300">{item.pid}</p>
                    <h4 className="mt-1 text-sm font-bold text-white">{item.title}</h4>
                  </div>
                  <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100">{item.branch}</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold text-cyan-100">ຄວາມຄືບໜ້າ (Workflow progress)</p>
                  <span className="font-mono text-xs font-black text-cyan-300">{item.workflowPercent}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-300 transition-[width] duration-500"
                    style={{ width: `${item.workflowPercent}%` }}
                  />
                </div>
                <ol className="relative mt-5 grid min-w-[720px] grid-cols-6 items-start overflow-x-auto pb-2">
                  <span className="pointer-events-none absolute left-[8.33%] right-[8.33%] top-1.5 h-px bg-cyan-300/20" />
                  {item.milestones.map((milestone, index) => (
                    <li key={`${milestone.key}-${index}`} className="relative z-10 min-w-28 px-1 text-center">
                      <span className={`mx-auto block h-3 w-3 rounded-full ring-4 ${
                        milestone.state === 'complete'
                          ? 'bg-emerald-300 ring-emerald-300/15'
                          : milestone.state === 'current'
                            ? 'bg-amber-300 ring-amber-300/15'
                            : 'bg-slate-500 ring-slate-500/15'
                      }`} />
                      <p className="mt-3 text-[10px] font-bold leading-4 text-slate-200">{milestone.label}</p>
                      <p className="mt-1 text-[9px] text-slate-500">{milestone.date || 'ລໍຖ້າວັນທີ (Pending date)'}</p>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        ) : <EmptyState label="Timeline milestones require Incident or repair workflow records." />}
      </ReportPanel>

      <RepairFrequencyReport report={metrics.repairFrequency} />

      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <ReportPanel
          id="branch-repair-cost-report"
          title="ຄ່າໃຊ້ຈ່າຍສ້ອມແປງຕາມສາຂາ (M LAK)"
          subtitle="History cost plus active Tracking cost without duplicated PID."
          icon={Banknote}
        >
          {costHasData ? (
            <div className="h-80 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.branchRepairCosts} margin={{ left: 4, right: 8, bottom: 56 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="branch" interval={0} angle={-25} textAnchor="end" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${decimalFormat.format(Number(value ?? 0))} M LAK`, 'Repair cost']}
                  />
                  <Bar dataKey="costMillionLak" name="M LAK" fill="#f5c451" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState label="Repair cost will appear when active Tracking or History contains a cost." />}
        </ReportPanel>

        <ReportPanel
          id="top-problem-systems-report"
          title="Top 10 ລະບົບທີ່ພົບບັນຫາຫຼາຍທີ່ສຸດ"
          subtitle="System ranking from unique Incident cases."
          icon={TrendingUp}
        >
          {metrics.topProblemSystems.length ? (
            <div className="h-80 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topProblemSystems} layout="vertical" margin={{ left: 18, right: 12 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fill: '#cbd5e1', fontSize: 9 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Cases" fill="#a78bfa" radius={[0, 6, 6, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState label="System ranking requires categorized Incident records." />}
        </ReportPanel>
      </div>

      <ReportPanel
        id="monthly-branch-trend-report"
        title="ແນວໂນ້ມລາຍເດືອນຕາມສາຂາ"
        subtitle="Inspections, unique Incidents, and repair cost in million LAK."
        icon={TrendingUp}
      >
        {trendHasData ? (
          <div className="h-96 min-w-0 overflow-x-auto">
            <div className="h-full min-w-[760px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData} margin={{ top: 12, right: 12, bottom: 78, left: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="periodBranch" interval={0} angle={-25} textAnchor="end" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <YAxis yAxisId="cases" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis yAxisId="cost" orientation="right" tick={{ fill: '#f5c451', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 11 }} />
                  <Bar yAxisId="cases" dataKey="inspections" name="Inspections" fill="#22d3ee" opacity={0.72} />
                  <Bar yAxisId="cases" dataKey="incidents" name="Incidents" fill="#fb7185" opacity={0.82} />
                  <Line yAxisId="cost" type="monotone" dataKey="repairCostMillionLak" name="Repair Cost (M LAK)" stroke="#f5c451" strokeWidth={3} dot={{ fill: '#f5c451', r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : <EmptyState label="Monthly trends require dated Inspection, Incident, Tracking, or History records." />}
      </ReportPanel>

      <ReportPanel
        id="executive-insights-report"
        title="ຂໍ້ສະຫຼຸບຜູ້ບໍລິຫານ (LDB SafeHub Executive Recommendations & AI Insights)"
        subtitle="Offline deterministic recommendations backed by the currently filtered operational data."
        icon={BrainCircuit}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {metrics.executiveInsights.map(insight => (
            <article key={`${insight.code}-${insight.branch}-${insight.system}`} className={`rounded-xl border p-4 ${insightStyles[insight.severity]}`}>
              <div className="flex items-start gap-3">
                {insight.severity === 'critical'
                  ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                  : insight.severity === 'positive'
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    : <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />}
                <div>
                  <h4 className="text-sm font-black">{insight.title}</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{insight.detail}</p>
                  <p className="mt-3 text-[10px] text-slate-400">{insight.branch} · {insight.system}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </ReportPanel>
    </div>
  );
}
