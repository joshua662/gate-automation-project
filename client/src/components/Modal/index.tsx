import { useCallback, useEffect, useRef, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ModalCloseButton from "../Button/ModalCloseButton";
import { useModalAnimation } from "../../hooks/useModalAnimation";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  isFullScreen?: boolean;
  backdropClassName?: string;
  bodyClassName?: string;
  /** Fade backdrop + scale-in dialog panel when opened */
}

const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  className,
  children,
  showCloseButton,
  isFullScreen,
  backdropClassName,
  bodyClassName,
}) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 200);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const contentClasses = isFullScreen
    ? "relative w-full h-full rounded-lg bg-white/70 backdrop-blur-xl border border-white/30 shadow-2xl flex flex-col text-gray-900"
    : "relative w-full sm:max-w-md md:max-w-lg lg:max-w-2xl rounded-lg bg-white/70 backdrop-blur-xl border border-white/30 shadow-2xl max-h-[90vh] flex flex-col text-gray-900";

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleEscape]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className="modal fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      {!isFullScreen && (
        <div
          className={`${backdropClassName ?? "fixed inset-0 h-full w-full bg-neutral/30 backdrop-blur-md"} ${isAnimatingOut ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"}`}
        />
      )}
      <div
        ref={modalRef}
        className={`${contentClasses} ${className} ${isAnimatingOut ? "animate-modal-panel-out" : "animate-modal-panel-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && <ModalCloseButton onClose={onClose} />}
        <div
          className={
            bodyClassName !== undefined
              ? `flex-1 overflow-y-auto ${bodyClassName}`
              : "flex-1 overflow-y-auto p-4"
          }
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
export default Modal;
