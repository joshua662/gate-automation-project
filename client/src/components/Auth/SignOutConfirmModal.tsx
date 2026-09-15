import { useState, type FC } from "react";
import { createPortal } from "react-dom";
import { useModalAnimation } from "../../hooks/useModalAnimation";

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

const SignOutConfirmModal: FC<SignOutConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);
  const [loading, setLoading] = useState(false);

  if (!shouldRender) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-opacity duration-200 ${isAnimatingOut ? "opacity-0" : "opacity-100"}`}
      onClick={onClose}
    >
      <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"}`} />
      <div
        className={`relative w-full max-w-md rounded-2xl border border-white/10 bg-[#1e1e24]/90 p-8 shadow-2xl backdrop-blur-xl ${isAnimatingOut ? "animate-modal-panel-out" : "animate-modal-panel-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-center text-xl font-bold text-white">Sign Out</h3>
        <p className="mb-8 text-center text-sm leading-relaxed text-zinc-400">
          Are you sure you want to sign out? You will need to sign in again to access your account.
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing out…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign Out
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full rounded-xl px-6 py-3 text-sm font-medium text-zinc-400 transition hover:text-white sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SignOutConfirmModal;
