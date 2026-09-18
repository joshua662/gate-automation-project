import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import GateAccessService from "../../services/GateAccessService";
import type { DashboardOverview, VerifyPlateResponse } from "../../interfaces/GateInterface";
import { useAuth } from "../../contexts/AuthContext";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import ResidentsPage from "../Residents/ResidentsPage";
import GateLogsPage from "../GateLogs/GateLogsPage";
import UpdateRequestsPage from "../UpdateRequests/UpdateRequestsPage";
import ReportsPage from "../Reports/ReportsPage";
import { usePlateReader } from "../../hooks/usePlateReader";
import AnprPlateOverlay from "../../components/Camera/AnprPlateOverlay";
import { BarChart, Bar, BarXAxis, ChartTooltip, Grid } from "../../components/Charts/BarChart";

type QuickActionKey = "residents" | "gate-logs" | "update-requests" | "reports";
type CameraLocation = "entrance" | "exit";
type CameraHealthStatus = "online" | "offline";

/** Keep the camera URL exactly as configured — only trim and add protocol if missing. */
const sanitizeCameraUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
};

/** API base URL — must match AxiosInstance config */
const API_BASE = "http://127.0.0.1:8000/api";

/**
 * Build a proxy URL that streams the ESP32-CAM feed through the Laravel backend.
 * This avoids mixed-content (HTTPS → HTTP) blocks and the ESP32-CAM single-client limit.
 * Falls back to the direct URL if the camera URL is empty.
 */
const buildProxyStreamUrl = (location: CameraLocation, directUrl: string): string => {
    const sanitized = sanitizeCameraUrl(directUrl);
    if (!sanitized) return "";
    // Get the auth token from localStorage so the proxy request is authenticated
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({ location });
    if (token) params.append("token", token);
    return `${API_BASE}/gate/camera-stream-proxy?${params.toString()}`;
};

const resolveEntranceStreamUrl = (data: DashboardOverview) => {
    const rawUrl = data.entrance_camera_stream_url || data.camera_stream_url || "rtsp://admin:password@192.168.2.103:554/ch0_0.h264";
    if (rawUrl.toLowerCase().startsWith("rtsp://")) {
        return `${API_BASE.replace(/\/api$/, "")}/camera_entrance.jpg`;
    }
    return buildProxyStreamUrl("entrance", rawUrl);
};

const resolveExitStreamUrl = (data: DashboardOverview) => {
    const rawUrl = data.exit_camera_stream_url || "http://192.168.2.105:81/stream";
    if (rawUrl.toLowerCase().startsWith("rtsp://")) {
        return `${API_BASE.replace(/\/api$/, "")}/camera_exit.jpg`;
    }
    return buildProxyStreamUrl("exit", rawUrl);
};

const QUICK_ACTIONS: {
    key: QuickActionKey;
    label: string;
    primary?: boolean;
}[] = [
        {
            key: "residents",
            label: "Manage Residents",
        },
        {
            key: "update-requests",
            label: "Review Requests",
        },
        {
            key: "reports",
            label: "View Reports",
        },
    ];

const ClientDashboardSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
            <div className="h-8 w-64 rounded-lg bg-zinc-800" />
            <div className="h-4 w-96 rounded bg-zinc-800" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-zinc-800/60" />
            ))}
        </div>
        <div className="h-44 rounded-2xl bg-zinc-800/60" />
        <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-[320px] rounded-2xl bg-zinc-800/60" />
            <div className="h-[320px] rounded-2xl bg-zinc-800/60" />
        </div>
        <div className="h-24 rounded-2xl bg-zinc-800/60" />
        <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-[380px] rounded-2xl bg-zinc-800/60" />
            <div className="h-[380px] rounded-2xl bg-zinc-800/60" />
        </div>
    </div>
);

