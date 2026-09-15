import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import GateAccessService from "../../services/GateAccessService";
import type { UpdateRequestItem } from "../../interfaces/GateInterface";

const UpdateRequestsSkeleton = () => (
    <div className="animate-pulse grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
            <div className="h-8 w-56 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="space-y-3">
                {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
                ))}
            </div>
            <div className="h-32 rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
        </div>

        <div className="space-y-4">
            <div className="h-8 w-56 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="space-y-3">
                {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
                ))}
            </div>
            <div className="h-32 rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
        </div>
    </div>
);

const UpdateRequestsPage = () => {
    const [requests, setRequests] = useState<UpdateRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [selectedRequest, setSelectedRequest] = useState<UpdateRequestItem | null>(null);
    const [message, setMessage] = useState("");

    const load = useCallback((status: string) => {
        GateAccessService.loadUpdateRequests(1, status)
            .then((res) => setRequests(res.data.requests.data ?? []))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load(filter);
    }, [filter, load]);

    const review = async (request: UpdateRequestItem, status: "approved" | "rejected") => {
        await GateAccessService.reviewUpdateRequest(request.update_request_id, { status });
        setMessage(`${requestTypeLabel(request)} request ${status}.`);
        setSelectedRequest(null);
        setLoading(true);
        load(filter);
    };

    const stats = useMemo(() => ({
        total: requests.length,
        pending: requests.filter((request) => request.status === "pending").length,
        approved: requests.filter((request) => request.status === "approved").length,
        rejected: requests.filter((request) => request.status === "rejected").length,
    }), [requests]);

    const profileRequests = requests.filter((request) => !isGuestRequest(request));
    const guestRequests = requests.filter(isGuestRequest);

    return (
        <div className="w-full space-y-8">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Update Requests</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review and approve resident profile and guest vehicle access requests</p>
            </div>

            {message && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">{message}</div>
            )}

            <div className="grid gap-4 md:grid-cols-4">
                <Stat label="Total Requests" value={stats.total} />
                <Stat label="Pending" value={stats.pending} tone="yellow" />
                <Stat label="Approved" value={stats.approved} tone="green" />
                <Stat label="Rejected" value={stats.rejected} tone="red" />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
                <label className="block max-w-xs">
                    <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Filter by Status</span>
                    <select value={filter} onChange={(event) => { setLoading(true); setFilter(event.target.value); }} className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100">
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </label>
            </div>

            {loading ? <UpdateRequestsSkeleton /> : (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Left side: Profile Update Request */}
                    <div className="space-y-6">
                        <RequestSection title="Profile Update Requests" tone="blue" requests={profileRequests} onSelect={setSelectedRequest} emptyText="No profile update requests found" />
                        <InfoPanel tone="blue" title="Profile Update Requests" items={[
                            "Residents can update personal information",
                            "Modify vehicle details including plate, model, and color",
                            "Update contact numbers and residential address",
                            "All changes require admin approval",
                            "Residents receive notifications upon decision",
                        ]} />
                    </div>

                    {/* Right side: Guest Access Request */}
                    <div className="space-y-6">
                        <RequestSection title="Guest Access Requests" tone="purple" requests={guestRequests} onSelect={setSelectedRequest} emptyText="No guest access requests found" />
                        <InfoPanel tone="purple" title="Guest Vehicle Access Requests" items={[
                            "Residents can request visitor vehicle access",
                            "Capture complete guest owner personal details",
                            "Record guest vehicle information including plate, model, and color",
                            "Set specific access dates and reasons",
                            "Approved guests can pass through the gate on the selected date",
                        ]} />
                    </div>
                </div>
            )}

            {selectedRequest && (
                <RequestModal
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onApprove={() => review(selectedRequest, "approved")}
                    onReject={() => review(selectedRequest, "rejected")}
                />
            )}
        </div>
    );
};

