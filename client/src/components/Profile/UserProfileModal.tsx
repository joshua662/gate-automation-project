import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FC, type ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import GateAccessService from "../../services/GateAccessService";
import GenderService from "../../services/GenderService";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import loginBackdrop from "../../assets/img/subdivision-gate-background.png";

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

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    user_id: number;
    role?: "admin" | "resident" | "security_guard" | string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    suffix_name?: string;
    gender?: {
      gender_id: number;
      gender: string;
    };
    birth_date?: string;
    age?: string | number;
    username?: string;
    email?: string;
    contact_number?: string;
    address?: string;
    plate_number?: string;
    car_model?: string;
    car_color?: string;
    profile_picture?: string | null;
    rfid_card_uid?: string | null;
  };
  onLogout: () => void;
}

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

const buildFormFromUser = (user: UserProfileModalProps["user"]): ProfileForm => ({
  first_name: user.first_name ?? "",
  middle_name: user.middle_name ?? "",
  last_name: user.last_name ?? "",
  gender: user.gender?.gender_id ? String(user.gender.gender_id) : "",
  birth_date: user.birth_date ? user.birth_date.slice(0, 10) : "",
  email: user.email ?? "",
  username: user.username ?? "",
  contact_number: user.contact_number ?? "",
  address: user.address ?? "",
  plate_number: user.plate_number ?? "",
  car_model: user.car_model ?? "",
  car_color: user.car_color ?? "",
});

