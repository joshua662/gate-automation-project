import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import GateAccessService from "../../services/GateAccessService";
import GenderService from "../../services/GenderService";
import type { ResidentRow } from "../../interfaces/GateInterface";
import Spinner from "../../components/Spinner/Spinner";

type ResidentForm = {
    first_name: string;
    middle_name: string;
    last_name: string;
    gender: string;
    birth_date: string;
    email: string;
    username: string;
    password: string;
    password_confirmation: string;
    contact_number: string;
    address: string;
    plate_number: string;
    car_model: string;
    car_color: string;
};

const emptyForm = (): ResidentForm => ({
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "",
    birth_date: "",
    email: "",
    username: "",
    password: "",
    password_confirmation: "",
    contact_number: "",
    address: "",
    plate_number: "",
    car_model: "",
    car_color: "",
});

const ResidentsSkeleton = () => (
    <div className="animate-pulse space-y-4">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                        <Head>Name</Head>
                        <Head>Plate Number</Head>
                        <Head>Contact</Head>
                        <Head>Address</Head>
                        <Head>Car Info</Head>
                        <Head>Actions</Head>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i}>
                            <td className="px-6 py-4"><div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4">
                                <div className="flex gap-2">
                                    <div className="h-6 w-10 rounded bg-zinc-200 dark:bg-zinc-700" />
                                    <div className="h-6 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const ResidentsPage = () => {
    const [residents, setResidents] = useState<ResidentRow[]>([]);
    const [genders, setGenders] = useState<{ gender_id: number; gender: string }[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ResidentRow | null>(null);
    const [editing, setEditing] = useState<ResidentRow | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [message, setMessage] = useState("");

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadResidents = useCallback((pageNum: number, query: string, append = false) => {
        if (pageNum === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        GateAccessService.loadResidents(pageNum, query)
            .then((res) => {
                const fetchedData = res.data.residents.data ?? [];
                const lastPage = res.data.residents.last_page ?? 1;

                if (append) {
                    setResidents((prev) => [...prev, ...fetchedData]);
                } else {
                    setResidents(fetchedData);
                }

                setHasMore(pageNum < lastPage);
                setPage(pageNum);
            })
            .finally(() => {
                setLoading(false);
                setLoadingMore(false);
            });
    }, []);

    useEffect(() => {
        loadResidents(1, "");
        GenderService.loadGenders().then((res) => setGenders(res.data.genders ?? []));
    }, [loadResidents]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            loadResidents(1, search);
        }, 250);

        return () => window.clearTimeout(handle);
    }, [loadResidents, search]);

    const loadNextPage = () => {
        if (loading || loadingMore || !hasMore) return;
        loadResidents(page + 1, search, true);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
        if (isNearBottom && hasMore && !loadingMore && !loading) {
            loadNextPage();
        }
    };


    const openEdit = (resident: ResidentRow) => {
        setEditing(resident);
        setForm({
            first_name: resident.first_name ?? "",
            middle_name: resident.middle_name ?? "",
            last_name: resident.last_name ?? "",
            gender: String(resident.gender?.gender_id ?? ""),
            birth_date: resident.birth_date ?? "",
            email: resident.email ?? "",
            username: resident.username ?? "",
            password: "",
            password_confirmation: "",
            contact_number: resident.contact_number ?? "",
            address: resident.address ?? "",
            plate_number: resident.plate_number ?? "",
            car_model: resident.car_model ?? "",
            car_color: resident.car_color ?? "",
        });
        setModalOpen(true);
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        const payload: Record<string, string | undefined> = { ...form, gender: form.gender };

        if (editing && !payload.password?.trim()) {
            delete payload.password;
            delete payload.password_confirmation;
        }

        if (editing) {
            await GateAccessService.updateResident(editing.user_id, payload);
            setMessage("Resident updated.");
        } else {
            await GateAccessService.storeResident(payload);
            setMessage("Resident added.");
        }

        setModalOpen(false);
        setLoading(true);
        loadResidents(1, search);
    };

    const deleteResident = async () => {
        if (!deleteTarget) return;

        await GateAccessService.destroyResident(deleteTarget.user_id);
        setMessage("Resident deleted.");
        setDeleteTarget(null);
        setLoading(true);
        loadResidents(1, search);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Residents Management</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage resident profiles and information</p>
                </div>
            </div>

            {message && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">{message}</div>
            )}

            <div className="space-y-4">
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, plate number, or contact..."
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 transition focus:border-transparent focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />

                {loading ? <ResidentsSkeleton /> : (
                    <div className="space-y-4">
                        <div 
                            onScroll={handleScroll}
                            className="max-h-[420px] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        >
                            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700 relative">
                                <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
                                    <tr>
                                        <Head>Name</Head>
                                        <Head>Plate Number</Head>
                                        <Head>Contact</Head>
                                        <Head>Address</Head>
                                        <Head>Car Info</Head>
                                        <Head>Actions</Head>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                                    {residents.length > 0 ? residents.map((resident) => (
                                        <tr key={resident.user_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{fullName(resident)}</td>
                                            <td className="whitespace-nowrap px-6 py-4 font-mono text-zinc-900 dark:text-zinc-100">{resident.plate_number || "-"}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{resident.contact_number || "-"}</td>
                                            <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{limitText(resident.address || "-", 30)}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{resident.car_model || resident.car_color ? `${resident.car_model || "N/A"} - ${resident.car_color || "N/A"}` : "N/A"}</td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => openEdit(resident)} className="rounded px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/50">Edit</button>
                                                    <button type="button" onClick={() => setDeleteTarget(resident)} className="rounded px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No residents found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {hasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    type="button"
                                    onClick={loadNextPage}
                                    disabled={loadingMore}
                                    className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
                                >
                                    {loadingMore ? (
                                        <div className="flex items-center gap-2">
                                            <Spinner size="sm" />
                                            <span>Loading more residents...</span>
                                        </div>
                                    ) : (
                                        "Scroll down or click here to load more"
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {modalOpen && (
                <ResidentModal
                    editing={editing}
                    form={form}
                    genders={genders}
                    setForm={setForm}
                    onClose={() => setModalOpen(false)}
                    onSubmit={handleSave}
                />
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center px-4 py-10 text-center">
                        <button type="button" aria-label="Close delete modal" onClick={() => setDeleteTarget(null)} className="fixed inset-0 bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80" />
                        <div className="relative w-full max-w-md rounded-2xl bg-white px-8 py-10 shadow-2xl dark:bg-zinc-800">
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                <TrashIcon />
                            </div>
                            <h3 className="mb-8 text-xl font-medium text-zinc-900 dark:text-zinc-100">
                                Are you sure you want to delete <strong>{fullName(deleteTarget)}</strong>?
                            </h3>
                            <div className="space-y-4">
                                <button type="button" onClick={deleteResident} className="w-full rounded-lg bg-red-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-red-700">Yes, Delete</button>
                                <button type="button" onClick={() => setDeleteTarget(null)} className="w-full text-sm font-medium text-zinc-900 transition hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300">Keep Resident</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ResidentModal = ({
    editing,
    form,
    genders,
    setForm,
    onClose,
    onSubmit,
}: {
    editing: ResidentRow | null;
    form: ResidentForm;
    genders: { gender_id: number; gender: string }[];
    setForm: (form: ResidentForm) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent) => void;
}) => (
    <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
            <button type="button" aria-label="Close modal" onClick={onClose} className="fixed inset-0 bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80" />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-800">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${editing ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"}`}>
                            {editing ? <EditIcon /> : <PlusIcon />}
                        </div>
                        <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{editing ? "Edit Resident" : "Add New Resident"}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="text-2xl leading-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">x</button>
                </div>

                <form onSubmit={onSubmit} className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field label="First Name" value={form.first_name} onChange={(value) => setForm({ ...form, first_name: value })} required />
                        <Field label="Middle Name" value={form.middle_name} onChange={(value) => setForm({ ...form, middle_name: value })} />
                        <Field label="Last Name" value={form.last_name} onChange={(value) => setForm({ ...form, last_name: value })} required />
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Gender *</span>
                            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} required className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100">
                                <option value="">Select</option>
                                {genders.map((gender) => <option key={gender.gender_id} value={gender.gender_id}>{gender.gender}</option>)}
                            </select>
                        </label>
                        <Field label="Birthdate" type="date" value={form.birth_date} onChange={(value) => setForm({ ...form, birth_date: value })} required />
                        <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
                        <Field label="Portal Username" value={form.username} onChange={(value) => setForm({ ...form, username: value })} required />
                        <Field label="Contact Number" value={form.contact_number} onChange={(value) => setForm({ ...form, contact_number: value.replace(/\D/g, "").slice(0, 11) })} required maxLength={11} inputMode="numeric" pattern="[0-9]*" />
                        <Field label="Plate Number" value={form.plate_number} onChange={(value) => setForm({ ...form, plate_number: value.toUpperCase() })} required mono />
                        <Field label="Car Model" value={form.car_model} onChange={(value) => setForm({ ...form, car_model: value })} required />
                        <Field label="Car Color" value={form.car_color} onChange={(value) => setForm({ ...form, car_color: value })} required />
                    </div>

                    <Field label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} required textarea />

                    {!editing ? (
                        <div className="grid gap-5 md:grid-cols-2">
                            <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} required />
                            <Field label="Confirm Password" type="password" value={form.password_confirmation} onChange={(value) => setForm({ ...form, password_confirmation: value })} required />
                        </div>
                    ) : (
                        <div className="grid gap-5 md:grid-cols-2">
                            <Field label="Password (leave blank to keep current)" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
                            <Field label="Confirm New Password" type="password" value={form.password_confirmation} onChange={(value) => setForm({ ...form, password_confirmation: value })} />
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-medium text-zinc-900 transition hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300">Cancel</button>
                        <button type="submit" className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">{editing ? "Update Resident" : "Create Resident"}</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
);

const Field = ({ label, value, onChange, type = "text", required, textarea, mono, maxLength, inputMode, pattern }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; textarea?: boolean; mono?: boolean; maxLength?: number; inputMode?: "search" | "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "none"; pattern?: string }) => (
    <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}{required ? " *" : ""}</span>
        {textarea ? (
            <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} required={required} className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100" />
        ) : (
            <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={maxLength} inputMode={inputMode} pattern={pattern} className={`w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 ${mono ? "font-mono uppercase" : ""}`} />
        )}
    </label>
);

const Head = ({ children }: { children: string }) => (
    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{children}</th>
);

const fullName = (resident: ResidentRow) => [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean).join(" ");
const limitText = (value: string, limit: number) => value.length > limit ? `${value.slice(0, limit)}...` : value;

const IconSvg = ({ children }: { children: ReactNode }) => <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{children}</svg>;
const EditIcon = () => <IconSvg><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></IconSvg>;
const PlusIcon = () => <IconSvg><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></IconSvg>;
const TrashIcon = () => <IconSvg><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7 18 19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7m5 4v6m4-6v6M4 7h16m-5 0V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3" /></IconSvg>;

export default ResidentsPage;