const RequestSection = ({ title, tone, requests, onSelect, emptyText }: { title: string; tone: "blue" | "purple"; requests: UpdateRequestItem[]; onSelect: (request: UpdateRequestItem) => void; emptyText: string }) => (
    <section className="space-y-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{tone === "blue" ? "Review resident profile changes" : "Review visitor vehicle access requests"}</p>
        </div>

        {requests.length > 0 ? requests.map((request) => (
            <button
                type="button"
                key={request.update_request_id}
                onClick={() => onSelect(request)}
                className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:bg-zinc-800 ${tone === "blue" ? "border-blue-200 hover:border-blue-400 dark:border-blue-700 dark:hover:border-blue-500" : "border-purple-200 hover:border-purple-400 dark:border-purple-700 dark:hover:border-purple-500"}`}
            >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 items-center gap-4">
                        <span className={`hidden rounded-full px-3 py-1 text-xs font-bold md:inline-block ${tone === "blue" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"}`}>
                            {tone === "blue" ? "PROFILE UPDATE" : "GUEST ACCESS"}
                        </span>
                        <div className="grid flex-1 gap-4 text-sm md:grid-cols-4">
                            {isGuestRequest(request) ? (
                                <>
                                    <Mini label="Guest Name" value={String(request.requested_changes.guest_name ?? "Guest")} strong />
                                    <Mini label="Host/Resident" value={residentName(request)} />
                                    <Mini label="Vehicle Plate" value={String(request.requested_changes.guest_plate_number ?? "N/A")} mono />
                                    <Mini label="Submitted" value={new Date(request.created_at).toLocaleString()} />
                                </>
                            ) : (
                                <>
                                    <Mini label="Resident" value={residentName(request)} strong />
                                    <Mini label="Resident ID" value={`#${request.user_id}`} />
                                    <Mini label="Current Plate" value={request.resident?.plate_number ?? "N/A"} mono />
                                    <Mini label="Submitted" value={new Date(request.created_at).toLocaleString()} />
                                </>
                            )}
                        </div>
                    </div>
                    <StatusBadge status={request.status} />
                </div>
            </button>
        )) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">{emptyText}</div>
        )}
    </section>
);

