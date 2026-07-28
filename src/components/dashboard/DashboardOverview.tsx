import {
  Activity,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Gauge,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Siren,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardMetricModel } from '../../dashboardMetrics';
import DashboardOperationsReports from './DashboardOperationsReports';

interface DashboardOverviewProps {
  metrics: DashboardMetricModel;
  lastRefreshedTime: string;
  secondsToRefresh: number;
  isAutoRefresh: boolean;
  onRefresh: () => void;
  onExport: () => void;
}

interface KpiCardDefinition {
  label: string;
  lao: string;
  value: number;
  icon: LucideIcon;
  tone: 'cyan' | 'gold' | 'red' | 'violet' | 'green';
  currency?: boolean;
  suffix?: string;
  decimals?: number;
}

interface KpiGroupDefinition {
  id: 'dashboard-kpi-group-a' | 'dashboard-kpi-group-b' | 'dashboard-kpi-group-c';
  title: string;
  icon: LucideIcon;
  accent: 'cyan' | 'gold' | 'green';
  cards: KpiCardDefinition[];
}

const CYAN = '#22d3ee';
const GOLD = '#f5c451';
const BLUE = '#38bdf8';
const GREEN = '#34d399';
const RED = '#fb7185';
const VIOLET = '#a78bfa';
const CHART_COLORS = [CYAN, GOLD, RED, GREEN, VIOLET, '#60a5fa', '#f97316'];

const compactNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const lakNumber = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'LAK',
  maximumFractionDigits: 0,
});

const tooltipStyle = {
  backgroundColor: '#071426',
  border: '1px solid rgba(34, 211, 238, 0.35)',
  borderRadius: '12px',
  color: '#e2e8f0',
  boxShadow: '0 14px 36px rgba(0, 0, 0, 0.38)',
};

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-cyan-400/20 bg-slate-950/25 px-6 text-center">
      <Gauge className="h-8 w-8 text-cyan-300/45" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-300">No operational data</p>
      <p className="max-w-xs text-xs leading-5 text-slate-500">{label}</p>
    </div>
  );
}

