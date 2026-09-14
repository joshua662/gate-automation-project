import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import GateAccessService from "../../services/GateAccessService";
import type { GateLog, NotificationItem, UpdateRequestItem } from "../../interfaces/GateInterface";
import { useAuth } from "../../contexts/AuthContext";
import Spinner from "../../components/Spinner/Spinner";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatPlateInput } from "../../utils/plateOcr";

type ResidentModal = "notifications" | "logs" | "guest" | null;

type GuestForm = {
    guest_name: string;
    guest_age: string;
    guest_contact_number: string;
    guest_address: string;
    guest_plate_number: string;
    guest_car_model: string;
    guest_car_color: string;
    access_date: string;
    access_reason: string;
};

const blankGuestForm: GuestForm = {
    guest_name: "",
    guest_age: "",
    guest_contact_number: "",
    guest_address: "",
    guest_plate_number: "",
    guest_car_model: "",
    guest_car_color: "",
    access_date: "",
    access_reason: "",
};

const ResidentDashboardSkeleton = () => (
    <div className="flex h-full w-full flex-1 flex-col gap-6 animate-pulse">
        {/* Header */}
        <div className="space-y-2">
            <div className="h-8 w-60 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-80 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* 3 Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <div className="h-7 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
            ))}
        </div>

        {/* Grid layout for Recent Notifications & Quick Links */}
        <div className="grid gap-4 lg:grid-cols-3">
            {/* Notifications Column */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800 lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="h-5 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-4 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-r-lg border-l-4 border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900 space-y-2.5">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                        <div className="h-3.5 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                ))}
            </div>

            {/* Quick Links Column */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800 space-y-4">
                <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
                {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30">
                        <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const ResidentHomePage = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<GateLog[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [requests, setRequests] = useState<UpdateRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [submittingGuest, setSubmittingGuest] = useState(false);
    const [activeModal, setActiveModal] = useState<ResidentModal>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    const [openRequest, setOpenRequest] = useState<number | null>(null);
    const [guestForm, setGuestForm] = useState<GuestForm>(blankGuestForm);
    const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const loadDashboardData = useCallback((showInitialLoading = false) => {
        if (showInitialLoading) setLoading(true);

        return Promise.all([
            GateAccessService.myGateLogs(1),
            GateAccessService.loadNotifications(1),
        ])
            .then(([logsRes, notifRes]) => {
                setLogs(logsRes.data.logs.data ?? []);
                setNotifications(notifRes.data.notifications.data ?? []);
            })
            .catch((error) => {
                console.error("Failed to load resident dashboard data:", error);
            })
            .finally(() => {
                if (showInitialLoading) setLoading(false);
            });
    }, []);

    const loadRequests = () => {
        setRequestsLoading(true);
        GateAccessService.myUpdateRequests(1)
            .then((res) => setRequests(res.data.requests.data ?? []))
            .finally(() => setRequestsLoading(false));
    };

    useEffect(() => {
        void loadDashboardData(true);
    }, [loadDashboardData]);

    useEffect(() => {
        if (activeModal === "guest") loadRequests();
    }, [activeModal]);

    if (loading) return <ResidentDashboardSkeleton />;

    const displayName = [user?.user?.first_name, user?.user?.last_name].filter(Boolean).join(" ") || "Resident";
    const recentNotifications = notifications.slice(0, 5);
    const lastEntry = logs.find((log) => log.direction === "IN");
    const lastExit = logs.find((log) => log.direction === "OUT");
    const unauthorizedCount = logs.filter((log) => log.status === "unauthorized").length;
    const guestRequests = requests.filter((request) => request.requested_changes?.request_type === "guest_access");

    const openGuestModal = () => {
        setNotice(null);
        setActiveModal("guest");
    };

    const markAllRead = async () => {
        await GateAccessService.markAllNotificationsRead();
        await loadDashboardData();
        window.dispatchEvent(new Event('notifications_updated'));
    };

    const markRead = async (id: number) => {
        await GateAccessService.markNotificationRead(id);
        await loadDashboardData();
        window.dispatchEvent(new Event('notifications_updated'));
    };

    const submitGuestAccess = async (event: FormEvent) => {
        event.preventDefault();
        setSubmittingGuest(true);
        setNotice(null);

        try {
            await GateAccessService.submitUpdateRequest({
                request_type: "guest_access",
                ...guestForm,
                guest_plate_number: guestForm.guest_plate_number.toUpperCase(),
                guest_age: guestForm.guest_age || undefined,
            });
            setGuestForm(blankGuestForm);
            setNotice({ type: "success", message: "Guest access request submitted for admin review." });
            loadRequests();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            setNotice({ type: "error", message: err.response?.data?.message ?? "Failed to submit guest access request." });
        } finally {
            setSubmittingGuest(false);
        }
    };

    return (
        <div className="flex h-full w-full flex-1 flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-white/5 pb-5">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Welcome, {displayName}!</h1>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">Gate Security System - Resident Portal</p>
                </div>
                {/* Date & Time display (auto-refreshing clock) */}
                <div className="flex items-center gap-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 px-4 py-2.5 text-zinc-800 dark:text-zinc-200 self-start md:self-auto">
                    <svg className="w-4 h-4 text-blue-600 dark:text-[#C5A073]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-mono text-sm tracking-wide">
                        {currentTime.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} {currentTime.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                    title="Last Entry"
                    icon={<BarIcon className="text-green-600 dark:text-green-400" />}
                    value={lastEntry ? formatTime(lastEntry.logged_at) : "No entries yet"}
                    sub={lastEntry ? formatDate(lastEntry.logged_at) : undefined}
                    badge={lastEntry ? "AUTHORIZED" : undefined}
                    badgeClass="text-green-600 dark:text-green-400"
                />
                <SummaryCard
                    title="Last Exit"
                    icon={<ExitIcon className="text-blue-600 dark:text-blue-400" />}
                    value={lastExit ? formatTime(lastExit.logged_at) : "No exits yet"}
                    sub={lastExit ? formatDate(lastExit.logged_at) : undefined}
                    badge={lastExit ? "AUTHORIZED" : undefined}
                    badgeClass="text-blue-600 dark:text-blue-400"
                />
                <SummaryCard
                    title="Access Status"
                    icon={<LockIcon className="text-zinc-600 dark:text-zinc-400" />}
                    value="Authorized"
                    sub={`${logs.length} total accesses`}
                    badge={unauthorizedCount > 0 ? `${unauthorizedCount} unauthorized attempts` : undefined}
                    badgeClass="text-red-600 dark:text-red-400"
                    valueClass="text-green-600 dark:text-green-400"
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent Notifications</h2>
                        <button type="button" onClick={() => setActiveModal("notifications")} className="text-sm text-blue-600 hover:underline dark:text-blue-400">View All</button>
                    </div>
                    {recentNotifications.length > 0 ? (
                        <div className="space-y-3">
                            {recentNotifications.map((notification) => (
                                <NotificationCard key={notification.notification_id} notification={notification} compact />
                            ))}
                        </div>
                    ) : (
                        <p className="py-6 text-center text-zinc-500 dark:text-zinc-400">No notifications yet</p>
                    )}
                </section>

                <aside className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
                    <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Quick Links</h2>
                    <div className="space-y-3">
                        <QuickAction onClick={() => setActiveModal("logs")} icon={<ClipboardIcon />} title="Gate Logs" sub="IN/OUT history" />
                        <QuickAction onClick={openGuestModal} icon={<CarIcon />} title="Guest Access" sub="Request visitor access" />
                    </div>
                </aside>
            </div>

            <DashboardModal title="Notifications" isOpen={activeModal === "notifications"} onClose={() => setActiveModal(null)} maxWidth="max-w-4xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Stay updated on gate access alerts and system messages.</p>
                    {notifications.some((item) => !item.is_read) && (
                        <button type="button" onClick={() => void markAllRead()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                            Mark all as read
                        </button>
                    )}
                </div>
                <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                    {notifications.length > 0 ? notifications.map((notification) => (
                        <NotificationCard key={notification.notification_id} notification={notification} onMarkRead={() => void markRead(notification.notification_id)} />
                    )) : (
                        <EmptyCard text="No notifications. You're all caught up." />
                    )}
                </div>
            </DashboardModal>

            <DashboardModal title="Gate Access Logs" isOpen={activeModal === "logs"} onClose={() => setActiveModal(null)} maxWidth="max-w-6xl">
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <StatMini label="Total Entries Today" value={String(countToday(logs, "IN"))} />
                    <StatMini label="Total Exits Today" value={String(countToday(logs, "OUT"))} />
                    <StatMini label="Unauthorized Attempts" value={String(unauthorizedCount)} danger />
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
                    {logs.length > 0 ? (
                        <table className="w-full min-w-[760px] bg-white dark:bg-zinc-800">
                            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                                <tr>
                                    <Head>Date & Time</Head>
                                    <Head>Status</Head>
                                    <Head>Access Type</Head>
                                    <Head>Plate Number</Head>
                                    <Head center>Image</Head>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                                {logs.map((log) => (
                                    <tr key={log.gate_log_id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                                        <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100">
                                            <p className="font-medium">{formatDate(log.logged_at)}</p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(log.logged_at).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex items-center gap-2 font-medium ${log.status === "authorized" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                                                <span className={`h-2 w-2 rounded-full ${log.status === "authorized" ? "bg-green-500" : "bg-red-500"}`} />
                                                {log.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${log.direction === "IN" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                                {log.direction === "IN" ? "Entry" : "Exit"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-zinc-900 dark:text-zinc-100">{log.plate_number || "-"}</td>
                                        <td className="px-6 py-4 text-center">
                                            {log.capture_image ? (
                                                <button type="button" onClick={() => setImagePreview(log.capture_image ?? null)} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                                                    View
                                                </button>
                                            ) : (
                                                <span className="text-sm text-zinc-500 dark:text-zinc-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <EmptyCard text="No gate logs found." />
                    )}
                </div>
            </DashboardModal>

            <DashboardModal title="Guest Access" isOpen={activeModal === "guest"} onClose={() => setActiveModal(null)} maxWidth="max-w-5xl">
                {notice && (
                    <div className={`mb-4 rounded-lg border p-4 text-sm font-medium ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200" : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"}`}>
                        {notice.message}
                    </div>
                )}

                <form onSubmit={submitGuestAccess} className="space-y-5">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                        <h3 className="mb-3 text-lg font-semibold text-blue-900 dark:text-blue-100">Your Information (Host)</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <ReadOnlyInfo label="Host Name" value={[user?.user?.first_name, user?.user?.last_name].filter(Boolean).join(" ")} />
                            <ReadOnlyInfo label="Your Vehicle Plate" value={user?.user?.plate_number} />
                        </div>
                    </div>

                    <SectionHeading title="Guest Vehicle Owner Information" />
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Guest Name" name="guest_name" value={guestForm.guest_name} onChange={(value) => setGuestForm({ ...guestForm, guest_name: value })} required placeholder="Full name of the guest vehicle owner" />
                        <Field label="Guest Age" name="guest_age" type="number" value={guestForm.guest_age} onChange={(value) => setGuestForm({ ...guestForm, guest_age: value })} placeholder="Age (optional)" />
                        <Field label="Guest Contact Number" name="guest_contact_number" value={guestForm.guest_contact_number} onChange={(value) => setGuestForm({ ...guestForm, guest_contact_number: value.replace(/\D/g, "").slice(0, 11) })} required maxLength={11} inputMode="numeric" pattern="[0-9]*" placeholder="Mobile number of the guest" />
                        <Field label="Guest Address" name="guest_address" value={guestForm.guest_address} onChange={(value) => setGuestForm({ ...guestForm, guest_address: value })} textarea placeholder="Home address of the guest (optional)" />
                    </div>

                    <SectionHeading title="Guest Vehicle Information" />
                    <div className="grid gap-5 md:grid-cols-3">
                        <Field label="Vehicle Plate Number" name="guest_plate_number" value={guestForm.guest_plate_number} onChange={(value) => setGuestForm({ ...guestForm, guest_plate_number: formatPlateInput(value) })} required placeholder="e.g. ABC 1234" mono />
                        <Field label="Car Model" name="guest_car_model" value={guestForm.guest_car_model} onChange={(value) => setGuestForm({ ...guestForm, guest_car_model: value })} required placeholder="Honda Civic 2020" />
                        <Field label="Car Color" name="guest_car_color" value={guestForm.guest_car_color} onChange={(value) => setGuestForm({ ...guestForm, guest_car_color: value })} placeholder="White" />
                    </div>

                    <SectionHeading title="Access Details" />
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Access Date" name="access_date" type="date" value={guestForm.access_date} onChange={(value) => setGuestForm({ ...guestForm, access_date: value })} required />
                        <Field label="Reason for Access" name="access_reason" value={guestForm.access_reason} onChange={(value) => setGuestForm({ ...guestForm, access_reason: value })} required textarea placeholder="Family visit, delivery, service provider, etc." />
                    </div>

                    <button type="submit" disabled={submittingGuest} className="w-full rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {submittingGuest ? "Submitting..." : "Submit Guest Access Request"}
                    </button>
                </form>

                <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your Guest Access Requests</h3>
                    <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                        {requestsLoading ? (
                            <Spinner size="md" />
                        ) : guestRequests.length > 0 ? guestRequests.map((request) => (
                            <RequestCard key={request.update_request_id} request={request} onOpen={() => setOpenRequest(request.update_request_id)} />
                        )) : (
                            <EmptyCard text="No guest access requests yet. Submit your first request above." />
                        )}
                    </div>
                </div>
            </DashboardModal>

            <RequestDetailModal 
                isOpen={!!openRequest}
                request={requests.find((request) => request.update_request_id === openRequest)} 
                onClose={() => setOpenRequest(null)} 
            />

            <ImagePreviewModal src={imagePreview} onClose={() => setImagePreview(null)} />
        </div>
    );
};

const DashboardModal = ({
    title,
    isOpen,
    onClose,
    children,
    maxWidth = "max-w-4xl",
}: {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: string;
}) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <button
                type="button"
                aria-label="Close modal"
                onClick={onClose}
                className={`fixed inset-0 bg-black/75 backdrop-blur-md ${
                    isAnimatingOut ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
                }`}
            />
            <div
                className={`relative flex flex-col w-full ${maxWidth} max-h-[88vh] rounded-2xl border border-white/15 bg-[#18181c] p-5 shadow-2xl backdrop-blur-xl md:p-6 text-zinc-100 ${
                    isAnimatingOut ? "animate-modal-panel-out" : "animate-modal-panel-in"
                }`}
            >
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 shrink-0">
                    <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto pt-4 pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                    {children}
                </div>
            </div>
        </div>
    );
};

const NotificationCard = ({ notification, compact, onMarkRead }: { notification: NotificationItem; compact?: boolean; onMarkRead?: () => void }) => {
    const meta = notificationMeta(notification.type);

    return (
        <div className={`rounded-r-lg border-l-4 p-4 ${notification.is_read ? "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900" : "border-blue-500 bg-blue-50 dark:bg-blue-900/20"}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{notification.title || "System Notification"}</h3>
                        {!notification.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{compact ? limitText(notification.message, 100) : notification.message}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {!compact && <span className={`rounded px-2 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>}
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatRelative(notification.created_at)}</p>
                    </div>
                </div>
                {!compact && !notification.is_read && onMarkRead && (
                    <button type="button" onClick={onMarkRead} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                        Read
                    </button>
                )}
            </div>
        </div>
    );
};

const SummaryCard = ({
    title,
    icon,
    value,
    sub,
    badge,
    badgeClass,
    valueClass,
}: {
    title: string;
    icon: ReactNode;
    value: string;
    sub?: string;
    badge?: string;
    badgeClass: string;
    valueClass?: string;
}) => (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</h3>
            {icon}
        </div>
        <p className={`text-2xl font-bold ${valueClass ?? "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
        {sub && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
        {badge && <p className={`mt-1 text-xs font-medium ${badgeClass}`}>{badge}</p>}
    </div>
);

const QuickAction = ({ onClick, icon, title, sub }: { onClick: () => void; icon: ReactNode; title: string; sub: string }) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-700">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-blue-600 dark:bg-zinc-700 dark:text-blue-400">{icon}</span>
        <span>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
        </span>
    </button>
);

const SectionHeading = ({ title }: { title: string }) => (
    <div className="border-t border-white/10 pt-5">
        <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
    </div>
);

const ReadOnlyInfo = ({ label, value }: { label: string; value?: string }) => (
    <div className="rounded-lg bg-black/30 border border-white/5 p-3">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-blue-400">{label}</p>
        <p className="text-sm font-semibold text-blue-100">{value || "-"}</p>
    </div>
);

const Field = ({
    label,
    name,
    value,
    onChange,
    type = "text",
    required,
    placeholder,
    textarea,
    mono,
    maxLength,
    inputMode,
    pattern,
}: {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
    placeholder?: string;
    textarea?: boolean;
    mono?: boolean;
    maxLength?: number;
    inputMode?: "search" | "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "none";
    pattern?: string;
}) => (
    <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {label}{required ? <span className="text-violet-400"> *</span> : ""}
        </span>
        {textarea ? (
            <textarea
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={3}
                required={required}
                placeholder={placeholder}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:bg-black/50 focus:ring-1 focus:ring-violet-500"
            />
        ) : (
            <input
                type={type}
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required={required}
                placeholder={placeholder}
                maxLength={maxLength}
                inputMode={inputMode}
                pattern={pattern}
                min={type === "number" ? 1 : undefined}
                max={type === "number" ? 150 : undefined}
                className={`w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:bg-black/50 focus:ring-1 focus:ring-violet-500 ${
                    mono ? "font-mono uppercase" : ""
                }`}
            />
        )}
    </label>
);

const RequestCard = ({ request, onOpen }: { request: UpdateRequestItem; onOpen: () => void }) => {
    const changes = request.requested_changes;

    return (
        <button
            type="button"
            onClick={onOpen}
            className="w-full rounded-xl border border-white/10 bg-black/25 p-4 text-left shadow-sm transition hover:border-violet-500/50 hover:bg-black/40"
        >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid flex-1 gap-3 text-sm md:grid-cols-4">
                    <Mini label={`Request #${request.update_request_id}`} value={changes.guest_name ?? "Guest"} strong />
                    <Mini label="Vehicle Plate" value={changes.guest_plate_number ?? "N/A"} mono />
                    <Mini label="Access Date" value={formatMaybeDate(changes.access_date)} />
                    <Mini label="Submitted" value={new Date(request.created_at).toLocaleDateString()} />
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(request.status)}`}>{request.status}</span>
            </div>
        </button>
    );
};

const RequestDetailModal = ({ isOpen, request, onClose }: { isOpen: boolean; request?: UpdateRequestItem; onClose: () => void }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);
    
    if (!shouldRender || !request) return null;

    const entries = Object.entries(request.requested_changes).filter(([key]) => key !== "request_type");

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <button type="button" aria-label="Close modal" onClick={onClose} className={`fixed inset-0 bg-black/80 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
            <div className={`relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-white/15 bg-[#1e1e24] p-6 shadow-2xl backdrop-blur-xl text-zinc-100 ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}>
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 shrink-0">
                    <div>
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-3 py-1 text-xs font-bold text-violet-300">GUEST ACCESS</span>
                            <h3 className="text-xl font-bold text-white">Request #{request.update_request_id}</h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(request.status)}`}>{request.status}</span>
                        </div>
                        <p className="text-xs text-zinc-400">Submitted on {new Date(request.created_at).toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {entries.map(([key, value]) => (
                            <div key={key} className="rounded-xl border border-white/5 bg-black/30 p-3.5">
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">{labelize(key)}</p>
                                <p className="break-words text-sm font-medium text-white">{String(value || "N/A")}</p>
                            </div>
                        ))}
                    </div>

                    {request.admin_notes && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                            <strong className="text-amber-300 font-semibold">Admin notes:</strong> {request.admin_notes}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Head = ({ children, center }: { children: string; center?: boolean }) => (
    <th className={`px-6 py-3 text-xs font-semibold uppercase text-zinc-700 dark:text-zinc-300 ${center ? "text-center" : "text-left"}`}>{children}</th>
);

const StatMini = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="mb-1 text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">{label}</p>
        <p className={`text-2xl font-bold ${danger ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
    </div>
);

const Mini = ({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) => (
    <div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className={`${strong ? "font-semibold" : ""} ${mono ? "font-mono" : ""} text-zinc-900 dark:text-zinc-100`}>{value}</p>
    </div>
);

const EmptyCard = ({ text }: { text: string }) => (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">{text}</div>
);

const notificationMeta = (type: string) => {
    const map: Record<string, { label: string; className: string }> = {
        gate_open: { label: "Gate Access", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
        unauthorized: { label: "Unauthorized", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
        update_request: { label: "Update Request", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
        system: { label: "System", className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
    };

    return map[type] ?? { label: "General", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
};

const statusClass = (status: UpdateRequestItem["status"]) => {
    if (status === "approved") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    if (status === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
};

const countToday = (logs: GateLog[], direction: GateLog["direction"]) => {
    const today = new Date().toDateString();
    return logs.filter((log) => log.direction === direction && new Date(log.logged_at).toDateString() === today).length;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatRelative = (value: string) => new Date(value).toLocaleString();
const formatMaybeDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "N/A";
const labelize = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
const limitText = (value: string, limit: number) => value.length > limit ? `${value.slice(0, limit)}...` : value;

const Svg = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <svg className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{children}</svg>
);

const ImagePreviewModal = ({ src, onClose }: { src: string | null; onClose: () => void }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(!!src);
    if (!shouldRender || !src) return null;

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <button type="button" aria-label="Close modal" onClick={onClose} className={`fixed inset-0 bg-black/80 backdrop-blur-sm ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
            <div className={`relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl border border-white/10 shadow-2xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}>
                <img src={src} alt="Preview" className="max-h-[90vh] max-w-[90vw] object-contain" />
                <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition">
                    <Svg><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></Svg>
                </button>
            </div>
        </div>
    );
};

const BarIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 19V9m8 10V5m8 14v-7" /></Svg>;
const ExitIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H3m0 0 4-4m-4 4 4 4m5-9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2" /></Svg>;
const LockIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11V8a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" /></Svg>;
const ClipboardIcon = () => <Svg><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5h6m-8 4h10M7 13h10M7 17h6M9 3h6a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2Z" /></Svg>;
const CarIcon = () => <Svg><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 17h14M7 17a2 2 0 1 1-4 0m18 0a2 2 0 1 1-4 0M5 17V9l2-4h10l2 4v8M7 9h10" /></Svg>;

export default ResidentHomePage;
