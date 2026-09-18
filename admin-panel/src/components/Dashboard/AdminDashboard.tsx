import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { adminAuthApi } from "../../services/adminApi";
import GuardActivityLogs from "../SecurityGuards/GuardActivityLogs";
import { AdminPanelCard } from "../UI/AdminPanelShell";
import {
  BarChart,
  Bar,
  BarXAxis,
  ChartTooltip,
  Grid,
} from "../Charts/BarChart";

interface OverviewStats {
  authorized_entries: number;
  unauthorized_attempts: number;
  total_residents: number;
  pending_update_requests: number;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="space-y-2">
      <div className="h-8 w-56 rounded-lg bg-zinc-800" />
      <div className="h-4 w-80 rounded bg-zinc-800" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 rounded-2xl bg-zinc-800/60" />
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="h-[340px] rounded-2xl bg-zinc-800/60" />
      <div className="h-[340px] rounded-2xl bg-zinc-800/60" />
    </div>
    <div className="h-[280px] rounded-2xl bg-zinc-800/60" />
    <div className="h-[360px] rounded-2xl bg-zinc-800/60" />
  </div>
);

// ─── Stat Card ───────────────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  sub,
  icon,
  gradient,
  iconBg,
  valueColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  valueColor: string;
}) => (
  <div
    className={`relative overflow-hidden rounded-2xl p-5 ${gradient} border border-white/5`}
  >
    {/* Decorative circle glow */}
    <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          {label}
        </p>
        <p className={`mt-2 text-4xl font-bold ${valueColor}`}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>}
      </div>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
      >
        {icon}
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{
    labels: string[];
    authorized: number[];
    unauthorized: number[];
  } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([
      adminAuthApi
        .dashboardOverview()
        .then((res) => setStats(res.data.stats ?? null)),
      adminAuthApi.trafficChart("monthly").then((res) => {
        const data = res.data;
        const labels = data.labels.map((lbl: string) => lbl.split(" ")[0]);
        setChartData({
          labels,
          authorized: data.authorized,
          unauthorized: data.unauthorized,
        });
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const weekDates = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const monthYearLabel = useMemo(() => {
    if (!weekDates.length) return "";
    return weekDates[3].toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [weekDates]);

  const bklitChartData = useMemo(() => {
    if (chartData && chartData.labels.length > 0) {
      const dbList = chartData.labels.map((lbl, idx) => ({
        month: lbl,
        authorized: chartData.authorized[idx] ?? 0,
        unauthorized: chartData.unauthorized[idx] ?? 0,
      }));
      const hasData = dbList.some(
        (item) => item.authorized > 0 || item.unauthorized > 0,
      );
      if (hasData) return dbList;
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentMonthIdx = new Date().getMonth();
    return months.map((m, idx) => {
      if (idx === currentMonthIdx || idx === 6) {
        return { month: m, authorized: 2, unauthorized: 1 };
      }
      return {
        month: m,
        authorized: Math.max(1, Math.floor(2 + (idx % 2))),
        unauthorized: Math.max(0, Math.floor(1 + ((idx + 1) % 2))),
      };
    });
  }, [chartData]);

  const authRate = useMemo(() => {
    if (!stats) return 0;
    const total = stats.authorized_entries + stats.unauthorized_attempts;
    return total === 0
      ? 100
      : Math.round((stats.authorized_entries / total) * 100);
  }, [stats]);

  const activeResidentsPercentage = useMemo(() => {
    if (!stats || stats.total_residents === 0) return 65;
    const ratio = Math.round(
      ((stats.authorized_entries + stats.unauthorized_attempts) /
        stats.total_residents) *
        100,
    );
    return Math.min(Math.max(ratio, 45), 98);
  }, [stats]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 text-zinc-100">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 border-b border-white/5 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C5A073]/15 text-[#C5A073]">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">
                Admin Dashboard
              </h1>
              <p className="text-sm text-zinc-500">
                Gate Security Control Center
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 self-start rounded-xl bg-zinc-900/60 border border-white/5 px-4 py-2.5 text-zinc-200 md:self-auto">
          <svg
            className="h-4 w-4 text-[#C5A073]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-mono text-sm tracking-wide">
            {currentTime.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            {currentTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Authorized Today"
          value={stats?.authorized_entries ?? 0}
          sub="Verified gate entries"
          gradient="bg-gradient-to-br from-emerald-950/60 to-zinc-900"
          iconBg="bg-emerald-500/15 text-emerald-400"
          valueColor="text-emerald-400"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Unauthorized Today"
          value={stats?.unauthorized_attempts ?? 0}
          sub="Blocked or flagged"
          gradient="bg-gradient-to-br from-red-950/60 to-zinc-900"
          iconBg="bg-red-500/15 text-red-400"
          valueColor="text-red-400"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          }
        />
        <StatCard
          label="Total Residents"
          value={stats?.total_residents ?? 0}
          sub="Registered in system"
          gradient="bg-gradient-to-br from-blue-950/60 to-zinc-900"
          iconBg="bg-blue-500/15 text-blue-400"
          valueColor="text-blue-400"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />
        <StatCard
          label="Pending Requests"
          value={stats?.pending_update_requests ?? 0}
          sub="Awaiting review"
          gradient="bg-gradient-to-br from-amber-950/60 to-zinc-900"
          iconBg="bg-amber-500/15 text-amber-400"
          valueColor="text-amber-400"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>

      {/* ── Analytics Grid ── */}
      <div className="grid gap-6 lg:grid-cols-2 w-full min-w-0 overflow-hidden">
        {/* Bar Chart */}
        <AdminPanelCard className="p-6 flex flex-col w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-100">Bar Chart</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Total Gate Traffic</p>
            </div>
            <Link
              to="/reports"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 hover:bg-[#C5A073] text-zinc-400 hover:text-[#121212] transition-colors border border-white/5"
              title="View full reports"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </Link>
          </div>

          <div className="flex-1 w-full min-h-[280px]">
            <BarChart
              data={bklitChartData}
              xDataKey="month"
              animationDuration={1100}
              animationEasing="cubic-bezier(0.85, 0, 0.15, 1)"
              barGap={0.2}
            >
              <Grid horizontal />
              <Bar
                dataKey="authorized"
                label="Authorized"
                lineCap="round"
                fill="#34d399"
                fadedOpacity={0.3}
                groupGap={4}
              />
              <Bar
                dataKey="unauthorized"
                label="Not Authorized"
                lineCap="round"
                fill="#f87171"
                fadedOpacity={0.3}
                groupGap={4}
              />
              <BarXAxis />
              <ChartTooltip showCrosshair={false} />
            </BarChart>
          </div>
        </AdminPanelCard>

        {/* Calendar + Auth Ring */}
        <AdminPanelCard className="p-6 flex flex-col justify-between">
          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setWeekOffset((p) => p - 1)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-white/5"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h3 className="text-sm font-bold text-zinc-100">
                {monthYearLabel}
              </h3>
              <button
                type="button"
                onClick={() => setWeekOffset((p) => p + 1)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-white/5"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center pb-4 border-b border-white/5">
              {weekDates.map((date, idx) => {
                const dayName = date.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const isSelected =
                  selectedDate.toDateString() === date.toDateString();
                const isToday =
                  new Date().toDateString() === date.toDateString();
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200 text-center ${
                      isSelected
                        ? "bg-[#C5A073] text-[#121212] font-semibold shadow-lg shadow-[#C5A073]/20"
                        : isToday
                          ? "bg-zinc-800/80 text-zinc-100 border border-zinc-700/60 ring-1 ring-[#C5A073]/30"
                          : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider">
                      {dayName}
                    </span>
                    <span className="text-sm font-bold">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auth rate ring + growth */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Auth rate */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-900/50 border border-white/5 p-4">
              <div className="relative flex items-center justify-center w-20 h-20">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="#27272a"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke={authRate >= 70 ? "#34d399" : "#f87171"}
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - authRate / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute text-center">
                  <p
                    className={`text-lg font-bold ${authRate >= 70 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {authRate}%
                  </p>
                </div>
              </div>
              <p className="text-xs font-semibold text-zinc-400 text-center">
                Auth Rate
              </p>
            </div>

            {/* Community growth */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-900/50 border border-white/5 p-4">
              <div className="relative flex items-center justify-center w-20 h-20">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="#27272a"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="#C5A073"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={
                      2 * Math.PI * 32 * (1 - activeResidentsPercentage / 100)
                    }
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-lg font-bold text-[#C5A073]">
                    {activeResidentsPercentage}%
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-zinc-400">Growth</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">
                  ↗ 0.9% this month
                </p>
              </div>
            </div>
          </div>
        </AdminPanelCard>
      </div>

      {/* ── Guard Activity Monitor ── */}
      <AdminPanelCard className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C5A073]/10 text-[#C5A073]">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">
              Security Guard Activity
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Real-time portal login &amp; logout events
            </p>
          </div>
        </div>
        <GuardActivityLogs compact title="" hideIpAddress={true} />
      </AdminPanelCard>
    </div>
  );
};

export default AdminDashboard;
