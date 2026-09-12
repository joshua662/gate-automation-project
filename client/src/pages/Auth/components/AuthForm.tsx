import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AuthField from "./AuthField";
import SubmitButton from "../../../components/Button/SubmitButton";
import { useAuth } from "../../../contexts/AuthContext";
import GenderService from "../../../services/GenderService";
import RegistrationModal from "./RegistrationModal";
import ForgotPasswordModal from "./ForgotPasswordModal";
import ToastMessage from "../../../components/ToastMessage/ToastMessage";
import logoSrc from "../../../assets/img/pdp-logo-invert.png";
import GateAccessService from "../../../services/GateAccessService";
import { emptyAdmissionForm } from "./authTypes";

interface AuthFormProps {
    message?: (message: string, isFailed: boolean) => void;
    /** When true (e.g. `/register` route), open the registration modal on mount. */
    defaultRegistrationOpen?: boolean;
    loginHeadline?: string;
    loginSubtitle?: string;
}

const SparkleGlyph = () => (
    <div className="relative group cursor-pointer">
        <img
            src={logoSrc}
            alt="Pueblo de Panay"
            className="max-h-28 w-auto object-contain drop-shadow-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-108 group-hover:rotate-1 group-hover:drop-shadow-[0_0_16px_rgba(255,255,255,0.4)] animate-logo-pulse"
        />
    </div>
);

