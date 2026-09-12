import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import GateAccessService from "../../services/GateAccessService";
import GenderService from "../../services/GenderService";
import { useAuth } from "../../contexts/AuthContext";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import loginBackdrop from "../../assets/img/subdivision-gate-background.png";
import { formatPlateInput } from "../../utils/plateOcr";

const resolveProfilePictureUrl = (path?: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
        return path;
    }
    const cleanPath = path.replace(/^\/+/, "").replace(/^public\//, "");
    if (cleanPath.startsWith("storage/")) {
        return `http://127.0.0.1:8000/${cleanPath}`;
    }
    return `http://127.0.0.1:8000/storage/${cleanPath}`;
};

type ProfileForm = {
    first_name: string;
    middle_name: string;
    last_name: string;
    gender: string;
    birth_date: string;
    email: string;
    username: string;
    contact_number: string;
    address: string;
    plate_number: string;
    car_model: string;
    car_color: string;
};

const ResidentProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const avatarContainerRef = useRef<HTMLDivElement>(null);
    const [uploading, setUploading] = useState(false);
    const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
    const { shouldRender: showAvatarMenu, isAnimatingOut: isAvatarMenuOut } = useModalAnimation(avatarMenuOpen, 180);

    useEffect(() => {
        if (!avatarMenuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (avatarContainerRef.current && !avatarContainerRef.current.contains(event.target as Node)) {
                setAvatarMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [avatarMenuOpen]);
    const [genders, setGenders] = useState<{ gender_id: number; gender: string }[]>([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const displayAvatarUrl = useMemo(() => {
        if (previewAvatar) return previewAvatar;
        return resolveProfilePictureUrl(user?.user?.profile_picture);
    }, [previewAvatar, user?.user?.profile_picture]);

    const handleAvatarClick = () => {
        if (uploading) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setMessage("Please select a valid image file (JPG, PNG, WebP).");
            return;
        }

        try {
            setUploading(true);
            setMessage("");
            const objectUrl = URL.createObjectURL(file);
            setPreviewAvatar(objectUrl);

            const formData = new FormData();
            formData.append("profile_picture", file);

            const res = await GateAccessService.updateProfile(formData);
            if (res.data?.user) {
                await refreshUser();
                setMessage("Profile picture updated successfully.");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch (err: unknown) {
            console.error("Failed to upload profile picture:", err);
            setMessage("Failed to upload profile picture. Please try again.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleRemovePhoto = async () => {
        if (uploading) return;
        try {
            setUploading(true);
            setMessage("");
            const formData = new FormData();
            formData.append("remove_profile_picture", "1");

            const res = await GateAccessService.updateProfile(formData);
            if (res.data?.user) {
                setPreviewAvatar(null);
                await refreshUser();
                setMessage("Profile picture removed successfully.");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch (err: unknown) {
            console.error("Failed to remove profile picture:", err);
            setMessage("Failed to remove profile picture. Please try again.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    const [form, setForm] = useState<ProfileForm>({
        first_name: "",
        middle_name: "",
        last_name: "",
        gender: "",
        birth_date: "",
        email: "",
        username: "",
        contact_number: "",
        address: "",
        plate_number: "",
        car_model: "",
        car_color: "",
    });

    useEffect(() => {
        GenderService.loadGenders().then((r) => setGenders(r.data.genders ?? []));
    }, []);

    useEffect(() => {
        const u = user?.user;

        if (!u) return;

        setForm({
            first_name: u.first_name ?? "",
            middle_name: u.middle_name ?? "",
            last_name: u.last_name ?? "",
            gender: String(u.gender?.gender_id ?? ""),
            birth_date: u.birth_date ?? "",
            email: u.email ?? "",
            username: u.username ?? "",
            contact_number: u.contact_number ?? "",
            address: u.address ?? "",
            plate_number: u.plate_number ?? "",
            car_model: u.car_model ?? "",
            car_color: u.car_color ?? "",
        });
    }, [user]);

    const submitRequest = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setMessage("");

        try {
            await GateAccessService.submitUpdateRequest({
                first_name: form.first_name,
                middle_name: form.middle_name,
                last_name: form.last_name,
                gender: form.gender,
                birth_date: form.birth_date,
                contact_number: form.contact_number,
                address: form.address,
                plate_number: form.plate_number,
                car_model: form.car_model,
                car_color: form.car_color,
            });
            setMessage("Profile changes submitted for admin review.");
            setShowEditModal(false);
        } finally {
            setSubmitting(false);
        }
    };

    const displayName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ") || "Resident";
    const initials = `${form.first_name.charAt(0)}${form.last_name.charAt(0)}`.toUpperCase() || "U";

    return (
        <div className="flex h-full w-full flex-1 flex-col gap-6">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
            />

            {message && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">{message}</p>
                    <p className="mt-0.5 text-xs text-green-700 dark:text-green-300">The admin will review and approve your changes shortly.</p>
                </div>
            )}

            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">My Profile</h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">View and manage your personal and vehicle information</p>
            </div>

            <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-700 p-8 shadow-lg dark:from-blue-800 dark:to-cyan-900">
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    {/* Overlapping Avatar + Click Action Buttons on Right */}
                    <div ref={avatarContainerRef} className="relative flex shrink-0 items-center">
                        {/* Circle Avatar Container */}
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setAvatarMenuOpen((prev) => !prev);
                            }}
                            className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-white/20 text-3xl font-bold text-white shadow-lg transition hover:border-white hover:ring-4 hover:ring-white/30"
                        >
                            {displayAvatarUrl ? (
                                <img src={displayAvatarUrl} alt={displayName} className="h-full w-full object-cover" />
                            ) : (
                                initials
                            )}
                            {uploading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white">
                                    <svg className="h-6 w-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Floating Action Menu on the RIGHT SIDE of Profile Picture - Shown ONLY on click with smooth enter/exit animation */}
                        {showAvatarMenu && !uploading && (
                            <div 
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute left-[calc(100%+14px)] top-1/2 z-30 flex flex-col gap-1.5 rounded-2xl bg-zinc-900/95 p-2 backdrop-blur-xl border border-white/20 shadow-2xl whitespace-nowrap origin-left ${
                                    isAvatarMenuOut ? "animate-popover-out" : "animate-popover-in"
                                }`}
                            >
                                {/* Left Arrow pointing to profile picture */}
                                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rotate-45 bg-zinc-900 border-b border-l border-white/20" />

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setAvatarMenuOpen(false);
                                        handleAvatarClick();
                                    }}
                                    className="relative z-10 w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition border border-blue-400/30 active:scale-95 cursor-pointer"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Upload Photo</span>
                                </button>

                                {displayAvatarUrl && (
                                    <button
                                        type="button"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            setAvatarMenuOpen(false);
                                            await handleRemovePhoto();
                                        }}
                                        className="relative z-10 w-full flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition border border-red-400/30 active:scale-95 cursor-pointer"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Remove Photo</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="break-words text-3xl font-bold text-white">{displayName}</h2>
                        <p className="text-lg text-blue-100">Resident Member</p>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-green-300" />
                            <span className="text-sm text-white/90">Active Account</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-lg transition hover:bg-zinc-50"
                    >
                        Edit Profile
                    </button>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-stretch">
                <section className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    <div>
                        <SectionTitle title="Personal Information" tone="blue" />
                        <div className="grid gap-4 md:grid-cols-2">
                            <InfoTile label="First Name" value={form.first_name} />
                            <InfoTile label="Last Name" value={form.last_name} />
                            <InfoTile label="Age" value={user?.user?.age} />
                            <InfoTile label="Contact Number" value={form.contact_number} />
                            <InfoTile label="Address" value={form.address} wide />
                        </div>

                        <div className="my-8 border-t border-zinc-200 pt-8 dark:border-zinc-700">
                            <SectionTitle title="Vehicle Information" tone="violet" />
                            <div className="grid gap-4 md:grid-cols-2">
                                <InfoTile label="Plate Number" value={form.plate_number} highlight />
                                <InfoTile label="Car Model" value={form.car_model} />
                                <InfoTile label="Car Color" value={form.car_color} />
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    <div>
                        <SectionTitle title="Account Information" tone="green" />
                        <div className="space-y-4">
                            <InfoTile label="Email" value={form.email} />
                            <InfoTile label="Username" value={form.username} />
                            <InfoTile label="Account ID" value={user?.user?.user_id ? `#${user.user.user_id}` : "-"} />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
                    >
                        Edit Information
                    </button>
                </aside>
            </div>

            {showEditModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center px-4 py-10">
                        <button
                            type="button"
                            aria-label="Close modal"
                            onClick={() => setShowEditModal(false)}
                            className="fixed inset-0 bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80"
                        />
                        <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-800">
                            <div className="mb-6 flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Edit Profile Information</h3>
                                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Changes are submitted for admin approval.</p>
                                </div>
                                <button type="button" onClick={() => setShowEditModal(false)} className="text-2xl leading-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                    x
                                </button>
                            </div>

                            <form onSubmit={submitRequest} className="space-y-5">
                                <div className="grid gap-5 md:grid-cols-2">
                                    <Field label="First Name" name="first_name" value={form.first_name} onChange={(value) => setForm({ ...form, first_name: value })} required />
                                    <Field label="Middle Name" name="middle_name" value={form.middle_name} onChange={(value) => setForm({ ...form, middle_name: value })} />
                                    <Field label="Last Name" name="last_name" value={form.last_name} onChange={(value) => setForm({ ...form, last_name: value })} required />
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Gender</span>
                                        <select
                                            value={form.gender}
                                            onChange={(event) => setForm({ ...form, gender: event.target.value })}
                                            required
                                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                                        >
                                            <option value="">Select gender</option>
                                            {genders.map((gender) => (
                                                <option key={gender.gender_id} value={gender.gender_id}>{gender.gender}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <Field label="Birth Date" name="birth_date" type="date" value={form.birth_date} onChange={(value) => setForm({ ...form, birth_date: value })} required />
                                    <Field label="Email" name="email" type="email" value={form.email} disabled onChange={() => undefined} />
                                    <Field label="Contact Number" name="contact_number" value={form.contact_number} onChange={(value) => setForm({ ...form, contact_number: value.replace(/\D/g, "").slice(0, 11) })} required maxLength={11} inputMode="numeric" pattern="[0-9]*" />
                                    <Field label="Plate Number" name="plate_number" value={form.plate_number} onChange={(value) => setForm({ ...form, plate_number: formatPlateInput(value) })} required placeholder="e.g. ABC 1234" mono />
                                    <Field label="Car Model" name="car_model" value={form.car_model} onChange={(value) => setForm({ ...form, car_model: value })} required />
                                    <Field label="Car Color" name="car_color" value={form.car_color} onChange={(value) => setForm({ ...form, car_color: value })} required />
                                </div>
                                <Field label="Address" name="address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} required textarea />

                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                                    <p className="text-sm text-blue-900 dark:text-blue-200">
                                        Your changes will be submitted for admin review and approval. You will receive a notification once processed.
                                    </p>
                                </div>

                                <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700 sm:flex-row sm:justify-end">
                                    <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 text-sm font-medium text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={submitting} className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                        {submitting ? "Submitting..." : "Submit Changes for Review"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

const SectionTitle = ({ title, tone }: { title: string; tone: "blue" | "violet" | "green" }) => {
    const tones = {
        blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
        violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
        green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    };

    return (
        <div className="mb-6 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${tones[tone]}`} />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
        </div>
    );
};

const InfoTile = ({ label, value, wide, highlight, compact }: { label: string; value?: ReactNode; wide?: boolean; highlight?: boolean; compact?: boolean }) => (
    <div className={`${wide ? "md:col-span-2" : ""} ${highlight ? "border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20" : "border border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50"} rounded-xl p-4`}>
        <p className={`mb-2 text-xs font-semibold uppercase ${highlight ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"}`}>{label}</p>
        <p className={`${compact ? "text-sm" : highlight ? "font-mono text-2xl" : "text-lg"} break-words font-semibold text-zinc-900 dark:text-zinc-100`}>{value || "-"}</p>
    </div>
);

const Field = ({
    label,
    name,
    value,
    onChange,
    type = "text",
    required,
    disabled,
    textarea,
    mono,
}: {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
    disabled?: boolean;
    textarea?: boolean;
    mono?: boolean;
    maxLength?: number;
    inputMode?: "search" | "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "none";
    pattern?: string;
    placeholder?: string;
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
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
        ) : (
            <input
                type={type}
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required={required}
                disabled={disabled}
                maxLength={maxLength}
                inputMode={inputMode}
                pattern={pattern}
                placeholder={placeholder}
                className={`w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:disabled:bg-zinc-900 ${mono ? "font-mono uppercase" : ""}`}
            />
        )}
        {disabled && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Email cannot be changed here.</p>}
    </label>
);

export default ResidentProfilePage;
