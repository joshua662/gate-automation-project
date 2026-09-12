import { useCallback, useEffect, useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import RegistrationSuccessModal from "../../../components/RegistrationSuccessModal/RegistrationSuccessModal";
import Spinner from "../../../components/Spinner/Spinner";
import { useModalAnimation } from "../../../hooks/useModalAnimation";
import type { AdmissionRegistrationForm } from "./authTypes";
import puebloDePanayLogo from "../../../assets/img/pdp-logo-invert.png";
import loginBackdrop from "../../../assets/img/subdivision-gate-background.png";
import { CustomDatePicker } from "./CustomDatePicker";
import { formatPlateInput } from "../../../utils/plateOcr";

type TrailingIconName = "user" | "calendar" | "email" | "phone" | "lock" | "plate";

const FieldTrailingIcon = ({ kind }: { kind?: TrailingIconName }) => {
    if (!kind) return null;
    const c = "mb-1 h-[18px] w-[18px] shrink-0 text-violet-300/60";
    switch (kind) {
        case "user":
            return (
                <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "calendar":
            return (
                <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 3v4M16 3v4M3 11h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "email":
            return (
                <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M4 7h16v10H4V7Zm0 0 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "phone":
            return (
                <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M8 3h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3c0 1-1 2-2 2h-1C9.5 19 4 13.5 4 6c0-1 1-2 2-2h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "lock":
            return (
                <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        case "plate":
            return (
                <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M7 11h10M7 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

interface UnderlineFieldProps {
    label: string;
    name: string;
    type?: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    error?: string;
    trailingIcon?: TrailingIconName;
    leadingSlot?: ReactNode;
    maxLength?: number;
    inputMode?: "search" | "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "none";
    pattern?: string;
}

const UnderlineField = ({
    label, name, type = "text", value, onChange, placeholder, required, error, trailingIcon, leadingSlot, maxLength, inputMode, pattern,
}: UnderlineFieldProps) => {
    const borderTone = error
        ? "border-red-400"
        : "border-white/20 focus-within:border-violet-400";
    return (
        <div className="mb-7">
            <label htmlFor={name} className="mb-2 block text-[13.5px] font-medium text-violet-200/80">
                {required && <span className="mr-1 text-red-400">*</span>}
                {label}
            </label>
            <div className={`flex items-end gap-2 border-b-2 pb-1 transition-colors ${borderTone}`}>
                {leadingSlot && (
                    <span className="mb-2 shrink-0 select-none text-base leading-none">{leadingSlot}</span>
                )}
                <input
                    id={name} name={name} type={type} value={value} onChange={onChange}
                    placeholder={placeholder} required={required} maxLength={maxLength}
                    inputMode={inputMode} pattern={pattern}
                    className="min-w-0 flex-1 border-0 bg-transparent py-3 text-[14.5px] text-white outline-none placeholder:text-white/30"
                />
                <FieldTrailingIcon kind={trailingIcon} />
            </div>
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>
    );
};

// ── Main Modal ────────────────────────────────────────────────────────────────

interface RegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    form: AdmissionRegistrationForm;
    setForm: Dispatch<SetStateAction<AdmissionRegistrationForm>>;
    genders: { gender_id: number; gender: string }[];
    fieldErrors: Record<string, string[]>;
    loading: boolean;
    onRegister: () => void | Promise<void>;
    registrationSuccess?: boolean;
}

const SubmitAdmissionButton = ({ loading }: { loading: boolean }) => (
    <button
        type="submit"
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full bg-violet-600 py-4 text-[13.5px] font-semibold uppercase tracking-widest text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
        {loading ? (
            <><Spinner size="xs" />Submitting...</>
        ) : (
            <>
                Submit
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M14 4h6v6M10 14 20 4M8 20H6a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </>
        )}
    </button>
);

const ConfirmationDialog = ({
    isOpen,
    email,
    loading,
    onCancel,
    onConfirm,
}: {
    isOpen: boolean;
    email: string;
    loading: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);
    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-opacity ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'opacity-0' : 'animate-modal-backdrop-in'}`} onClick={onCancel} />
            <div className={`relative w-full max-w-md rounded-3xl border border-white/10 bg-[#1e1e24] p-10 text-center text-zinc-100 shadow-2xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}>
                
                {/* Envelope with Checkmark Icon */}
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center relative">
                    <svg className="h-12 w-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 border-2 border-[#1e1e24]">
                        <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>

                <h3 className="mb-4 text-2xl font-bold text-white">Confirm registration!</h3>
                <p className="mb-8 text-[14.5px] leading-relaxed text-zinc-400">
                    Create this account and send the generated username and password to <span className="font-semibold text-zinc-200">{email}</span>?
                </p>
                
                <div className="flex flex-col items-center gap-4">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading && <Spinner size="xs" />}
                        Confirm registration
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="text-[14px] font-medium text-zinc-400 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-1.5"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Review details
                    </button>
                </div>
            </div>
        </div>
    );
};

const ANIM_DURATION = 300;

const RegistrationModal = ({
    isOpen, onClose,
    form, setForm,
    genders, fieldErrors, loading, onRegister,
    registrationSuccess = false,
}: RegistrationModalProps) => {
    const [captchaA, setCaptchaA] = useState(0);
    const [captchaB, setCaptchaB] = useState(0);
    const [captchaAnswer, setCaptchaAnswer] = useState("");
    const [captchaError, setCaptchaError] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    const [confirmationOpen, setConfirmationOpen] = useState(false);

    const [isMounted, setIsMounted] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsAnimatingOut(false);
            setIsMounted(true);
        } else if (isMounted) {
            setIsAnimatingOut(true);
            closeTimerRef.current = setTimeout(() => {
                setIsMounted(false);
                setIsAnimatingOut(false);
            }, ANIM_DURATION);
        }
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const refreshCaptcha = useCallback(() => {
        setCaptchaA(Math.floor(Math.random() * 90) + 10);
        setCaptchaB(Math.floor(Math.random() * 9) + 1);
        setCaptchaAnswer("");
        setCaptchaError("");
    }, []);

    useEffect(() => {
        if (registrationSuccess) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setToastVisible(true);
            refreshCaptcha();
        }
    }, [registrationSuccess, refreshCaptcha]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isOpen) refreshCaptcha();
    }, [isOpen, refreshCaptcha]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const expected = captchaA + captchaB;
        const got = parseInt(captchaAnswer.trim(), 10);
        if (Number.isNaN(got) || got !== expected) {
            setCaptchaError("Please solve the verification correctly.");
            return;
        }
        setCaptchaError("");
        setConfirmationOpen(true);
    };

    const handleConfirmRegistration = () => {
        setConfirmationOpen(false);
        void onRegister();
    };

    const err = (key: string) => fieldErrors[key]?.[0];

    if (!isMounted) return null;

    const EASING = "cubic-bezier(0.34,1.56,0.64,1)";
    const backdropAnim = isAnimatingOut
        ? `reg-backdrop-out ${ANIM_DURATION}ms ease both`
        : `reg-backdrop-in  ${ANIM_DURATION}ms ease both`;
    const modalAnim = isAnimatingOut
        ? `reg-modal-out ${ANIM_DURATION}ms ${EASING} both`
        : `reg-modal-in  ${ANIM_DURATION}ms ${EASING} both`;

    return createPortal(
        <>
            <RegistrationSuccessModal
                isVisible={toastVisible}
                onClose={() => setToastVisible(false)}
            />
            <ConfirmationDialog
                isOpen={confirmationOpen}
                email={form.email.trim() || "the registered email address"}
                loading={loading}
                onCancel={() => setConfirmationOpen(false)}
                onConfirm={handleConfirmRegistration}
            />

            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                style={{ animation: backdropAnim }}
            >
                {/* Background image */}
                <img
                    src={loginBackdrop}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover scale-105"
                    aria-hidden
                />

                {/* Twilight indigo / purple grading overlay */}
                <div
                    className="absolute inset-0 bg-gradient-to-b from-indigo-950/50 via-violet-950/35 to-purple-950/45"
                    aria-hidden
                />

                {/* Soft star specks */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `
              radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.75), transparent),
              radial-gradient(1px 1px at 70% 18%, rgba(255,255,255,0.55), transparent),
              radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.5), transparent),
              radial-gradient(1px 1px at 88% 52%, rgba(255,255,255,0.65), transparent),
              radial-gradient(1px 1px at 12% 55%, rgba(255,255,255,0.45), transparent)
            `,
                    }}
                    aria-hidden
                />

                <style>{`
                    @keyframes reg-backdrop-in  { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes reg-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
                    @keyframes reg-modal-in {
                        from { opacity: 0; transform: translateY(32px) scale(0.96); }
                        to   { opacity: 1; transform: translateY(0)    scale(1);    }
                    }
                    @keyframes reg-modal-out {
                        from { opacity: 1; transform: translateY(0)    scale(1);    }
                        to   { opacity: 0; transform: translateY(32px) scale(0.96); }
                    }
                    @keyframes reg-header-in {
                        from { opacity: 0; transform: translateY(-10px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes reg-bar-in {
                        from { width: 0; }
                        to   { width: 38%; }
                    }
                    @keyframes reg-field-in {
                        from { opacity: 0; transform: translateY(12px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes reg-logo-float {
                        0%, 100% { transform: translateY(0px);  }
                        50%      { transform: translateY(-8px); }
                    }
                    @keyframes reg-shimmer {
                        0%   { background-position: -200% center; }
                        100% { background-position:  200% center; }
                    }
                    .reg-dark-form input[type="date"]::-webkit-calendar-picker-indicator {
                        filter: invert(1) opacity(0.4);
                    }
                    .reg-dark-form input[type="date"]::-webkit-calendar-picker-indicator:hover {
                        filter: invert(1) opacity(0.8);
                    }
                `}</style>

                {/* ── Modal card ── */}
                <div
                    className="relative flex w-full max-w-7xl max-h-[95vh] overflow-hidden rounded-[28px]"
                    style={{
                        animation: modalAnim,
                        background: "linear-gradient(135deg, rgba(20,16,48,0.7) 0%, rgba(14,12,36,0.8) 100%)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        boxShadow: "0 32px 64px rgba(0,0,0,0.55)",
                        backdropFilter: "blur(20px)",
                    }}
                >
                    {/* ══ LEFT PANEL — Branding ══ */}
                    <div
                        className="hidden md:flex flex-col items-center justify-between w-[340px] shrink-0 px-10 py-12 relative overflow-hidden"
                        style={{ background: "linear-gradient(160deg, #0d2e5c 0%, #1e4d8c 45%, #2a6ab5 100%)" }}
                    >
                        <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full opacity-10"
                            style={{ background: "radial-gradient(circle, #7eb8f7, transparent 70%)" }} />
                        <div className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full opacity-10"
                            style={{ background: "radial-gradient(circle, #a8d4ff, transparent 70%)" }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-5"
                            style={{ background: "radial-gradient(circle, #ffffff, transparent 70%)" }} />

                        <div />

                        <div className="flex flex-col items-center gap-7 z-10">
                            <div style={{ animation: "reg-logo-float 4s ease-in-out infinite" }}>
                                <img
                                    src={puebloDePanayLogo}
                                    alt="Pueblo de Panay Township"
                                    className="w-[260px] h-auto drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                                />
                            </div>
                            <div className="w-14 h-[2px] rounded-full bg-white/30" />
                            <div className="text-center">
                                <p className="text-white/60 text-[12px] uppercase tracking-[0.2em] font-medium">
                                    Resident Portal
                                </p>
                                <p className="mt-2.5 text-white/80 text-[14px] leading-relaxed text-center">
                                    Your gateway to a smarter, more connected community.
                                </p>
                            </div>
                        </div>

                        <div
                            className="z-10 rounded-full px-5 py-2.5 text-[11px] font-semibold tracking-widest uppercase text-white/70 border border-white/20"
                            style={{
                                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                                backgroundSize: "200% auto",
                                animation: "reg-shimmer 3s linear infinite",
                            }}
                        >
                            Life. Work. Balance.
                        </div>
                    </div>

                    {/* ══ RIGHT PANEL — Form ══ */}
                    <div
                        className="relative flex-1 overflow-y-auto reg-dark-form"
                        style={{
                            scrollbarColor: "rgba(139,92,246,0.3) transparent",
                            background: "linear-gradient(160deg, rgba(20,16,44,0.6) 0%, rgba(14,12,36,0.7) 100%)",
                            borderLeft: "1px solid rgba(139, 92, 246, 0.2)",
                        }}
                    >
                        <div className="relative z-10">
                            {/* Close button */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#1a1638] text-white/50 shadow-sm transition hover:border-white/30 hover:bg-[#252046] hover:text-white"
                                style={{ transition: "transform 0.2s ease, color 0.15s, border-color 0.15s, background 0.15s" }}
                                aria-label="Close"
                                onMouseEnter={(e) => (e.currentTarget.style.transform = "rotate(90deg)")}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = "rotate(0deg)")}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>

                            {/* Header */}
                            <div
                                className="border-b border-white/10 px-12 pb-7 pt-11 md:px-14 md:pt-12"
                                style={{ animation: isAnimatingOut ? "none" : "reg-header-in 0.35s ease 0.15s both" }}
                            >
                                <div className="mb-4 flex items-center gap-3 md:hidden">
                                    <img src={puebloDePanayLogo} alt="Pueblo de Panay Township" className="h-14 w-auto" />
                                </div>
                                <h2 className="text-[30px] font-light tracking-tight text-white">
                                    Admission Registration
                                </h2>
                                <div
                                    className="mt-3.5 h-[3px] max-w-[280px] rounded-sm"
                                    style={{
                                        background: "linear-gradient(90deg, #a78bfa, #7c3aed)",
                                        animation: isAnimatingOut ? "none" : "reg-bar-in 0.5s cubic-bezier(0.4,0,0.2,1) 0.35s both",
                                    }}
                                />
                            </div>

                            {/* Form */}
                            <form
                                onSubmit={handleSubmit}
                                className="px-12 py-10 md:px-14"
                                style={{ animation: isAnimatingOut ? "none" : "reg-field-in 0.4s ease 0.2s both" }}
                            >
                                <div className="grid gap-x-16 gap-y-0 md:grid-cols-2">
                                    <UnderlineField
                                        label="First Name" name="adm_fn" placeholder="e.g. Juan"
                                        value={form.first_name}
                                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                        required error={err("first_name")} trailingIcon="user"
                                    />
                                    <UnderlineField
                                        label="Last Name" name="adm_ln" placeholder="e.g. Santos"
                                        value={form.last_name}
                                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                        required error={err("last_name")} trailingIcon="user"
                                    />
                                    <UnderlineField
                                        label="Middle Name" name="adm_mn" placeholder="Optional"
                                        value={form.middle_name}
                                        onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                                        trailingIcon="user"
                                    />
                                    <CustomDatePicker
                                        label="Date of Birth (DD/MM/YYYY)" name="adm_dob"
                                        value={form.birth_date}
                                        onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                                        required error={err("birth_date")}
                                    />
                                    <UnderlineField
                                        label="Email" name="adm_email" type="email" placeholder="you@gmail.com"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        required error={err("email")} trailingIcon="email"
                                    />
                                    <div className="mb-7">
                                        <span className="mb-2 block text-[13.5px] font-medium text-violet-200/80">
                                            <span className="mr-1 text-red-400">*</span>Gender
                                        </span>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                                            {genders.map((g) => (
                                                <label key={g.gender_id} className="flex cursor-pointer items-center gap-2 text-[14.5px] text-violet-100/90 transition-colors hover:text-white">
                                                    <input
                                                        type="radio" name="adm_gender"
                                                        checked={form.gender === String(g.gender_id)}
                                                        onChange={() => setForm({ ...form, gender: String(g.gender_id) })}
                                                        className="accent-violet-400"
                                                    />
                                                    {g.gender}
                                                </label>
                                            ))}
                                        </div>
                                        {err("gender") && <p className="mt-1.5 text-xs text-red-400">{err("gender")}</p>}
                                    </div>
                                </div>

                                <div className="mb-7">
                                    <span className="mb-2 block text-[13.5px] font-medium text-violet-200/80">
                                        <span className="mr-1 text-red-400">*</span>Role
                                    </span>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                                        {["Security Guard", "Resident"].map((r) => (
                                            <label key={r} className="flex cursor-pointer items-center gap-2 text-[14.5px] text-violet-100/90 transition-colors hover:text-white">
                                                <input
                                                    type="radio" name="adm_role"
                                                    checked={form.role === r}
                                                    onChange={() => setForm({ ...form, role: r })}
                                                    className="accent-violet-400"
                                                />
                                                {r}
                                            </label>
                                        ))}
                                    </div>
                                    {err("role") && <p className="mt-1.5 text-xs text-red-400">{err("role")}</p>}
                                </div>

                                <div
                                    className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                        form.role === "Resident"
                                            ? "grid-rows-[1fr] opacity-100 translate-y-0 scale-100 mb-4"
                                            : "grid-rows-[0fr] opacity-0 -translate-y-2 scale-[0.98] pointer-events-none mb-0"
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="grid gap-x-16 gap-y-0 md:grid-cols-2 pt-1 transition-all duration-500">
                                            <UnderlineField
                                                label="Contact Number"
                                                name="adm_contact"
                                                placeholder="e.g. 09171234567"
                                                value={form.contact_number}
                                                onChange={(e) => setForm({ ...form, contact_number: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                                                required={form.role === "Resident"}
                                                maxLength={11}
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                error={err("contact_number")}
                                                trailingIcon="phone"
                                            />
                                            <UnderlineField
                                                label="Plate Number"
                                                name="adm_plate"
                                                placeholder="e.g. ABC 1234"
                                                value={form.plate_number}
                                                onChange={(e) => setForm({ ...form, plate_number: formatPlateInput(e.target.value) })}
                                                required={form.role === "Resident"}
                                                error={err("plate_number")}
                                                trailingIcon="plate"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <p className="mb-2 text-center text-[12.5px] leading-relaxed text-violet-200/65">
                                    Your username and password will be generated automatically and sent to the email address above.
                                </p>

                                {/* CAPTCHA */}
                                <div className="mt-7 flex items-center justify-center gap-3">
                                    <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-xl font-semibold text-white shadow-sm">
                                        {captchaA}
                                    </span>
                                    <span className="text-xl text-violet-300/60">+</span>
                                    <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-xl font-semibold text-white shadow-sm">
                                        {captchaB}
                                    </span>
                                    <span className="text-xl text-violet-300/60">=</span>
                                    <input
                                        type="text" inputMode="numeric" value={captchaAnswer}
                                        onChange={(e) => { setCaptchaAnswer(e.target.value); setCaptchaError(""); }}
                                        className="w-18 rounded border border-white/20 bg-white/10 py-2.5 text-center font-mono text-xl font-semibold text-white shadow-sm outline-none placeholder:text-white/30 focus:border-violet-400 focus:ring-1 focus:ring-violet-400/40"
                                        placeholder="?" aria-label="Captcha answer"
                                    />
                                    <button
                                        type="button" onClick={refreshCaptcha}
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/50 shadow-sm transition hover:border-violet-400/50 hover:bg-white/15 hover:text-violet-300"
                                        aria-label="Refresh captcha"
                                    >
                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <path d="M4 12a8 8 0 0 1 13.657-5.657M20 12a8 8 0 0 1-13.657 5.657M20 12h4m-4 0v-4M4 12H0m4 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </div>
                                {captchaError && (
                                    <p className="mt-2.5 text-center text-sm text-red-400">{captchaError}</p>
                                )}

                                <SubmitAdmissionButton loading={loading} />

                                <p className="pt-6 text-center text-[13.5px] text-violet-200/80">
                                    Already have an account?{" "}
                                    <button type="button" className="font-semibold text-white underline underline-offset-[3px] transition hover:text-violet-100" onClick={onClose}>
                                        Sign In
                                    </button>
                                </p>
                                <p className="pb-4 pt-2 text-center">
                                    <button
                                        type="button"
                                        className="text-[13.5px] font-medium text-violet-300/80 hover:text-white hover:underline"
                                        onClick={(e) => e.preventDefault()}
                                    >
                                        Click here to watch the Video User Guide
                                    </button>
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
};

export default RegistrationModal;