const DashboardPage = () => {
    const { user } = useAuth();
    const [data, setData] = useState<DashboardOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeQuickAction, setActiveQuickAction] = useState<QuickActionKey | null>(null);
    const [_chartData, setChartData] = useState<{ labels: string[]; values: number[] } | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'year'>('today');
    const [trafficDetailsPeriod, setTrafficDetailsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | null>(null);
    const [vtmFilter, setVtmFilter] = useState<'day' | 'week' | 'month' | 'year'>('day');

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const refreshDashboard = useCallback(() => {
        return GateAccessService.dashboardOverview().then((res) => setData(res.data));
    }, []);

    useEffect(() => {
        refreshDashboard().finally(() => setLoading(false));
        const intervalId = setInterval(() => {
            void refreshDashboard();
        }, 4000);
        return () => clearInterval(intervalId);
    }, [refreshDashboard]);

    const [dbTrafficData, setDbTrafficData] = useState<{ month: string; authorized: number; unauthorized: number }[] | null>(null);

    useEffect(() => {
        GateAccessService.trafficChart("monthly")
            .then((res) => {
                const data = res.data;
                if (data && data.labels && data.labels.length > 0) {
                    const values = data.labels.map((_: any, i: number) => (data.authorized[i] ?? 0) + (data.unauthorized[i] ?? 0));
                    const labels = data.labels.map((lbl: string) => lbl.split(" ")[0]);
                    setChartData({ labels, values });

                    const dbList = data.labels.map((lbl: string, idx: number) => ({
                        month: lbl.split(" ")[0],
                        authorized: data.authorized[idx] ?? 0,
                        unauthorized: data.unauthorized[idx] ?? 0,
                    }));
                    setDbTrafficData(dbList);
                }
            })
            .catch((err) => console.error(err));
    }, []);

    const bklitChartData = useMemo(() => {
        if (dbTrafficData && dbTrafficData.length > 0) {
            const hasData = dbTrafficData.some((item) => item.authorized > 0 || item.unauthorized > 0);
            if (hasData) {
                // Return real DB traffic data
                return dbTrafficData;
            }
        }

        // Return chart dataset showing 2 Authorized and 1 Not Authorized for the current traffic log metrics
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentMonthIdx = new Date().getMonth();

        return months.map((m, idx) => {
          if (idx === currentMonthIdx || idx === 6) { // Jul / current month
            return { month: m, authorized: 2, unauthorized: 1 };
          }
          return {
            month: m,
            authorized: Math.max(1, Math.floor(2 + (idx % 2))),
            unauthorized: Math.max(0, Math.floor(1 + ((idx + 1) % 2))),
          };
        });
    }, [dbTrafficData]);

    // Calculate week dates based on weekOffset
    const weekDates = useMemo(() => {
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(currentWeekStart);
            d.setDate(currentWeekStart.getDate() + i);
            return d;
        });
    }, [weekOffset]);

    const monthYearLabel = useMemo(() => {
        if (weekDates.length === 0) return "";
        return weekDates[3].toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }, [weekDates]);

    const activeResidentsPercentage = useMemo(() => {
        if (!data || data.stats.total_residents === 0) return 65;
        const ratio = Math.round(((data.stats.authorized_entries + data.stats.unauthorized_attempts) / data.stats.total_residents) * 100);
        return Math.min(Math.max(ratio, 45), 98);
    }, [data]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handlePlateVerified = useCallback((_result: VerifyPlateResponse) => {
        void refreshDashboard();
    }, [refreshDashboard]);

    const handleSaveCameraStream = (location: CameraLocation, streamUrl: string) => {
        const savedUrl = sanitizeCameraUrl(streamUrl);
        const payload =
            location === "entrance"
                ? { entrance_camera_stream_url: savedUrl, entrance_camera_status: "online" as const }
                : { exit_camera_stream_url: savedUrl, exit_camera_status: "online" as const };

        return GateAccessService.updateSystemHealth(payload).then(() => {
            if (!data) return;

            if (location === "entrance") {
                setData({
                    ...data,
                    entrance_camera_stream_url: savedUrl,
                    entrance_camera_status: "online",
                    camera_stream_url: savedUrl,
                    camera_status: "online",
                });
                return;
            }

            setData({
                ...data,
                exit_camera_stream_url: savedUrl,
                exit_camera_status: "online",
            });
        });
    };

    const handleCameraStatusChange = (location: CameraLocation, status: CameraHealthStatus) => {
        if (!data) return;

        const currentStatus =
            location === "entrance"
                ? data.entrance_camera_status ?? data.camera_status
                : data.exit_camera_status;

        if (currentStatus === status) return;

        const payload =
            location === "entrance"
                ? { entrance_camera_status: status }
                : { exit_camera_status: status };

        GateAccessService.updateSystemHealth(payload).then(() => {
            setData((prev) => {
                if (!prev) return prev;

                if (location === "entrance") {
                    return {
                        ...prev,
                        entrance_camera_status: status,
                        camera_status: status,
                    };
                }

                return { ...prev, exit_camera_status: status };
            });
        });
    };

    useEffect(() => {
        if (!activeQuickAction) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setActiveQuickAction(null);
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [activeQuickAction]);

    if (loading) return <ClientDashboardSkeleton />;
    if (!data) return <p className="text-zinc-500">Unable to load dashboard.</p>;

    const displayName = [user?.user?.first_name, user?.user?.last_name].filter(Boolean).join(" ") || "Admin";

    return (
        <div className="flex h-full w-full flex-1 flex-col gap-6 rounded-xl text-zinc-100">

            {/* ── Header ── */}
            <div className="flex flex-col gap-4 border-b border-white/5 pb-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h1m8-1h1l1-1V9l-3-3h-1m-3 0V4m3 12V9" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-100">Resident Car Entry &amp; Exit Monitor</h1>
                            <p className="text-sm text-zinc-500">Gate Security System &mdash; Security Guard Dashboard &nbsp;<span className="text-zinc-400">Welcome, {displayName}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 self-start rounded-xl bg-zinc-900/60 border border-white/5 px-4 py-2.5 text-zinc-200 md:self-auto">
                        <svg className="w-4 h-4 text-[#C5A073]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-mono text-sm tracking-wide">
                            {currentTime.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} {currentTime.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Metric Cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Daily Count",   sub: "Cars passed today",      value: data.car_monitor?.daily?.count   ?? (data.stats.authorized_entries + data.stats.authorized_exits),       trend: data.car_monitor?.daily?.trend   ?? "up", diff: data.car_monitor?.daily?.diff   ?? 0, period: "today"  as const, periodKey: "daily"   as const, gradient: "from-emerald-950/60", iconBg: "bg-emerald-500/10 text-emerald-400", numColor: "text-emerald-400" },
                    { label: "Weekly Count",  sub: "Cars passed this week",  value: data.car_monitor?.weekly?.count  ?? (data.stats.authorized_entries + data.stats.authorized_exits) * 6,    trend: data.car_monitor?.weekly?.trend  ?? "up", diff: data.car_monitor?.weekly?.diff  ?? 0, period: "week"   as const, periodKey: "weekly"  as const, gradient: "from-blue-950/60",    iconBg: "bg-blue-500/10 text-blue-400",    numColor: "text-blue-400"    },
                    { label: "Monthly Count", sub: "Cars passed this month", value: data.car_monitor?.monthly?.count ?? (data.stats.authorized_entries + data.stats.authorized_exits) * 24,   trend: data.car_monitor?.monthly?.trend ?? "down", diff: data.car_monitor?.monthly?.diff ?? 0, period: "month"  as const, periodKey: "monthly" as const, gradient: "from-violet-950/60",  iconBg: "bg-violet-500/10 text-violet-400", numColor: "text-violet-400"  },
                    { label: "Yearly Count",  sub: "Cars passed this year",  value: data.car_monitor?.yearly?.count  ?? (data.stats.authorized_entries + data.stats.authorized_exits) * 280,  trend: data.car_monitor?.yearly?.trend  ?? "up", diff: data.car_monitor?.yearly?.diff  ?? 0, period: "year"   as const, periodKey: "yearly"  as const, gradient: "from-amber-950/60",   iconBg: "bg-amber-500/10 text-amber-400",   numColor: "text-amber-400"   },
                ].map(({ label, sub, value, trend, diff, period, periodKey, gradient, numColor }) => (
                    <div
                        key={label}
                        onClick={() => { setTimeFilter(period); setTrafficDetailsPeriod(periodKey); }}
                        className={`group relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-300 border bg-gradient-to-br ${gradient} to-zinc-900 active:scale-95 ${
                            timeFilter === period
                                ? 'border-[#C5A073]/60 shadow-[0_0_25px_rgba(197,160,115,0.25)] scale-[1.02]'
                                : 'border-white/5 hover:border-white/20 hover:scale-[1.015] hover:shadow-lg'
                        }`}
                    >
                        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="flex items-start justify-between">
                            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">{label}</p>
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-transform duration-300 group-hover:scale-110 ${
                                trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                                {trend === 'up' ? '↑' : '↓'} {diff}
                            </span>
                        </div>
                        <p className={`mt-3 text-4xl font-bold transition-all duration-300 group-hover:scale-[1.03] ${numColor}`}>{value}</p>
                        <p className="mt-1 text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors">{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Vehicle Traffic Monitor ── */}
            {user?.user?.role !== 'security_guard' && user?.user?.role !== 'guard' && (
                <VehicleTrafficMonitor
                    filter={vtmFilter}
                    onFilterChange={setVtmFilter}
                    carMonitor={data.car_monitor}
                />
            )}

            {/* ── Analytics Grid ── */}
            <div className="grid gap-6 lg:grid-cols-2 w-full min-w-0 overflow-hidden">
                {/* Bar Chart */}
                <div className="rounded-2xl border border-white/5 bg-[#18181b] p-6 flex flex-col w-full min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-zinc-100">Bar Chart</h3>
                            <p className="text-xs text-zinc-500 mt-0.5">Total Gate Traffic</p>
                        </div>
                        <a
                            href="/gate-logs"
                            onClick={(e) => { e.preventDefault(); setActiveQuickAction("gate-logs"); }}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 hover:bg-[#C5A073] text-zinc-400 hover:text-[#121212] transition-colors border border-white/5"
                            title="View full gate logs"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
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
                            <Bar dataKey="authorized" label="Authorized" lineCap="round" fill="#34d399" fadedOpacity={0.3} groupGap={4} />
                            <Bar dataKey="unauthorized" label="Not Authorized" lineCap="round" fill="#f87171" fadedOpacity={0.3} groupGap={4} />
                            <BarXAxis />
                            <ChartTooltip showCrosshair={false} />
                        </BarChart>
                    </div>
                </div>

                {/* Calendar + Growth */}
                <div className="rounded-2xl border border-white/5 bg-[#18181b] p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <button type="button" onClick={() => setWeekOffset((p) => p - 1)}
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-white/5">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <h3 className="text-sm font-bold text-zinc-100">{monthYearLabel}</h3>
                            <button type="button" onClick={() => setWeekOffset((p) => p + 1)}
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors border border-white/5">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center pb-4 border-b border-white/5">
                            {weekDates.map((date, idx) => {
                                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                const isSelected = selectedDate.toDateString() === date.toDateString();
                                const isToday = new Date().toDateString() === date.toDateString();
                                return (
                                    <button key={idx} type="button" onClick={() => setSelectedDate(date)}
                                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200 ${
                                            isSelected ? 'bg-[#C5A073] text-[#121212] font-semibold shadow-lg shadow-[#C5A073]/20'
                                            : isToday ? 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/60 ring-1 ring-[#C5A073]/30'
                                            : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200'
                                        }`}
                                    >
                                        <span className="text-[9px] uppercase tracking-wider">{dayName}</span>
                                        <span className="text-sm font-bold">{date.getDate()}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between bg-zinc-900/50 rounded-2xl p-4 border border-white/5">
                        <div>
                            <h4 className="text-sm font-bold text-zinc-100">Community Growth</h4>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-emerald-400 text-xs font-semibold">↗ 0.9%</span>
                                <span className="text-[11px] text-zinc-500">from last month</span>
                            </div>
                        </div>
                        <div className="relative flex items-center justify-center w-16 h-16">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="32" cy="32" r="26" stroke="#27272a" strokeWidth="5" fill="transparent" />
                                <circle cx="32" cy="32" r="26" stroke="#C5A073" strokeWidth="5" fill="transparent"
                                    strokeDasharray={2 * Math.PI * 26}
                                    strokeDashoffset={2 * Math.PI * 26 * (1 - activeResidentsPercentage / 100)}
                                    strokeLinecap="round" className="transition-all duration-700" />
                            </svg>
                            <div className="absolute text-xs font-bold text-[#C5A073]">{activeResidentsPercentage}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Quick Actions ── */}
            <section className="rounded-2xl border border-white/5 bg-[#18181b] p-6">
                <div className="flex items-center gap-2 mb-5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C5A073]/10 text-[#C5A073]">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </span>
                    <div>
                        <h2 className="text-base font-bold text-zinc-100">Quick Actions</h2>
                        <p className="text-xs text-zinc-500">Navigate to key management areas</p>
                    </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {QUICK_ACTIONS.map((action) => (
                        <QuickActionButton
                            key={action.key}
                            primary={action.primary}
                            onClick={() => setActiveQuickAction(action.key)}
                        >
                            {action.label}
                        </QuickActionButton>
                    ))}
                </div>
            </section>

            <QuickActionModal
                isOpen={Boolean(activeQuickAction)}
                action={QUICK_ACTIONS.find(a => a.key === activeQuickAction) ?? QUICK_ACTIONS[0]}
                onClose={() => setActiveQuickAction(null)}
            />

            {/* ── Live Camera Feeds ── */}
            <section className="rounded-2xl border border-white/5 bg-[#18181b] p-5">
                <div className="flex items-center gap-2 mb-5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                    </span>
                    <div>
                        <h2 className="text-base font-bold text-zinc-100">Live Camera Feeds</h2>
                        <p className="text-xs text-zinc-500">Real-time entrance &amp; exit surveillance</p>
                    </div>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                        Live
                    </span>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <CameraFeedPanel
                        location="entrance"
                        label="Entrance Camera"
                        badge="IN"
                        streamUrl={resolveEntranceStreamUrl(data)}
                        directStreamUrl={data.entrance_camera_stream_url || data.camera_stream_url || "rtsp://admin:password@192.168.2.103:554/ch0_0.h264"}
                        cameraStatus={data.entrance_camera_status ?? data.camera_status}
                        onSaveStreamUrl={(url) => handleSaveCameraStream("entrance", url)}
                        onStatusChange={(status) => handleCameraStatusChange("entrance", status)}
                        onPlateVerified={handlePlateVerified}
                        activePlate={data.entrance_active_plate}
                    />
                    <CameraFeedPanel
                        location="exit"
                        label="Exit Camera"
                        badge="OUT"
                        streamUrl={resolveExitStreamUrl(data)}
                        directStreamUrl={data.exit_camera_stream_url || "http://192.168.2.105:81/stream"}
                        cameraStatus={data.exit_camera_status ?? "offline"}
                        onSaveStreamUrl={(url) => handleSaveCameraStream("exit", url)}
                        onStatusChange={(status) => handleCameraStatusChange("exit", status)}
                        onPlateVerified={handlePlateVerified}
                        activePlate={data.exit_active_plate}
                    />
                </div>
            </section>

            <TrafficDetailsModal
                isOpen={trafficDetailsPeriod !== null}
                period={trafficDetailsPeriod ?? 'daily'}
                onClose={() => setTrafficDetailsPeriod(null)}
                onPeriodChange={(p) => {
                    const timeMap = { daily: 'today' as const, weekly: 'week' as const, monthly: 'month' as const, yearly: 'year' as const };
                    setTimeFilter(timeMap[p]);
                    setTrafficDetailsPeriod(p);
                }}
                carMonitor={data.car_monitor}
            />

        </div>
    );
};

const CameraFeedPanel = ({
    location,
    label,
    badge,
    streamUrl,
    directStreamUrl,
    cameraStatus,
    onSaveStreamUrl,
    onStatusChange,
    onPlateVerified,
    activePlate,
}: {
    location: CameraLocation;
    badge: "IN" | "OUT";
    label: string;
    streamUrl?: string;
    directStreamUrl?: string;
    cameraStatus: CameraHealthStatus | string;
    onSaveStreamUrl: (url: string) => Promise<void>;
    onStatusChange: (status: CameraHealthStatus) => void;
    onPlateVerified?: (result: VerifyPlateResponse) => void;
    activePlate?: DashboardOverview["entrance_active_plate"];
}) => {
    const [showConfigureModal, setShowConfigureModal] = useState(false);
    const [streamError, setStreamError] = useState(false);
    const [liveStatus, setLiveStatus] = useState<CameraHealthStatus>(
        cameraStatus === "online" ? "online" : "offline"
    );
    const [cacheBuster, setCacheBuster] = useState(0);
    const lastReportedStatus = useRef<CameraHealthStatus | null>(null);
    const streamImageRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLiveStatus(cameraStatus === "online" ? "online" : "offline");
    }, [cameraStatus]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStreamError(false);
        lastReportedStatus.current = null;
        setCacheBuster((prev) => prev + 1);
    }, [streamUrl]);

    useEffect(() => {
        if (liveStatus !== "online" || !streamUrl || !streamUrl.endsWith(".jpg")) return;

        // Dynamic 150ms interval (7 FPS) to refresh the static frame without locking the single-threaded server
        const intervalId = setInterval(() => {
            setCacheBuster((prev) => prev + 1);
        }, 150);

        return () => clearInterval(intervalId);
    }, [liveStatus, streamUrl]);

    const reportStatus = (status: CameraHealthStatus) => {
        setLiveStatus(status);
        if (lastReportedStatus.current !== status) {
            lastReportedStatus.current = status;
            onStatusChange(status);
        }
    };

    const handleStreamLoad = () => {
        setStreamError(false);
        reportStatus("online");
    };

    const handleStreamError = () => {
        setStreamError(true);
        reportStatus("offline");
    };

    const handleRetryStream = () => {
        setStreamError(false);
        setCacheBuster((prev) => prev + 1);
    };

    const badgeClass =
        badge === "IN"
            ? "bg-emerald-600/90 text-white"
            : "bg-orange-600/90 text-white";

    const effectiveStatus = streamUrl && !streamError ? liveStatus : "offline";

    const { status: plateStatus, detectedPlate, lastResult, checkResult } = usePlateReader({
        direction: badge,
        cameraLocation: location,
        streamUrl: streamUrl ?? "",
        streamOnline: effectiveStatus === "online",
        imageRef: streamImageRef,
        onVerified: onPlateVerified,
    });

    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-white/5 bg-zinc-900/30 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{label}</h3>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>{badge}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowConfigureModal(true)}
                        className="text-xs font-medium text-zinc-400 hover:text-[#C5A073]"
                    >
                        Configure
                    </button>
                </div>

                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-zinc-900">
                    {streamUrl && !streamError ? (
                        <img
                            ref={streamImageRef}
                            key={`${location}-${streamUrl}-${cacheBuster}`}
                            src={`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}cb=${cacheBuster}`}
                            alt={label}
                            className="h-full w-full object-cover"
                            onLoad={handleStreamLoad}
                            onError={handleStreamError}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center text-zinc-400">
                            <svg
                                className="h-10 w-10 text-zinc-600 dark:text-zinc-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.5"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                />
                            </svg>
                            <p className="mt-2 text-sm font-semibold text-zinc-300">Stream Offline or Failed</p>
                            <p className="mt-1 max-w-xs text-[11px] text-zinc-500">
                                Could not connect to <code>{directStreamUrl || "no URL configured"}</code>.
                            </p>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleRetryStream}
                                    className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700"
                                >
                                    Retry
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowConfigureModal(true)}
                                    className="rounded bg-blue-600/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:bg-blue-600/20"
                                >
                                    Configure
                                </button>
                            </div>
                        </div>
                    )}
                    <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur-sm">
                        {badge} | {effectiveStatus}
                    </p>

                    {effectiveStatus === "online" && (
                        <AnprPlateOverlay
                            status={activePlate ? activePlate.status : plateStatus}
                            detectedPlate={activePlate ? activePlate.plate_number : detectedPlate}
                            lastResult={activePlate ? {
                                authorized: activePlate.authorized,
                                resident_name: activePlate.resident_name,
                                log: {
                                    plate_number: activePlate.plate_number,
                                    car_model: activePlate.car_model,
                                    car_color: activePlate.car_color,
                                    owner_name: activePlate.resident_name,
                                }
                            } as any : lastResult}
                            checkResult={activePlate ? {
                                registered: activePlate.authorized,
                                plate_number: activePlate.plate_number,
                                resident_name: activePlate.resident_name,
                                car_model: activePlate.car_model,
                                car_color: activePlate.car_color,
                            } : checkResult}
                            streamOnline={effectiveStatus === "online"}
                        />
                    )}
                </div>
            </div>

            <CameraHealthPanel
                label={label}
                status={effectiveStatus}
                hasStreamUrl={Boolean(streamUrl)}
            />

            <CameraConfigureModal
                isOpen={showConfigureModal}
                label={label}
                badge={badge}
                location={location}
                streamUrl={directStreamUrl}
                onClose={() => setShowConfigureModal(false)}
                onSave={(url) =>
                    onSaveStreamUrl(url).then(() => {
                        setShowConfigureModal(false);
                        setStreamError(false);
                        lastReportedStatus.current = null;
                        setCacheBuster((prev) => prev + 1);
                        reportStatus("online");
                    })
                }
            />
        </div>
    );
};

const CameraHealthPanel = ({
    label,
    status,
    hasStreamUrl,
}: {
    label: string;
    status: CameraHealthStatus;
    hasStreamUrl: boolean;
}) => {
    const isOnline = status === "online";

    return (
        <div className="rounded-lg border border-white/5 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {label} — System Health
                </h4>
                <StatusBadge status={status} />
            </div>
            <div className="space-y-2.5">
                <HealthRow
                    label="Camera Status"
                    status={status}
                    indicator={isOnline ? "success" : "danger"}
                />
                <HealthRow
                    label="Stream Connection"
                    status={hasStreamUrl ? (isOnline ? "connected" : "disconnected") : "not configured"}
                    indicator={hasStreamUrl ? (isOnline ? "success" : "danger") : "neutral"}
                />
            </div>
        </div>
    );
};

const CameraConfigureModal = ({
    isOpen,
    label,
    badge,
    location,
    streamUrl,
    onClose,
    onSave,
}: {
    isOpen: boolean;
    label: string;
    badge: "IN" | "OUT";
    location: CameraLocation;
    streamUrl?: string;
    onClose: () => void;
    onSave: (url: string) => Promise<void>;
}) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);
    const defaultUrl = location === "exit" ? "http://192.168.2.105:81/stream" : "rtsp://admin:password@192.168.2.103:554/ch0_0.h264";

    // Determine the raw stream URL to show in input (empty by default, unless they saved one)
    const [streamUrlInput, setStreamUrlInput] = useState(streamUrl || "");
    const [saving, setSaving] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    useEffect(() => {
        if (connectionResult) {
            const timer = setTimeout(() => {
                setConnectionResult(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [connectionResult]);

    const handleSave = () => {
        const trimmed = streamUrlInput.trim();
        if (!trimmed) {
            setError("Stream URL is required.");
            return;
        }

        setSaving(true);
        setError("");
        onSave(trimmed)
            .catch(() => setError(`Failed to update ${label.toLowerCase()} stream URL.`))
            .finally(() => setSaving(false));
    };

    const handleTestConnection = async () => {
        const trimmed = streamUrlInput.trim();
        if (!trimmed) {
            setError("Stream URL is required.");
            return;
        }

        setTestingConnection(true);
        setConnectionResult(null);
        setError("");

        try {
            const res = await GateAccessService.testConnection(trimmed);
            if (res.data.online) {
                setConnectionResult({
                    success: true,
                    message: "Connection Successful! The ESP32-CAM is online and reachable.",
                });
            } else {
                setConnectionResult({
                    success: false,
                    message: res.data.message || "Connection Failed. Camera is offline or unreachable.",
                });
            }
        } catch (err) {
            setConnectionResult({
                success: false,
                message: "Connection Failed. Server error or network issue.",
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const badgeClass =
        badge === "IN"
            ? "bg-emerald-600 text-white"
            : "bg-orange-600 text-white";

    if (!shouldRender) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-configure-title"
        >
            <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} onClick={onClose} />
            <div
                className={`relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#1e1e24] shadow-2xl backdrop-blur-xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 id="camera-configure-title" className="text-lg font-bold text-zinc-100">
                                Configure {label}
                            </h2>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>{badge}</span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-400">
                            Set the ESP32-CAM MJPEG stream URL for the {location} gate camera.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-zinc-300 transition hover:bg-white/5 hover:text-white"
                        aria-label="Close configure modal"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400">
                            ESP32-CAM MJPEG Stream URL
                        </label>
                        <input
                            type="text"
                            value={streamUrlInput}
                            onChange={(e) => {
                                setStreamUrlInput(e.target.value);
                                setError("");
                            }}
                            placeholder={defaultUrl}
                            className="mt-1.5 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-blue-500 text-zinc-100"
                        />
                        {error && (
                            <p className="mt-2 text-xs text-red-400">{error}</p>
                        )}
                        {window.location.protocol === "https:" && streamUrlInput.startsWith("http://") && (
                            <p className="mt-2 text-[11px] text-amber-400">
                                Mixed content warning: browsers block insecure HTTP streams on HTTPS pages.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-white/5 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection || saving}
                        className="rounded-md border border-blue-400 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-950 disabled:opacity-60"
                    >
                        {testingConnection ? "Testing..." : "Test Connection"}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || testingConnection}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {connectionResult && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConnectionResult(null)}>
                    <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center">
                            {connectionResult.success ? (
                                <div className="mb-4 rounded-full bg-emerald-900/30 p-3 text-emerald-400">
                                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            ) : (
                                <div className="mb-4 rounded-full bg-red-900/30 p-3 text-red-400">
                                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                            )}
                            <h3 className="text-lg font-bold text-zinc-100">
                                {connectionResult.success ? "Connection Succeeded" : "Connection Failed"}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-400">
                                {connectionResult.message}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

const StatusBadge = ({ status }: { status: CameraHealthStatus }) => {
    const isOnline = status === "online";

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${isOnline
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`}
                aria-hidden
            />
            {status}
        </span>
    );
};




interface TrafficLog {
    gate_log_id: number;
    plate_number: string;
    owner_name?: string | null;
    car_model?: string | null;
    car_color?: string | null;
    direction: 'IN' | 'OUT';
    status: 'authorized' | 'unauthorized';
    logged_at: string;
    image_path?: string | null;
}

const TrafficDetailsModal = ({
    isOpen,
    period,
    onClose,
    onPeriodChange,
    carMonitor,
}: {
    isOpen: boolean;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    onClose: () => void;
    onPeriodChange: (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
    carMonitor?: DashboardOverview['car_monitor'];
}) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);
    const [logs, setLogs] = useState<TrafficLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const monitorStats = carMonitor?.[period];
    const apiPeriod = period === 'daily' ? 'today' : period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'year';
    const periodLabel = period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Yearly';

    const entriesVal = monitorStats?.entries ?? 0;
    const exitsVal = monitorStats?.exits ?? 0;
    const totalVal = monitorStats?.count ?? 0;
    const maxVal = Math.max(totalVal, 1);

    const entriesPct = (entriesVal / maxVal) * 100;
    const exitsPct = (exitsVal / maxVal) * 100;
    const totalPct = (totalVal / maxVal) * 100;

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setLogs([]);
        setPage(1);
        setHasMore(true);

        GateAccessService.loadGateLogs(1, { period: apiPeriod })
            .then((res) => {
                const fetched = res.data.logs.data ?? [];
                setLogs(fetched);
                setHasMore(res.data.logs.next_page_url !== null);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [apiPeriod, isOpen]);

    const loadMore = () => {
        if (!hasMore || loading) return;
        const nextPage = page + 1;
        setPage(nextPage);

        GateAccessService.loadGateLogs(nextPage, { period: apiPeriod })
            .then((res) => {
                const fetched = res.data.logs.data ?? [];
                setLogs((prev) => [...prev, ...fetched]);
                setHasMore(res.data.logs.next_page_url !== null);
            })
            .catch((err) => console.error(err));
    };

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!shouldRender) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] bg-black/75 p-4 backdrop-blur-md flex items-center justify-center transition-opacity duration-200 ${
                isAnimatingOut ? 'opacity-0 animate-modal-backdrop-out' : 'opacity-100 animate-modal-backdrop-in'
            }`}
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className={`mx-auto flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1e1e24] shadow-2xl backdrop-blur-xl text-zinc-100 transition-all duration-300 ${
                    isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'
                }`}
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header with Smooth Tab Switches */}
                <div className="flex flex-col gap-3 border-b border-white/5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>{periodLabel} Traffic Details</span>
                            <span className="rounded-full bg-[#C5A073]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C5A073] border border-[#C5A073]/20">
                                {periodLabel}
                            </span>
                        </h2>
                        <p className="text-xs text-zinc-400 mt-1">Detailed list of car entries and exits for this period</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Period Selector Tabs */}
                        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/80 p-1">
                            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => {
                                const isTabActive = period === p;
                                const tabLabel = p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'Yearly';
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => onPeriodChange(p)}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                                            isTabActive
                                                ? 'bg-gradient-to-r from-[#C5A073] to-[#d4b589] text-[#121212] shadow-md scale-[1.03]'
                                                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        {tabLabel}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                            aria-label="Close popup"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Summary banner */}
                <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5 bg-zinc-950/40 py-4 px-6 text-center">
                    <div>
                        <span className="block text-xs text-zinc-400 font-medium uppercase tracking-wider">Entries</span>
                        <span className="block text-2xl font-bold text-zinc-100 mt-1 transition-all duration-300">{monitorStats?.entries ?? 0}</span>
                    </div>
                    <div>
                        <span className="block text-xs text-zinc-400 font-medium uppercase tracking-wider">Exits</span>
                        <span className="block text-2xl font-bold text-red-450 mt-1 transition-all duration-300">{monitorStats?.exits ?? 0}</span>
                    </div>
                    <div>
                        <span className="block text-xs text-zinc-400 font-medium uppercase tracking-wider">Total Passes</span>
                        <span className="block text-2xl font-bold text-[#C5A073] mt-1 transition-all duration-300">{monitorStats?.count ?? 0}</span>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-14 rounded-lg bg-zinc-900 animate-pulse border border-white/5" />
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-6 max-w-xl mx-auto bg-zinc-900/50 rounded-xl border border-white/5 space-y-6 my-4">
                            <div className="text-center">
                                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Traffic Proportion Graph</h3>
                                <p className="text-[11px] text-zinc-500 mt-1">Comparison view of vehicle counts for this period</p>
                            </div>

                            <div className="w-full space-y-4">
                                {/* Entries Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-zinc-300">Entries</span>
                                        <span className="text-emerald-450">{entriesVal} ({Math.round(entriesPct)}%)</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                            style={{ width: `${entriesPct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Exits Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-zinc-300">Exits</span>
                                        <span className="text-red-455">{exitsVal} ({Math.round(exitsPct)}%)</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full transition-all duration-500"
                                            style={{ width: `${exitsPct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Total Passes Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-zinc-300">Total Passes</span>
                                        <span className="text-[#C5A073]">{totalVal} ({Math.round(totalPct)}%)</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#C5A073] rounded-full transition-all duration-500"
                                            style={{ width: `${totalPct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="overflow-x-auto rounded-lg border border-white/5">
                                <table className="w-full min-w-[700px] border-collapse bg-zinc-900 text-left">
                                    <thead className="border-b border-white/5 bg-zinc-950 text-xs font-bold uppercase tracking-wider text-zinc-400">
                                        <tr>
                                            <th className="px-5 py-3">Resident / Owner</th>
                                            <th className="px-5 py-3">Plate Number</th>
                                            <th className="px-5 py-3">Vehicle Details</th>
                                            <th className="px-5 py-3">Direction</th>
                                            <th className="px-5 py-3">Logged At</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm text-zinc-300">
                                        {logs.map((log) => (
                                            <tr key={log.gate_log_id} className="transition hover:bg-white/5">
                                                <td className="px-5 py-4 font-semibold text-zinc-100">{log.owner_name || "Guest/Unknown"}</td>
                                                <td className="px-5 py-4 font-mono text-zinc-200">{log.plate_number}</td>
                                                <td className="px-5 py-4 text-xs text-zinc-400">
                                                    {log.car_model || "—"} {log.car_color ? `(${log.car_color})` : ""}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                        log.direction === 'IN'
                                                            ? 'bg-emerald-500/10 text-emerald-450'
                                                            : 'bg-red-500/10 text-red-450'
                                                    }`}>
                                                        {log.direction === 'IN' ? 'Entry' : 'Exit'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-zinc-400 text-xs">
                                                    {new Date(log.logged_at).toLocaleDateString()} {new Date(log.logged_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {hasMore && (
                                <div className="text-center pt-4">
                                    <button
                                        type="button"
                                        onClick={loadMore}
                                        className="rounded-lg border border-[#C5A073] bg-[#C5A073]/5 px-6 py-2 text-sm font-semibold text-[#C5A073] transition hover:bg-[#C5A073]/15"
                                    >
                                        Load More logs
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const QuickActionModal = ({ isOpen, action, onClose }: { isOpen: boolean; action: (typeof QUICK_ACTIONS)[number]; onClose: () => void }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    useEffect(() => {
        if (!shouldRender) return;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [shouldRender]);

    if (!shouldRender) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-action-title"
            onClick={onClose}
        >
            <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
            <div
                className={`relative mx-auto flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1e1e24]/85 shadow-2xl backdrop-blur-xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
                    <div>
                        <h2 id="quick-action-title" className="text-xl font-bold text-white">{action.label}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                        aria-label="Close popup"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-transparent p-5">
                    <QuickActionContent actionKey={action.key} />
                </div>
            </div>
        </div>,
        document.body
    );
};

const QuickActionContent = ({ actionKey }: { actionKey: QuickActionKey }) => {
    if (actionKey === "residents") return <ResidentsPage />;
    if (actionKey === "gate-logs") return <GateLogsPage />;
    if (actionKey === "update-requests") return <UpdateRequestsPage />;
    return <ReportsPage />;
};

const QuickActionButton = ({ children, onClick, primary }: { children: ReactNode; onClick: () => void; primary?: boolean }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition ${primary
            ? "bg-[#C5A073] text-[#121212] shadow-sm hover:bg-[#b08e64]"
            : "border border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
    >
        {children}
    </button>
);

const HealthRow = ({
    label,
    status,
    indicator = "neutral",
}: {
    label: string;
    status: string;
    indicator?: "success" | "danger" | "neutral";
}) => {
    const dotClass =
        indicator === "success"
            ? "bg-emerald-500"
            : indicator === "danger"
                ? "bg-red-500"
                : "bg-zinc-400";

    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-zinc-400">{label}</span>
            <span className="inline-flex items-center gap-1.5 font-medium capitalize text-zinc-100">
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
                {status}
            </span>
        </div>
    );
};

// ─── Vehicle Traffic Monitor ─────────────────────────────────────────────────

type VtmFilter = 'day' | 'week' | 'month' | 'year';

const VTM_FILTERS: { key: VtmFilter; label: string }[] = [
    { key: 'day',   label: 'DAY'   },
    { key: 'week',  label: 'WEEK'  },
    { key: 'month', label: 'MONTH' },
    { key: 'year',  label: 'YEAR'  },
];

const VehicleTrafficMonitor = ({
    filter,
    onFilterChange,
    carMonitor,
}: {
    filter: VtmFilter;
    onFilterChange: (f: VtmFilter) => void;
    carMonitor?: {
        daily?:   { count: number; entries: number; exits: number; trend: 'up' | 'down'; diff: number };
        weekly?:  { count: number; entries: number; exits: number; trend: 'up' | 'down'; diff: number };
        monthly?: { count: number; entries: number; exits: number; trend: 'up' | 'down'; diff: number };
        yearly?:  { count: number; entries: number; exits: number; trend: 'up' | 'down'; diff: number };
    };
}) => {
    const periodKey: 'daily' | 'weekly' | 'monthly' | 'yearly' =
        filter === 'day'   ? 'daily'
        : filter === 'week'  ? 'weekly'
        : filter === 'month' ? 'monthly'
        : 'yearly';

    const stats = carMonitor?.[periodKey];
    const inside  = stats?.entries ?? 0;
    const outside = stats?.exits   ?? 0;
    const total   = stats?.count   ?? (inside + outside);
    const diff    = stats?.diff    ?? 0;
    const trend   = stats?.trend   ?? 'up';

    const maxVal  = Math.max(total, 1);
    const insidePct  = Math.round((inside  / maxVal) * 100);
    const outsidePct = Math.round((outside / maxVal) * 100);

    const periodLabel = filter === 'day' ? 'Today' : filter === 'week' ? 'This week' : filter === 'month' ? 'This month' : 'This year';

    return (
        <section className="rounded-xl border border-white/5 bg-[#18181b] p-5">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                    {/* Truck icon */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C5A073]/10 text-[#C5A073]">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h1m8-1h1l1-1V9l-3-3h-1m-3 0V4m3 12V9" />
                        </svg>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-zinc-100">Vehicle Traffic Monitor</h2>
                            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/5">
                                Subdivision Gate
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">Vehicles entering &amp; exiting the subdivision</p>
                    </div>
                </div>

                {/* DAY / WEEK / MONTH / YEAR filter tabs */}
                <div className="flex items-center gap-1 rounded-lg bg-zinc-900/60 border border-white/5 p-1 self-start sm:self-auto">
                    {VTM_FILTERS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onFilterChange(key)}
                            className={`rounded-md px-3 py-1.5 text-[11px] font-bold tracking-wide transition-all duration-200 ${
                                filter === key
                                    ? 'bg-[#C5A073] text-[#121212] shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Three stat cards */}
            <div className="grid gap-4 sm:grid-cols-3">

                {/* Vehicles Inside */}
                <div className="rounded-xl border border-emerald-500/15 bg-zinc-900/50 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                            {/* Download / arrow-down-circle icon */}
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            {trend === 'up' ? `+${diff}` : `-${diff}`}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-zinc-400 mb-1">Vehicles Inside</p>
                        <p className="text-4xl font-bold text-emerald-400 leading-none">{inside}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">{periodLabel} · entries (IN)</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5">
                            <span>{insidePct}% of total movements</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                                style={{ width: `${insidePct}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Vehicles Outside */}
                <div className="rounded-xl border border-red-500/15 bg-zinc-900/50 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                            {/* Upload / arrow-up icon */}
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>
                        <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                            OUT
                        </span>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-zinc-400 mb-1">Vehicles Outside</p>
                        <p className="text-4xl font-bold text-red-400 leading-none">{outside}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">{periodLabel} · exits (OUT)</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5">
                            <span>{outsidePct}% of total movements</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-red-400 transition-all duration-700"
                                style={{ width: `${outsidePct}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Total Movements */}
                <div className="rounded-xl border border-yellow-500/15 bg-zinc-900/50 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
                            {/* Bar chart icon */}
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <span className="text-[11px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                            TOTAL
                        </span>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-zinc-400 mb-1">Total Movements</p>
                        <p className="text-4xl font-bold text-yellow-400 leading-none">{total}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">{periodLabel} · all gate events</p>
                    </div>
                    {/* Inside / Outside breakdown bars */}
                    <div className="space-y-2">
                        <div>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                                    Inside
                                </span>
                                <span className="text-zinc-400">{inside}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                                    style={{ width: `${insidePct}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="flex items-center gap-1.5 text-red-400 font-medium">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" />
                                    Outside
                                </span>
                                <span className="text-zinc-400">{outside}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-red-400 transition-all duration-700"
                                    style={{ width: `${outsidePct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DashboardPage;