function ChartPanel({
  id,
  title,
  subtitle,
  ariaLabel,
  className = '',
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={`min-w-0 overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#08182b]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_45px_rgba(2,8,23,0.2)] sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-cyan-300/10 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-wide text-slate-100">{title}</h3>
          <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
        </div>
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.85)]" aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

function ExplicitLegend({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-slate-300 sm:grid-cols-2" aria-label="Chart legend">
      {data.map((item, index) => (
        <li key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{item.name || 'Unknown'}</span>
          <span className="font-bold tabular-nums text-slate-100">{compactNumber.format(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardOverview({
  metrics,
  lastRefreshedTime,
  secondsToRefresh,
  isAutoRefresh,
  onRefresh,
  onExport,
}: DashboardOverviewProps) {
  const kpiGroups: KpiGroupDefinition[] = [
    {
      id: 'dashboard-kpi-group-a',
      title: 'A. ກຸ່ມ KPI ການກວດກາ ແລະ PM (Inspection & PM KPIs)',
      icon: ClipboardCheck,
      accent: 'cyan',
      cards: [
        { label: 'Total Inspections', lao: 'ການກວດກາທັງໝົດ', value: metrics.kpi.totalInspections, icon: ClipboardCheck, tone: 'cyan' },
        { label: 'Normal Inspections', lao: 'ການກວດກາປົກກະຕິ', value: metrics.kpi.normalInspections, icon: CheckCircle2, tone: 'green' },
        { label: 'Abnormal Inspections', lao: 'ການກວດກາຜິດປົກກະຕິ', value: metrics.kpi.abnormalInspections, icon: AlertTriangle, tone: 'red' },
        { label: 'Defect Rate', lao: 'ອັດຕາຜິດປົກກະຕິ', value: metrics.kpi.defectRate, icon: Gauge, tone: 'gold', suffix: '%', decimals: 1 },
        { label: 'Inspection Defect Items', lao: 'ລາຍການຜິດປົກກະຕິ', value: metrics.kpi.inspectionDefects, icon: AlertTriangle, tone: 'gold' },
        { label: 'PM Due Soon', lao: 'PM ໃກ້ຮອດກຳນົດ', value: metrics.kpi.pmDueSoon, icon: Activity, tone: 'gold' },
        { label: 'PM Overdue', lao: 'PM ເກີນກຳນົດ', value: metrics.kpi.pmOverdue, icon: AlertTriangle, tone: 'red' },
      ],
    },
    {
      id: 'dashboard-kpi-group-b',
      title: 'B. ກຸ່ມ KPI ເຫດການ & ຄວາມສ່ຽງ (Incident & Risk KPIs)',
      icon: Siren,
      accent: 'gold',
      cards: [
        { label: 'Inspection Incidents', lao: 'ເຫດຈາກການກວດກາ', value: metrics.kpi.incidentFromInspection, icon: ClipboardCheck, tone: 'cyan' },
        { label: 'Direct / Urgent Incidents', lao: 'ເຫດຈາກການແຈ້ງດ່ວນ', value: metrics.kpi.directIncidents, icon: Siren, tone: 'red' },
        { label: 'Total Incidents', lao: 'ເຫດການລວມທັງໝົດ', value: metrics.kpi.totalIncidents, icon: Activity, tone: 'violet' },
        { label: 'Cancelled', lao: 'ຍົກເລີກ', value: metrics.kpi.cancelledIncidents, icon: AlertTriangle, tone: 'violet' },
        { label: 'Active High / Critical', lao: 'ເຫດການສູງທີ່ຍັງບໍ່ປິດ', value: metrics.kpi.activeHighIncidents, icon: Siren, tone: 'red' },
        { label: 'Active Medium', lao: 'ເຫດການປານກາງທີ່ຍັງບໍ່ປິດ', value: metrics.kpi.activeMediumIncidents, icon: AlertTriangle, tone: 'gold' },
        { label: 'Active Low', lao: 'ເຫດການຕ່ຳທີ່ຍັງບໍ່ປິດ', value: metrics.kpi.activeLowIncidents, icon: Activity, tone: 'cyan' },
        { label: 'Waiting Assessment', lao: 'ລໍຖ້າປະເມີນ', value: metrics.kpi.waitingAssessment, icon: Clock3, tone: 'gold' },
        { label: 'Waiting Approval', lao: 'ລໍຖ້າອະນຸມັດ', value: metrics.kpi.waitingApproval, icon: ShieldCheck, tone: 'violet' },
        { label: 'Approved', lao: 'ອະນຸມັດແລ້ວ', value: metrics.kpi.approved, icon: ShieldCheck, tone: 'green' },
      ],
    },
    {
      id: 'dashboard-kpi-group-c',
      title: 'C. ກຸ່ມ KPI ສ້ອມແປງ / SLA / ຄ່າໃຊ້ຈ່າຍ (Repair, SLA & Cost KPIs)',
      icon: Wrench,
      accent: 'green',
      cards: [
        { label: 'Queueing', lao: 'ລໍຖ້າເລີ່ມສ້ອມ', value: metrics.kpi.queueing, icon: Clock3, tone: 'gold' },
        { label: 'In Progress', lao: 'ກຳລັງດຳເນີນການ', value: metrics.kpi.inProgress, icon: Wrench, tone: 'cyan' },
        { label: 'Awaiting Parts', lao: 'ລໍຖ້າອະໄຫຼ່', value: metrics.kpi.awaitingParts, icon: Clock3, tone: 'gold' },
        { label: 'Awaiting Vendor', lao: 'ລໍຖ້າ Vendor', value: metrics.kpi.awaitingVendor, icon: Clock3, tone: 'gold' },
        { label: 'Paused', lao: 'ຢຸດຊົ່ວຄາວ', value: metrics.kpi.paused, icon: AlertTriangle, tone: 'violet' },
        { label: 'Repair Completed', lao: 'ສ້ອມສຳເລັດ', value: metrics.kpi.repairCompleted, icon: CheckCircle2, tone: 'green' },
        { label: 'Jobs Closed', lao: 'ປິດງານແລ້ວ', value: metrics.kpi.jobsClosed, icon: ShieldCheck, tone: 'green' },
        { label: 'Overdue SLA', lao: 'ເກີນ SLA', value: metrics.kpi.slaOverdue, icon: Siren, tone: 'red' },
        { label: 'Near Overdue', lao: 'ໃກ້ເກີນ SLA', value: metrics.kpi.slaNearOverdue, icon: Clock3, tone: 'gold' },
        { label: 'Total Repair Cost', lao: 'ມູນຄ່າສ້ອມແປງລວມ', value: metrics.kpi.totalRepairCost, icon: Banknote, tone: 'gold', currency: true },
        { label: 'Avg Cost / Case', lao: 'ຄ່າສະເລ່ຍຕໍ່ກໍລະນີ', value: metrics.kpi.averageCostPerCase, icon: Banknote, tone: 'cyan', currency: true },
        { label: 'Avg Repair Days', lao: 'ຈຳນວນວັນສ້ອມແປງສະເລ່ຍ', value: metrics.kpi.averageRepairDays, icon: Clock3, tone: 'cyan', suffix: ' ວັນ', decimals: 1 },
        { label: 'On-time Rate', lao: 'ອັດຕາສຳເລັດຕາມເວລາ', value: metrics.kpi.onTimeRate, icon: Gauge, tone: 'green', suffix: '%', decimals: 1 },
      ],
    },
  ];

  const userSummary = [
    { label: 'Total Users', lao: 'ຜູ້ໃຊ້ທັງໝົດ', value: metrics.users.total, icon: Users },
    { label: 'Admins', lao: 'ຜູ້ຄຸ້ມຄອງ', value: metrics.users.admins, icon: ShieldCheck },
    { label: 'Branch Users', lao: 'ຜູ້ໃຊ້ສາຂາ', value: metrics.users.branchUsers, icon: UserCog },
    { label: 'Permission Assignments', lao: 'ສິດທີ່ກຳນົດ', value: metrics.users.permissionAssignments, icon: KeyRound },
  ];

  const repairHasData = metrics.repairStatus.some(item => item.value > 0);
  const severityHasData = metrics.incidentSeverity.some(item => item.value > 0);
  const pmHasData = metrics.pmStatus.some(item => item.value > 0);
  const monthlyHasData = metrics.monthlyTrend.some(item => item.inspections > 0 || item.incidents > 0 || item.completed > 0);
  const branchChartData = metrics.branchPerformance
    .map(item => ({
      ...item,
      totalActivity: item.inspections + item.openIncidents + item.completed,
    }))
    .filter(item => item.totalActivity > 0)
    .sort((a, b) => b.totalActivity - a.totalActivity || a.branch.localeCompare(b.branch));
  const zeroActivityBranchCount = metrics.branchPerformance.length - branchChartData.length;
  const branchChartHeight = Math.max(280, branchChartData.length * 42);
  const branchHasData = branchChartData.length > 0;

  const toneClasses = {
    cyan: 'border-cyan-300/20 text-cyan-300 shadow-cyan-500/5',
    gold: 'border-amber-300/20 text-amber-300 shadow-amber-500/5',
    red: 'border-rose-300/20 text-rose-300 shadow-rose-500/5',
    violet: 'border-violet-300/20 text-violet-300 shadow-violet-500/5',
    green: 'border-emerald-300/20 text-emerald-300 shadow-emerald-500/5',
  };

  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#04101f] p-3 text-slate-100 shadow-[0_26px_80px_rgba(2,8,23,0.42)] sm:p-5 lg:p-6"
      style={{
        backgroundImage: 'radial-gradient(circle at 12% 0%, rgba(34,211,238,0.12), transparent 28%), radial-gradient(circle at 90% 10%, rgba(245,196,81,0.08), transparent 24%), linear-gradient(rgba(56,189,248,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.025) 1px, transparent 1px)',
        backgroundSize: 'auto, auto, 32px 32px, 32px 32px',
      }}
    >
      <header className="relative mb-5 flex flex-col gap-4 rounded-2xl border border-cyan-300/20 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)] motion-reduce:animate-none" aria-hidden="true" />
            LDB SafeHub / Live Operations
          </div>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">Operational Command Overview</h2>
          <p className="mt-1 text-xs text-slate-400">ພາບລວມການກວດກາ, ເຫດການ, ການສ້ອມແປງ ແລະ PM</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="status"
            aria-label={`Dashboard refresh status. Last refreshed ${lastRefreshedTime}. ${isAutoRefresh ? `Next refresh in ${secondsToRefresh} seconds.` : 'Auto refresh paused.'}`}
            className="rounded-xl border border-cyan-300/15 bg-[#071426] px-3 py-2 text-right"
          >
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Last sync {lastRefreshedTime}</p>
            <p className="mt-0.5 text-xs font-bold text-cyan-200">
              {isAutoRefresh ? `Auto refresh · ${secondsToRefresh}s` : 'Auto refresh paused'}
            </p>
          </div>
          <button
            type="button"
            onClick={onExport}
            aria-label="Export dashboard data as CSV"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04101f] motion-reduce:transition-none"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh dashboard data"
            className="group inline-flex h-11 items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 text-xs font-bold text-amber-200 transition hover:border-amber-300/60 hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04101f] motion-reduce:transition-none"
          >
            <RefreshCw className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      <section id="dashboard-kpi-grid" aria-label="Dashboard key performance indicators" className="space-y-4">
        {kpiGroups.map(group => {
          const GroupIcon = group.icon;
          const headingTone = group.accent === 'gold'
            ? 'border-amber-300/15 text-amber-200'
            : group.accent === 'green'
              ? 'border-emerald-300/15 text-emerald-200'
              : 'border-cyan-300/15 text-cyan-200';

          return (
            <section
              key={group.id}
              id={group.id}
              aria-labelledby={`${group.id}-title`}
              className="rounded-2xl border border-cyan-300/15 bg-[#071426]/75 p-3 sm:p-4"
            >
              <div className={`mb-3 flex items-center gap-2 border-b pb-3 ${headingTone}`}>
                <GroupIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h3 id={`${group.id}-title`} className="text-xs font-bold sm:text-sm">{group.title}</h3>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {group.cards.map(item => {
                  const Icon = item.icon;
                  return (
                    <article
                      key={item.label}
                      className={`group min-w-0 rounded-2xl border bg-[#08182b]/90 p-4 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/35 focus-within:ring-2 focus-within:ring-cyan-300 motion-reduce:transform-none motion-reduce:transition-none ${toneClasses[item.tone]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-500">{item.lao}</p>
                        </div>
                        <span className="rounded-xl border border-current/20 bg-current/5 p-2">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>
                      <p className={`mt-5 break-words font-black tabular-nums text-white ${item.currency ? 'text-xl' : 'text-3xl'}`}>
                        {item.currency
                          ? lakNumber.format(item.value)
                          : `${new Intl.NumberFormat('en-US', {
                            minimumFractionDigits: item.decimals ?? 0,
                            maximumFractionDigits: item.decimals ?? 0,
                          }).format(item.value)}${item.suffix || ''}`}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>

      <section aria-label="User and permission summary" className="mt-5 rounded-2xl border border-amber-300/15 bg-gradient-to-r from-[#0a1829] via-[#0a1d32] to-[#101b2b] p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <h3 className="text-sm font-bold text-white">User & Permission Matrix</h3>
          <span className="text-[10px] text-slate-500">ສະຫຼຸບຜູ້ໃຊ້ ແລະ ສິດເຂົ້າໃຊ້</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {userSummary.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/5 bg-slate-950/25 p-3">
                <span className="rounded-lg bg-cyan-300/10 p-2 text-cyan-300"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="text-[10px] text-slate-600">{item.lao}</p>
                </div>
                <p className="text-xl font-black tabular-nums text-white">{compactNumber.format(item.value)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <ChartPanel id="repair-status-chart" title="Repair Workflow Status" subtitle="ສະຖານະຂັ້ນຕອນການສ້ອມແປງ" ariaLabel="Repair workflow status bar chart" className="xl:col-span-5">
          {repairHasData ? (
            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.repairStatus} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 10 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={92} tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(34,211,238,0.05)' }} />
                  <Bar dataKey="value" name="Cases" fill={CYAN} radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmptyState label="Repair workflow totals will appear when filtered records are available." />}
        </ChartPanel>

        <ChartPanel id="incident-severity-chart" title="Incident Severity" subtitle="ລະດັບຜົນກະທົບຂອງເຫດການ" ariaLabel="Incident severity donut chart" className="xl:col-span-3">
          {severityHasData ? (
            <>
              <div className="h-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={metrics.incidentSeverity} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="#08182b" strokeWidth={3}>
                      {metrics.incidentSeverity.map((item, index) => <Cell key={`${item.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ExplicitLegend data={metrics.incidentSeverity} />
            </>
          ) : <ChartEmptyState label="Severity distribution will appear when incidents match the current filters." />}
        </ChartPanel>

        <ChartPanel id="pm-status-chart" title="Preventive Maintenance" subtitle="ສະຖານະແຜນບຳລຸງຮັກສາ" ariaLabel="Preventive maintenance status donut chart" className="xl:col-span-4">
          {pmHasData ? (
            <>
              <div className="h-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={metrics.pmStatus} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="#08182b" strokeWidth={3}>
                      {metrics.pmStatus.map((item, index) => <Cell key={`${item.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ExplicitLegend data={metrics.pmStatus} />
            </>
          ) : <ChartEmptyState label="PM status totals will appear when assets match the current filters." />}
        </ChartPanel>

        <ChartPanel id="monthly-operations-chart" title="Monthly Operations" subtitle="ແນວໂນ້ມການກວດກາ, ເຫດການ ແລະ ວຽກສຳເລັດ" ariaLabel="Monthly operations area chart" className="xl:col-span-7">
          {monthlyHasData ? (
            <div className="h-[310px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.monthlyTrend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="inspectionArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CYAN} stopOpacity={0.42} /><stop offset="95%" stopColor={CYAN} stopOpacity={0} /></linearGradient>
                    <linearGradient id="incidentArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={RED} stopOpacity={0.34} /><stop offset="95%" stopColor={RED} stopOpacity={0} /></linearGradient>
                    <linearGradient id="completedArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GREEN} stopOpacity={0.32} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="inspections" name="Inspections" stroke={CYAN} fill="url(#inspectionArea)" strokeWidth={2} />
                  <Area type="monotone" dataKey="incidents" name="Incidents" stroke={RED} fill="url(#incidentArea)" strokeWidth={2} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke={GREEN} fill="url(#completedArea)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-4 text-[10px] text-slate-400" aria-label="Monthly operations legend">
                {[[CYAN, 'Inspections'], [RED, 'Incidents'], [GREEN, 'Completed']].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
              </div>
            </div>
          ) : <ChartEmptyState label="Monthly trends require dated inspection, incident, or completion records." />}
        </ChartPanel>

        <ChartPanel id="branch-performance-chart" title="Branch Performance" subtitle="ປຽບທຽບຜົນງານຂອງແຕ່ລະສາຂາ" ariaLabel="Branch performance comparison bar chart" className="xl:col-span-5">
          {branchHasData ? (
            <div className="min-w-0">
              <div className="max-h-[620px] min-w-0 overflow-y-auto pr-1">
                <div style={{ height: branchChartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchChartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 12 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 5" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="branch" width={190} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={value => compactNumber.format(Number(value ?? 0))} />
                      <Bar dataKey="inspections" name="Inspections" fill={BLUE} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="openIncidents" name="Open Incidents" fill={RED} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="completed" name="Completed" fill={GREEN} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {zeroActivityBranchCount > 0 && (
                <p className="mt-3 text-[10px] text-slate-500">
                  {zeroActivityBranchCount} ສາຂາບໍ່ມີກິດຈະກຳໃນ Filter ປັດຈຸບັນ
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 border-t border-cyan-300/10 pt-3" aria-label="Branch repair costs">
                {metrics.branchPerformance.filter(item => item.repairCost > 0).slice(0, 3).map(item => (
                  <span key={item.branch} className="rounded-lg bg-amber-300/5 px-2 py-1 text-[9px] text-slate-500">
                    {item.branch || 'Unknown'} <strong className="text-amber-200">{lakNumber.format(item.repairCost)}</strong>
                  </span>
                ))}
              </div>
            </div>
          ) : <ChartEmptyState label="Branch comparisons will appear when operational activity matches the current filters." />}
        </ChartPanel>
      </div>

      <DashboardOperationsReports metrics={metrics} />
    </div>
  );
}