const RequestModal = ({ request, onClose, onApprove, onReject }: { request: UpdateRequestItem; onClose: () => void; onApprove: () => void; onReject: () => void }) => {
    const guest = isGuestRequest(request);
    const tone = guest ? "purple" : "blue";

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 py-10">
                <button type="button" aria-label="Close modal" onClick={onClose} className="fixed inset-0 bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80" />
                <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-800">
                    <div className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
                        <div className="flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-3">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone === "blue" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"}`}>
                                    {guest ? "GUEST ACCESS" : "PROFILE UPDATE"}
                                </span>
                                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{guest ? String(request.requested_changes.guest_name ?? "Guest") : residentName(request)}</h3>
                                <StatusBadge status={request.status} />
                            </div>
                            <div className="grid gap-4 text-sm md:grid-cols-4">
                                <Mini label={guest ? "Host/Resident" : "Resident"} value={residentName(request)} />
                                <Mini label={guest ? "Guest Vehicle Plate" : "Current Plate"} value={guest ? String(request.requested_changes.guest_plate_number ?? "N/A") : request.resident?.plate_number ?? "N/A"} mono />
                                <Mini label={guest ? "Access Date" : "Resident ID"} value={guest ? formatMaybeDate(request.requested_changes.access_date) : `#${request.user_id}`} />
                                <Mini label="Submitted" value={new Date(request.created_at).toLocaleString()} />
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="text-2xl leading-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">x</button>
                    </div>

                    {guest ? <GuestDetails request={request} /> : <ProfileDetails request={request} />}

                    <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-700">
                        <div className="text-xs text-zinc-500">{request.admin_notes ? `Admin notes: ${request.admin_notes}` : ""}</div>
                        {request.status === "pending" && (
                            <div className="flex gap-2">
                                <button type="button" onClick={onApprove} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Approve</button>
                                <button type="button" onClick={onReject} className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Reject</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ProfileDetails = ({ request }: { request: UpdateRequestItem }) => (
    <DetailBlock tone="blue" title="Requested Changes">
        {Object.entries(request.requested_changes).filter(([key]) => key !== "request_type").map(([key, value]) => (
            <DetailTile key={key} tone="blue" label={labelize(key)} value={String(value)} />
        ))}
    </DetailBlock>
);

const GuestDetails = ({ request }: { request: UpdateRequestItem }) => (
    <div className="space-y-6">
        <DetailBlock tone="purple" title="Guest Information">
            <DetailTile tone="purple" label="Guest Name" value={String(request.requested_changes.guest_name ?? "N/A")} />
            <DetailTile tone="purple" label="Guest Age" value={String(request.requested_changes.guest_age ?? "Not specified")} />
            <DetailTile tone="purple" label="Guest Contact" value={String(request.requested_changes.guest_contact_number ?? "N/A")} />
            <DetailTile tone="purple" label="Guest Address" value={String(request.requested_changes.guest_address ?? "Not specified")} />
        </DetailBlock>
        <DetailBlock tone="purple" title="Vehicle Information">
            <DetailTile tone="purple" label="Vehicle Plate" value={String(request.requested_changes.guest_plate_number ?? "N/A")} mono />
            <DetailTile tone="purple" label="Car Model" value={String(request.requested_changes.guest_car_model ?? "N/A")} />
            <DetailTile tone="purple" label="Car Color" value={String(request.requested_changes.guest_car_color ?? "Not specified")} />
        </DetailBlock>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-700 dark:bg-purple-900/20">
            <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Reason for Access</h4>
            <p className="text-sm text-zinc-900 dark:text-zinc-100">{String(request.requested_changes.access_reason ?? "N/A")}</p>
        </div>
    </div>
);

const DetailBlock = ({ tone, title, children }: { tone: "blue" | "purple"; title: string; children: ReactNode }) => (
    <div className="border-b border-zinc-200 pb-6 dark:border-zinc-700">
        <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4>
        <div className={`rounded-lg p-4 ${tone === "blue" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-purple-50 dark:bg-purple-900/20"}`}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
        </div>
    </div>
);

const DetailTile = ({ tone, label, value, mono }: { tone: "blue" | "purple"; label: string; value: string; mono?: boolean }) => (
    <div className={`rounded border bg-white p-3 dark:bg-zinc-800 ${tone === "blue" ? "border-blue-200 dark:border-blue-600" : "border-purple-200 dark:border-purple-600"}`}>
        <p className={`mb-1 text-xs font-semibold uppercase ${tone === "blue" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"}`}>{label}</p>
        <p className={`break-words text-sm text-zinc-900 dark:text-zinc-100 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
);

const InfoPanel = ({ tone, title, items }: { tone: "blue" | "purple"; title: string; items: string[] }) => (
    <div className={`rounded-xl border p-6 ${tone === "blue" ? "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20" : "border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20"}`}>
        <h3 className={`mb-3 text-lg font-semibold ${tone === "blue" ? "text-blue-900 dark:text-blue-100" : "text-purple-900 dark:text-purple-100"}`}>{title}</h3>
        <ul className={`space-y-2 text-sm ${tone === "blue" ? "text-blue-800 dark:text-blue-300" : "text-purple-800 dark:text-purple-300"}`}>
            {items.map((item) => <li key={item}>- {item}</li>)}
        </ul>
    </div>
);

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: "yellow" | "green" | "red" }) => {
    const classes = {
        default: "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100",
        yellow: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
        green: "border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400",
        red: "border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400",
    };

    return (
        <div className={`rounded-xl border p-4 ${classes[tone ?? "default"]}`}>
            <p className="mb-2 text-xs font-semibold uppercase opacity-75">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
        </div>
    );
};

const Mini = ({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) => (
    <div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className={`${strong ? "font-semibold" : "font-medium"} ${mono ? "font-mono" : ""} text-zinc-900 dark:text-zinc-100`}>{value}</p>
    </div>
);

const StatusBadge = ({ status }: { status: UpdateRequestItem["status"] }) => (
    <span className={`w-fit whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium capitalize ${status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" : status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"}`}>
        {status}
    </span>
);

const isGuestRequest = (request: UpdateRequestItem) => request.requested_changes?.request_type === "guest_access";
const requestTypeLabel = (request: UpdateRequestItem) => isGuestRequest(request) ? "Guest access" : "Profile update";
const residentName = (request: UpdateRequestItem) => request.resident ? [request.resident.first_name, request.resident.last_name].filter(Boolean).join(" ") : `User #${request.user_id}`;
const labelize = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
const formatMaybeDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "N/A";

export default UpdateRequestsPage;