const UserProfileModal: FC<UserProfileModalProps> = ({ isOpen, onClose, user, onLogout }) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);
  const { refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<{ type: "success" | "error"; title: string; message: string; hideConfirmButton?: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [editForm, setEditForm] = useState<ProfileForm>(() => buildFormFromUser(user));
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

  const displayAvatarUrl = useMemo(() => {
    if (previewAvatar) return previewAvatar;
    return resolveProfilePictureUrl(user.profile_picture);
  }, [previewAvatar, user.profile_picture]);

  useEffect(() => {
    if (!statusModal?.hideConfirmButton) return;
    const timer = setTimeout(() => {
      setStatusModal(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [statusModal]);

  const handleAvatarClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    try {
      setUploading(true);
      setSaveError("");
      const objectUrl = URL.createObjectURL(file);
      setPreviewAvatar(objectUrl);

      const formData = new FormData();
      formData.append("profile_picture", file);

      const res = await GateAccessService.updateProfile(formData);
      if (res.data?.user) {
        await refreshUser();
        setStatusModal({
          type: "success",
          title: "Profile Picture Updated",
          message: "Your profile picture has been updated successfully.",
          hideConfirmButton: true,
        });
      }
    } catch (err: any) {
      console.error("Failed to upload profile picture:", err);
      setSaveError(err.response?.data?.message || "Failed to upload image. Please try again.");
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
      setSaveError("");
      const formData = new FormData();
      formData.append("remove_profile_picture", "1");

      const res = await GateAccessService.updateProfile(formData);
      if (res.data?.user) {
        setPreviewAvatar(null);
        await refreshUser();
        setStatusModal({
          type: "success",
          title: "Profile Picture Removed",
          message: "Your profile picture has been removed successfully.",
          hideConfirmButton: true,
        });
      }
    } catch (err: any) {
      console.error("Failed to remove profile picture:", err);
      setSaveError(err.response?.data?.message || "Failed to remove profile picture. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setSaveError("");
      setConfirmSaveOpen(false);
      setStatusModal(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    setEditForm(buildFormFromUser(user));
  }, [user]);

  useEffect(() => {
    if (!isOpen || !isEditing || user.role !== "resident") return;
    GenderService.loadGenders()
      .then((res) => setGenders(res.data?.genders ?? []))
      .catch(() => setGenders([]));
  }, [isOpen, isEditing, user.role]);

  const userInitials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || "U";

  const fullName = useMemo(() => {
    let name = `${user.first_name} ${user.last_name}`;
    if (user.middle_name) {
      name = `${user.first_name} ${user.middle_name.charAt(0)}. ${user.last_name}`;
    }
    if (user.suffix_name) {
      name += ` ${user.suffix_name}`;
    }
    return name;
  }, [user]);

  const isResident = user.role === "resident";
  const roleDisplay = isResident ? "Resident" : "Security Guard";

  if (!shouldRender) return null;

  const handleCancelEdit = () => {
    setEditForm(buildFormFromUser(user));
    setFieldErrors({});
    setSaveError("");
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setConfirmSaveOpen(false);
    setFieldErrors({});

    const payload: Record<string, unknown> = isResident
      ? {
          ...editForm,
          middle_name: editForm.middle_name.trim() || undefined,
          plate_number: editForm.plate_number.trim().toUpperCase(),
        }
      : {
          first_name: editForm.first_name.trim(),
          middle_name: editForm.middle_name.trim() || undefined,
          last_name: editForm.last_name.trim(),
          email: editForm.email.trim(),
          contact_number: editForm.contact_number.trim(),
        };

    try {
      await GateAccessService.updateProfile(payload);
      await refreshUser();
      setIsEditing(false);
      setStatusModal({
        type: "success",
        title: "Profile Updated",
        message: "Your profile changes were saved successfully.",
      });
    } catch (error) {
      const err = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
      }
      const message = err.response?.data?.message ?? "Failed to update profile.";
      setSaveError(message);
      setStatusModal({
        type: "error",
        title: "Unable to Save",
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) => fieldErrors[key]?.[0];

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500 focus:bg-black/50 transition-colors";

  return (
    <>
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`} onClick={onClose}>
        <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
        <div
          className={`relative w-full max-w-[1100px] max-h-[95vh] overflow-y-auto rounded-xl bg-[#1e1e24]/75 backdrop-blur-xl border border-white/10 shadow-2xl scrollbar-thin scrollbar-thumb-zinc-700 ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 sm:p-6 lg:p-8 text-white">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
            />

            {/* ── Profile Header with Expanded Cover Banner ── */}
            <div className="mb-6 sm:mb-8 overflow-hidden rounded-2xl border border-white/10 bg-[#16161c]/90 shadow-2xl">
              {/* Expanded Top Cover Banner (Login Form Background Image containing "My Profile" text & close button) */}
              <div className="relative h-48 sm:h-56 w-full overflow-hidden">
                <img
                  src={loginBackdrop}
                  alt="Cover Banner"
                  className="absolute inset-0 h-full w-full object-cover scale-105"
                />
                {/* Gradient overlays for crisp readability and login backdrop aesthetic */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-indigo-950/45 to-purple-950/70" />
                <div
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    backgroundImage: `
                      radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.75), transparent),
                      radial-gradient(1px 1px at 70% 18%, rgba(255,255,255,0.55), transparent),
                      radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.5), transparent)
                    `,
                  }}
                />

                {/* Integrated "My Profile" Title, Subtitle & Close Button inside Banner */}
                <div className="relative z-10 flex items-start justify-between p-5 sm:p-6">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-md">My Profile</h2>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-200/90 font-medium drop-shadow">View and manage your personal and account information</p>
                  </div>
                  <button 
                    type="button"
                    onClick={onClose} 
                    className="rounded-full bg-black/40 p-2 text-zinc-300 backdrop-blur-md transition hover:bg-black/70 hover:text-white shadow-lg border border-white/10"
                    aria-label="Close profile modal"
                  >
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Lower Section with Overlapping Avatar & Info */}
              <div className="relative px-5 sm:px-6 pb-6 pt-0">
                {/* Avatar + Right Action Buttons Row */}
                <div className="flex items-end justify-between gap-4">
                  {/* Overlapping Avatar + Click Action Buttons on Right */}
                  <div ref={avatarContainerRef} className="relative -mt-14 sm:-mt-18 flex shrink-0 items-center">
                    {/* Circle Avatar Container */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAvatarMenuOpen((prev) => !prev);
                      }}
                      className="relative flex h-28 w-28 sm:h-36 sm:w-36 cursor-pointer items-center justify-center overflow-hidden rounded-full border-[5px] sm:border-[6px] border-[#1e1e24] bg-[#2a2a36] text-3xl sm:text-4xl font-bold text-white shadow-2xl transition hover:ring-4 hover:ring-blue-500/40"
                    >
                      {displayAvatarUrl ? (
                        <img src={displayAvatarUrl} alt={fullName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl sm:text-4xl font-bold tracking-wide text-white">{userInitials}</span>
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
                        className={`absolute left-[calc(100%+14px)] top-1/2 z-30 flex flex-col gap-1.5 rounded-2xl bg-[#16161c]/95 p-2 backdrop-blur-xl border border-white/15 shadow-2xl whitespace-nowrap origin-left ${
                          isAvatarMenuOut ? "animate-popover-out" : "animate-popover-in"
                        }`}
                      >
                        {/* Left Arrow pointing to profile picture */}
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rotate-45 bg-[#16161c] border-b border-l border-white/15" />

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

                  {/* Action Buttons on the Right */}
                  <div className="flex items-center gap-2 sm:gap-3 pt-3">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="rounded-xl border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 active:scale-95"
                      >
                        Edit Profile
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="rounded-xl border border-white/15 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-95"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmSaveOpen(true)}
                          disabled={saving}
                          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-500 disabled:opacity-60 active:scale-95"
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </>
                    )}
                    <button 
                      type="button"
                      onClick={onLogout} 
                      className="rounded-xl border border-red-500/30 bg-red-500/15 px-5 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/25 active:scale-95"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>

                {/* Name, Verified Badge, Email & Role Details below avatar */}
                <div className="mt-3.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{fullName}</h3>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm" title="Verified Member">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                    <span>{user.email || user.username || "Member Account"}</span>
                    <span className="text-zinc-600">&bull;</span>
                    <span className="capitalize text-blue-300 font-medium">{roleDisplay} Member</span>
                    <span className="text-zinc-600">&bull;</span>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      Active Account
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] items-stretch">
              <div className="flex flex-col gap-6 h-full">
                <div className="h-full rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="h-6 w-6 rounded-md bg-[#2d3a56] flex items-center justify-center">
                      <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h4 className="text-[17px] font-bold text-white">Personal Information</h4>
                  </div>

                  {!isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoField label="First Name" value={user.first_name} />
                      <InfoField label="Last Name" value={user.last_name} />
                      <InfoField label="Age" value={String(user.age ?? "—")} />
                      <InfoField label="Contact Number" value={user.contact_number} />
                      <div className="col-span-1 sm:col-span-2">
                        <InfoField label="Address" value={user.address} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <EditField label="First Name" error={fieldError("first_name")}>
                        <input className={inputClass} value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                      </EditField>
                      <EditField label="Last Name" error={fieldError("last_name")}>
                        <input className={inputClass} value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                      </EditField>
                      {!isResident && (
                        <EditField label="Middle Name" error={fieldError("middle_name")} className="sm:col-span-2">
                          <input className={inputClass} value={editForm.middle_name} onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })} />
                        </EditField>
                      )}
                      {isResident && (
                        <>
                          <EditField label="Middle Name" error={fieldError("middle_name")}>
                            <input className={inputClass} value={editForm.middle_name} onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })} />
                          </EditField>
                          <EditField label="Date of Birth" error={fieldError("birth_date")}>
                            <input type="date" className={inputClass} value={editForm.birth_date} onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })} />
                          </EditField>
                          <EditField label="Gender" error={fieldError("gender")}>
                            <select className={inputClass} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                              <option value="">Select gender</option>
                              {genders.map((g) => (
                                <option key={g.gender_id} value={g.gender_id}>{g.gender}</option>
                              ))}
                            </select>
                          </EditField>
                        </>
                      )}
                      <EditField label="Contact Number" error={fieldError("contact_number")}>
                        <input className={inputClass} value={editForm.contact_number} onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value.replace(/\D/g, "").slice(0, 11) })} maxLength={11} inputMode="numeric" pattern="[0-9]*" />
                      </EditField>
                      {isResident && (
                        <div className="col-span-1 sm:col-span-2">
                          <EditField label="Address" error={fieldError("address")}>
                            <input className={inputClass} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                          </EditField>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isResident && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="h-6 w-6 rounded-md bg-[#3f2a4f] flex items-center justify-center">
                        <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1M18 16a3 3 0 01-3-3V8.586a1 1 0 01.293-.707l2.828-2.828A1 1 0 0118.828 5H21a1 1 0 011 1v10a1 1 0 01-1 1h-1" />
                        </svg>
                      </div>
                      <h4 className="text-[17px] font-bold text-white">Vehicle Information</h4>
                    </div>

                    {!isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoField label="Plate Number" value={user.plate_number} highlight />
                        <InfoField label="Car Model" value={user.car_model} />
                        <div className="col-span-1 sm:col-span-2">
                          <InfoField label="Car Color" value={user.car_color} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <EditField label="Plate Number" error={fieldError("plate_number")}>
                          <input className={inputClass} value={editForm.plate_number} onChange={(e) => setEditForm({ ...editForm, plate_number: e.target.value.toUpperCase() })} />
                        </EditField>
                        <EditField label="Car Model" error={fieldError("car_model")}>
                          <input className={inputClass} value={editForm.car_model} onChange={(e) => setEditForm({ ...editForm, car_model: e.target.value })} />
                        </EditField>
                        <div className="col-span-1 sm:col-span-2">
                          <EditField label="Car Color" error={fieldError("car_color")}>
                            <input className={inputClass} value={editForm.car_color} onChange={(e) => setEditForm({ ...editForm, car_color: e.target.value })} />
                          </EditField>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Right Side: Account Information (Narrower Width, Perfectly Aligned Rows) */}
              <div className="flex flex-col h-full">
                <div className="h-full rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="h-7 w-7 rounded-md bg-[#243e30] flex items-center justify-center">
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h4 className="text-[17px] font-bold text-white">Account Information</h4>
                  </div>

                  {!isEditing ? (
                    <div className="flex flex-col gap-4">
                      <InfoField label="Email" value={user.email} />
                      <InfoField label="Username" value={user.username ? `@${user.username}` : undefined} />
                      <InfoField label="Account ID" value={`#${user.user_id}`} />
                      {isResident && (
                        <InfoField label="RFID UID" value={user.rfid_card_uid} />
                      )}
                    </div>
                  ) : isResident ? (
                    <div className="flex flex-col gap-4">
                      <EditField label="Email" error={fieldError("email")}>
                        <input className={inputClass} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      </EditField>
                      <EditField label="Username" error={fieldError("username")}>
                        <input className={inputClass} value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                      </EditField>
                      <InfoField label="Account ID" value={`#${user.user_id}`} />
                      <InfoField label="RFID UID" value={user.rfid_card_uid} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <EditField label="Email" error={fieldError("email")}>
                        <input className={inputClass} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      </EditField>
                      <InfoField label="Account ID" value={`#${user.user_id}`} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProfileActionModal
        isOpen={confirmSaveOpen}
        tone="confirm"
        title="Save Profile Changes?"
        message="Please confirm that you want to save the changes to your profile."
        confirmLabel={saving ? "Saving..." : "Save Changes"}
        onConfirm={() => void handleSave()}
        onClose={() => setConfirmSaveOpen(false)}
        disabled={saving}
      />

      <ProfileActionModal
        isOpen={Boolean(statusModal)}
        tone={statusModal?.type ?? "success"}
        title={statusModal?.title ?? ""}
        message={statusModal?.message ?? ""}
        confirmLabel="OK"
        hideConfirmButton={statusModal?.hideConfirmButton}
        onConfirm={() => setStatusModal(null)}
        onClose={() => setStatusModal(null)}
      />
    </>
  );
};

const InfoField = ({
  label,
  value,
  compact,
  highlight,
}: {
  label: string;
  value?: string | null;
  compact?: boolean;
  highlight?: boolean;
}) => (
  <div className={`rounded-lg border p-4 ${highlight ? "border-blue-500/30 bg-blue-500/10" : "border-white/5 bg-black/25"}`}>
    <p className={`text-[11px] font-bold uppercase tracking-widest ${highlight ? "text-blue-400" : "text-gray-500"}`}>{label}</p>
    <p className={`mt-1.5 ${compact ? "text-[14px] font-medium" : "text-[15px] font-bold"} text-gray-100`}>{value || "—"}</p>
  </div>
);

const EditField = ({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) => (
  <div className={className}>
    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
  </div>
);

const ProfileActionModal = ({
  isOpen,
  tone,
  title,
  message,
  confirmLabel,
  disabled,
  hideConfirmButton,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  tone: "confirm" | "success" | "error";
  title: string;
  message: string;
  confirmLabel: string;
  disabled?: boolean;
  hideConfirmButton?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);
  if (!shouldRender) return null;

  const toneClass = tone === "error"
    ? "border-red-500/30 bg-red-500/10 text-red-200"
    : tone === "success"
      ? "border-green-500/30 bg-green-500/10 text-green-200"
      : "border-blue-500/30 bg-blue-500/10 text-blue-200";
  const buttonClass = tone === "error"
    ? "bg-red-600 hover:bg-red-500"
    : tone === "success"
      ? "bg-green-600 hover:bg-green-500"
      : "bg-blue-600 hover:bg-blue-500";

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button type="button" aria-label="Close modal" onClick={onClose} className={`absolute inset-0 bg-black/80 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
      <div className={`relative w-full max-w-md rounded-xl border border-white/10 bg-[#1e1e24]/90 p-6 text-white shadow-2xl backdrop-blur-xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}>
        <div className={`rounded-lg border px-4 py-3 ${toneClass} ${hideConfirmButton ? 'mb-0' : 'mb-4'}`}>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="mt-1 text-sm opacity-90">{message}</p>
        </div>
        {!hideConfirmButton && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {tone === "confirm" && (
              <button
                type="button"
                onClick={onClose}
                disabled={disabled}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${buttonClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
