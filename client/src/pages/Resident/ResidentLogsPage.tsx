import { useCallback, useEffect, useState } from "react";
import GateAccessService from "../../services/GateAccessService";
import type { GateLog } from "../../interfaces/GateInterface";
import Spinner from "../../components/Spinner/Spinner";

const ResidentLogsPage = () => {
    const [logs, setLogs] = useState<GateLog[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Filters
    const [directionFilter, setDirectionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [periodFilter, setPeriodFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const fetchLogs = useCallback((targetPage = 1, showInitialLoading = false) => {
        if (showInitialLoading) setLoading(true);
        setRefreshing(true);

        const filters = {
            direction: directionFilter || undefined,
            status: statusFilter || undefined,
            period: periodFilter || undefined,
            search: searchQuery.trim() || undefined,
        };

        return GateAccessService.myGateLogs(targetPage, filters)
            .then((res) => {
                const pagination = res.data.logs;
                setLogs(pagination.data ?? []);
                setPage(pagination.current_page ?? 1);
                setLastPage(pagination.last_page ?? 1);
                setTotalLogs(pagination.total ?? 0);
            })
            .catch((error) => {
                console.error("Failed to load resident gate logs:", error);
            })
            .finally(() => {
                if (showInitialLoading) setLoading(false);
                setRefreshing(false);
            });
    }, [directionFilter, statusFilter, periodFilter, searchQuery]);

    useEffect(() => {
        void fetchLogs(1, true);
    }, [fetchLogs]);

    const handleExportCsv = async () => {
        try {
            const res = await GateAccessService.exportCsv({
                direction: directionFilter || undefined,
                status: statusFilter || undefined,
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `my_gate_logs_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to export CSV:", err);
        }
    };

    const handleExportPdf = async () => {
        try {
            const res = await GateAccessService.exportPdf({
                direction: directionFilter || undefined,
                status: statusFilter || undefined,
            });
            const blob = new Blob([res.data], { type: "text/html" });
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch (err) {
            console.error("Failed to export PDF:", err);
        }
    };

    const todayStr = new Date().toDateString();
    const entriesToday = logs.filter((log) => log.direction === "IN" && new Date(log.logged_at).toDateString() === todayStr).length;
    const exitsToday = logs.filter((log) => log.direction === "OUT" && new Date(log.logged_at).toDateString() === todayStr).length;
    const unauthorizedCount = logs.filter((log) => log.status === "unauthorized").length;

    if (loading) return <div className="flex justify-center p-12"><Spinner size="md" /></div>;

    return (
        <div className="flex h-full w-full flex-1 flex-col gap-6">
            {/* Page Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Gate Access Logs</h1>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">Your personal IN/OUT history and gate access records</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                        Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={handleExportPdf}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                        Print / PDF
                    </button>
                    <button
                        type="button"
                        onClick={() => void fetchLogs(page)}
                        disabled={refreshing}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <StatMini label="Total Entries Today" value={String(entriesToday)} />
                <StatMini label="Total Exits Today" value={String(exitsToday)} />
                <StatMini label="Unauthorized Attempts" value={String(unauthorizedCount)} danger />
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <div className="min-w-[180px] flex-1">
                    <input
                        type="text"
                        placeholder="Search by plate or owner..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:bg-white dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={directionFilter}
                        onChange={(e) => setDirectionFilter(e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    >
                        <option value="">All Directions</option>
                        <option value="IN">Entry (IN)</option>
                        <option value="OUT">Exit (OUT)</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    >
                        <option value="">All Statuses</option>
                        <option value="authorized">Authorized</option>
                        <option value="unauthorized">Unauthorized</option>
                    </select>

                    <select
                        value={periodFilter}
                        onChange={(e) => setPeriodFilter(e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    >
                        <option value="">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                {logs.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                                <tr>
                                    <Head>Date & Time</Head>
                                    <Head>Status</Head>
                                    <Head>Access Type</Head>
                                    <Head>Plate Number</Head>
                                    <Head>Vehicle Info</Head>
                                    <Head center>Capture Image</Head>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                                {logs.map((log) => (
                                    <tr key={log.gate_log_id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                                        <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100">
                                            <p className="font-medium">{new Date(log.logged_at).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}</p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(log.logged_at).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex items-center gap-2 font-medium ${log.status === "authorized" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                                                <span className={`h-2 w-2 rounded-full ${log.status === "authorized" ? "bg-green-500" : "bg-red-500"}`} />
                                                {log.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex rounded px-2.5 py-1 text-xs font-medium ${log.direction === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                                {log.direction === "IN" ? "Entry" : "Exit"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">{log.plate_number || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                                            <p className="font-medium">{log.owner_name || "Resident / Guest"}</p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{[log.car_model, log.car_color].filter(Boolean).join(" • ") || "N/A"}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {log.capture_image ? (
                                                <button type="button" onClick={() => setImagePreview(log.capture_image ?? null)} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                                                    View Image
                                                </button>
                                            ) : (
                                                <span className="text-sm text-zinc-500 dark:text-zinc-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-12 text-center">
                        <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300">No gate logs found</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Your gate access history will appear here once recorded.</p>
                    </div>
                )}

                {/* Pagination Controls */}
                {lastPage > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            Showing page <span className="font-semibold">{page}</span> of <span className="font-semibold">{lastPage}</span> ({totalLogs} total logs)
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void fetchLogs(page - 1)}
                                disabled={page <= 1 || refreshing}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => void fetchLogs(page + 1)}
                                disabled={page >= lastPage || refreshing}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {imagePreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Gate Capture Image</h3>
                            <button type="button" onClick={() => setImagePreview(null)} className="rounded-full bg-zinc-800 p-1.5 text-zinc-400 hover:text-white">
                                ✕
                            </button>
                        </div>
                        <img src={imagePreview} alt="Captured plate" className="max-h-[75vh] w-full rounded-lg object-contain" />
                    </div>
                </div>
            )}
        </div>
    );
};

const Head = ({ children, center }: { children: string; center?: boolean }) => (
    <th className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 ${center ? "text-center" : "text-left"}`}>{children}</th>
);

const StatMini = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <p className="mb-1 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className={`text-2xl font-bold ${danger ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
    </div>
);

export default ResidentLogsPage;
