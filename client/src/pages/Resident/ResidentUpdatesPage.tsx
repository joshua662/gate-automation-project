import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import GateAccessService from "../../services/GateAccessService";
import type { UpdateRequestItem } from "../../interfaces/GateInterface";
import Spinner from "../../components/Spinner/Spinner";
import { useAuth } from "../../contexts/AuthContext";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatPlateInput } from "../../utils/plateOcr";

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

const ResidentUpdatesPage = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<UpdateRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [openRequest, setOpenRequest] = useState<number | null>(null);
    const [guestForm, setGuestForm] = useState<GuestForm>(blankGuestForm);

    const load = () => {
        setLoading(true);
        GateAccessService.myUpdateRequests(1)
            .then((res) => setRequests(res.data.requests.data ?? []))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const submitGuestAccess = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setMessage("");
        setError("");

        try {
            await GateAccessService.submitUpdateRequest({
                request_type: "guest_access",
                ...guestForm,
                guest_plate_number: guestForm.guest_plate_number.toUpperCase(),
                guest_age: guestForm.guest_age || undefined,
            });
            setGuestForm(blankGuestForm);
            setMessage("Guest access request submitted for admin review.");
            load();
        } catch (err: any) {
            const msg = err.response?.data?.message ?? "Failed to submit guest access request.";
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const guestRequests = requests.filter((request) => request.requested_changes?.request_type === "guest_access");
    const profileRequests = requests.filter((request) => request.requested_changes?.request_type !== "guest_access");

    return (
        <div className="flex h-full w-full flex-1 flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Request Guest Access</h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">Allow visitor vehicles to enter the subdivision</p>
            </div>

            {message && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                    {message}
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                </div>
            )}

            <form onSubmit={submitGuestAccess} className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 md:p-8">
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

                <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                    <p className="text-sm text-violet-900 dark:text-violet-200">
                        Your guest access request will be submitted for admin review. Once approved, the guest vehicle can pass through the gate on the selected access date.
                    </p>
                </div>

                <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700 sm:flex-row">
                    <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {submitting ? "Submitting..." : "Submit Guest Access Request"}
                    </button>
                </div>
            </form>

            <section>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Your Guest Access Requests</h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Track the status of submitted guest access requests</p>
                </div>

                {loading ? (
                    <Spinner size="md" />
                ) : guestRequests.length > 0 ? (
                    <div className="space-y-3">
                        {guestRequests.map((request) => (
                            <RequestCard key={request.update_request_id} request={request} onOpen={() => setOpenRequest(request.update_request_id)} />
                        ))}
                    </div>
                ) : (
                    <EmptyCard text="No guest access requests yet. Submit your first request above." />
                )}
            </section>

            <section>
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Profile Update Requests</h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Profile edits from My Profile appear here.</p>
                </div>
                {profileRequests.length > 0 ? (
                    <div className="space-y-3">
                        {profileRequests.map((request) => (
                            <RequestCard key={request.update_request_id} request={request} onOpen={() => setOpenRequest(request.update_request_id)} compact />
                        ))}
                    </div>
                ) : (
                    <EmptyCard text="No profile update requests yet." />
                )}
            </section>

            {openRequest && (
                <RequestModal request={requests.find((request) => request.update_request_id === openRequest)} onClose={() => setOpenRequest(null)} />
            )}
        </div>
    );
};

const SectionHeading = ({ title }: { title: string }) => (
    <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
    </div>
);

const ReadOnlyInfo = ({ label, value }: { label: string; value?: string }) => (
    <div>
        <p className="mb-1 text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">{label}</p>
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{value || "-"}</p>
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
        <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}{required ? " *" : ""}</span>
        {textarea ? (
            <textarea
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={3}
                required={required}
                placeholder={placeholder}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 transition focus:border-transparent focus:ring-2 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
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
                className={`w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 transition focus:border-transparent focus:ring-2 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 ${mono ? "font-mono uppercase" : ""}`}
            />
        )}
    </label>
);

const RequestCard = ({ request, onOpen, compact }: { request: UpdateRequestItem; onOpen: () => void; compact?: boolean }) => {
    const changes = request.requested_changes;
    const isGuest = changes.request_type === "guest_access";

    return (
        <button
            type="button"
            onClick={onOpen}
            className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:bg-zinc-800 ${isGuest ? "border-violet-200 hover:border-violet-400 dark:border-violet-700 dark:hover:border-violet-500" : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"}`}
        >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid flex-1 gap-4 text-sm md:grid-cols-4">
                    <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Request #{request.update_request_id}</p>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{isGuest ? changes.guest_name ?? "Guest" : "Profile Update"}</p>
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{isGuest ? "Vehicle Plate" : "Submitted"}</p>
                        <p className={isGuest ? "font-mono text-zinc-900 dark:text-zinc-100" : "text-zinc-900 dark:text-zinc-100"}>{isGuest ? changes.guest_plate_number ?? "N/A" : new Date(request.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{isGuest ? "Access Date" : "Fields"}</p>
                        <p className="text-zinc-900 dark:text-zinc-100">{isGuest ? formatMaybeDate(changes.access_date) : Object.keys(changes).length}</p>
                    </div>
                    {!compact && (
                        <div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Submitted</p>
                            <p className="text-zinc-900 dark:text-zinc-100">{new Date(request.created_at).toLocaleString()}</p>
                        </div>
                    )}
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(request.status)}`}>
                    {request.status}
                </span>
            </div>
        </button>
    );
};

const RequestModal = ({ request, onClose }: { request?: UpdateRequestItem; onClose: () => void }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(!!request);

    useEffect(() => {
        if (request) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [request]);

    if (!shouldRender || !request) return null;

    const entries = Object.entries(request.requested_changes).filter(([key]) => key !== "request_type");
    const isGuest = request.requested_changes.request_type === "guest_access";

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close modal"
                onClick={onClose}
                className={`fixed inset-0 bg-black/75 backdrop-blur-md ${
                    isAnimatingOut ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
                }`}
            />
            <div
                className={`relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-white/15 bg-[#1e1e24] p-6 shadow-2xl backdrop-blur-xl text-zinc-100 ${
                    isAnimatingOut ? "animate-modal-panel-out" : "animate-modal-panel-in"
                }`}
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 shrink-0">
                    <div>
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${
                                    isGuest
                                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                }`}
                            >
                                {isGuest ? "GUEST ACCESS" : "PROFILE UPDATE"}
                            </span>
                            <h3 className="text-xl font-bold text-white">Request #{request.update_request_id}</h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(request.status)}`}>
                                {request.status}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400">Submitted on {new Date(request.created_at).toLocaleString()}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
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
        </div>,
        document.body
    );
};

const EmptyCard = ({ text }: { text: string }) => (
    <div className="rounded-xl border border-zinc-200/50 bg-transparent p-8 text-center text-zinc-500 dark:border-white/5 dark:bg-transparent dark:text-zinc-400">{text}</div>
);

const statusClass = (status: UpdateRequestItem["status"]) => {
    if (status === "approved") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    if (status === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
};

const labelize = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
const formatMaybeDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "N/A";

export default ResidentUpdatesPage;