const AuthForm = ({
    message,
    defaultRegistrationOpen = false,
    loginHeadline = "Welcome back!",
    loginSubtitle = "Sign in to reach your gate dashboard and stay on top of access activity.",
}: AuthFormProps) => {
    const [registrationOpen, setRegistrationOpen] = useState(defaultRegistrationOpen);
    const [loginLoading, setLoginLoading] = useState(false);
    const [registerLoading, setRegisterLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [genders, setGenders] = useState<{ gender_id: number; gender: string }[]>([]);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [admissionForm, setAdmissionForm] = useState(emptyAdmissionForm);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

    // ── Toast state ──────────────────────────────────────────────────────────
    const [toast, setToast] = useState({ visible: false, message: "", failed: false });

    const showToast = (msg: string, isFailed: boolean) => {
        if (message) {
            message(msg, isFailed);
        } else {
            setToast({ visible: true, message: msg, failed: isFailed });
        }
    };

    const closeToast = () => setToast((t) => ({ ...t, visible: false }));
    // ─────────────────────────────────────────────────────────────────────────

    const { login, securityGuardRegister } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (defaultRegistrationOpen) {
            setRegistrationOpen(true);
        }
    }, [defaultRegistrationOpen]);

    useEffect(() => {
        if (!registrationOpen) return;
        let cancelled = false;
        GenderService.loadPublicGenders()
            .then((r) => {
                if (!cancelled) {
                    const list = r.data?.genders;
                    setGenders(Array.isArray(list) ? list : []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setGenders([]);
                    showToast("Could not load gender options. Check your API URL and network connection.", true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [registrationOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleApiError = (error: unknown) => {
        const err = error as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } };
        if (err.response?.status === 422 && err.response.data?.errors) {
            setFieldErrors(err.response.data.errors);
            const firstKey = Object.keys(err.response.data.errors)[0];
            const firstMsg = firstKey ? err.response.data.errors[firstKey]?.[0] : null;
            showToast(firstMsg || "Please check the highlighted fields.", true);
        } else if (err.response?.status === 401) {
            setFieldErrors({});
            showToast(err.response.data?.message || "Invalid credentials.", true);
        } else if (err.response?.data?.message && typeof err.response.data.message === "string") {
            showToast(err.response.data.message, true);
        } else {
            showToast("Something went wrong. Please try again.", true);
        }
    };

    const navigateAfterLogin = (session: { user?: { role?: string } }) => {
        const destination = session.user?.role === "resident" ? "/resident/home" : "/dashboard";
        setTimeout(() => navigate(destination), 1200);
    };

    const handleLoginSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setFieldErrors({});

        try {
            const session = await login(username.trim(), password);
            showToast("Login successful. Welcome back!", false);
            navigateAfterLogin(session);
        } catch (error) {
            handleApiError(error);
        } finally {
            setLoginLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!admissionForm.role) {
            setFieldErrors({ role: ["Please select Security Guard or Resident."] });
            showToast("Please select a role.", true);
            return;
        }

        setRegisterLoading(true);
        setFieldErrors({});
        setRegistrationSuccess(false);

        const payload = {
            first_name: admissionForm.first_name.trim(),
            middle_name: admissionForm.middle_name.trim() || undefined,
            last_name: admissionForm.last_name.trim(),
            gender: admissionForm.gender,
            birth_date: admissionForm.birth_date,
            email: admissionForm.email.trim(),
        };

        try {
            const isSecurityGuard = admissionForm.role === "Security Guard";
            if (!isSecurityGuard) {
                const contact = admissionForm.contact_number.trim();
                if (!contact || !admissionForm.plate_number.trim() || contact.length !== 11) {
                    setFieldErrors({
                        ...(contact ? (contact.length !== 11 ? { contact_number: ["Contact number must be exactly 11 digits."] } : {}) : { contact_number: ["Contact number is required for residents."] }),
                        ...(admissionForm.plate_number.trim() ? {} : { plate_number: ["Plate number is required for residents."] }),
                    });
                    showToast("Please enter a valid 11-digit resident contact number.", true);
                    setRegisterLoading(false);
                    return;
                }
            }

            const res = isSecurityGuard
                ? await securityGuardRegister(payload as Record<string, string>)
                : await GateAccessService.residentRegister({
                    ...payload,
                    contact_number: admissionForm.contact_number.trim(),
                    plate_number: admissionForm.plate_number.trim().toUpperCase(),
                });

            setRegistrationSuccess(true);
            setAdmissionForm(emptyAdmissionForm());
            const successMsg = (res as { data?: { message?: string } })?.data?.message ?? "Registration successful.";
            showToast(successMsg, false);
        } catch (error) {
            handleApiError(error);
        } finally {
            setRegisterLoading(false);
        }
    };

    return (
        <div className="w-full">
            {!message && (
                <ToastMessage
                    isVisible={toast.visible}
                    message={toast.message}
                    isFailed={toast.failed}
                    onClose={closeToast}
                    overlay
                    size="large"
                />
            )}

            <div className="mb-8 flex flex-col items-center text-center">
                <SparkleGlyph />
                <h2 className="mt-4 text-[1.65rem] font-semibold tracking-tight text-white">{loginHeadline}</h2>
                <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-violet-200/88">{loginSubtitle}</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="max-h-[46vh] overflow-y-auto pr-0.5 scrollbar-thin">
                <AuthField
                    label="Username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    errors={fieldErrors.username}
                    required
                    autoFocus
                />
                <AuthField
                    label="Password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    errors={fieldErrors.password}
                    required
                    passwordToggle
                />

                <div className="mb-6 mt-2 flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer select-none items-center gap-2.5">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 rounded border-white/35 bg-white/15 text-violet-500 accent-violet-500 focus:ring-violet-400/40 focus:ring-offset-0"
                        />
                        <span className="text-sm text-violet-100/95">Remember me</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setForgotPasswordOpen(true)}
                        className="text-xs font-medium text-violet-200/95 underline-offset-4 hover:text-white hover:underline"
                    >
                        Forgot password?
                    </button>
                </div>

                <SubmitButton
                    className="w-full rounded-full border-0 py-3.5 text-sm font-semibold shadow-lg shadow-black/25"
                    newClassName="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-semibold tracking-wide text-slate-900 shadow-lg shadow-black/20 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                    label="Log In"
                    loading={loginLoading}
                    loadingLabel="Signing in..."
                />
            </form>

            <p className="mt-8 text-center text-sm text-violet-200/90">
                Don&apos;t have an account?{" "}
                <button
                    type="button"
                    onClick={() => setRegistrationOpen(true)}
                    className="font-bold tracking-wide text-white underline-offset-4 transition hover:text-violet-200 hover:underline"
                >
                    Register Now
                </button>
            </p>

            <RegistrationModal
                isOpen={registrationOpen}
                onClose={() => setRegistrationOpen(false)}
                form={admissionForm}
                setForm={setAdmissionForm}
                genders={genders}
                fieldErrors={fieldErrors}
                loading={registerLoading}
                onRegister={handleRegister}
                registrationSuccess={registrationSuccess}
            />

            <ForgotPasswordModal 
                isOpen={forgotPasswordOpen}
                onClose={() => setForgotPasswordOpen(false)}
            />
        </div>
    );
};

export default AuthForm;