import type { ChangeEvent, FC } from "react";

interface FloatingLabelInputProps {
  label: string;
  type: "text" | "date" | "password" | "email";
  name: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  newLabelClassName?: string;
  labelClassName?: string;
  newInputClassName?: string;
  inputClassName?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  errors?: string[];
  maxLength?: number;
  inputMode?: "search" | "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "none";
  pattern?: string;
}

const FloatingLabelInput: FC<FloatingLabelInputProps> = ({
  label,
  type,
  name,
  value,
  onChange,
  newLabelClassName,
  labelClassName,
  newInputClassName,
  inputClassName,
  required,
  autoFocus,
  disabled,
  readOnly,
  errors,
  maxLength,
  inputMode,
  pattern,
}) => {
  const hasError = Boolean(errors && errors.length > 0);

  return (
    <>
      <div className="relative">
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          aria-invalid={hasError}
          maxLength={maxLength}
          inputMode={inputMode}
          pattern={pattern}
          className={`${newInputClassName
            ? newInputClassName
            : `peer block w-full appearance-none rounded-lg border bg-transparent px-2.5 pb-2.5 pt-4 text-sm text-gray-900 focus:outline-none focus:ring-0 
                ${hasError ? "border-red-500 focus:border-red-600" : "border-gray-300 focus:border-blue-600"}
                ${inputClassName}
                `
            }`}
          placeholder=" "

          autoFocus={autoFocus}
          disabled={disabled}
          readOnly={readOnly}
        />
        <label
          htmlFor={name}
          className={`${newLabelClassName
            ? newLabelClassName
            : `absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75
                top-2 z-10 origin-left4 bg-white px-2 
                peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 
                peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-1/2 
                peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 
                rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto inset-s-1 ${labelClassName}`
            }`}
        >
          {label}
          {required && (
            <span className="ml-1 text-red-600" aria-hidden>
              *
            </span>
          )}
        </label>
        {hasError && (
          <p
            role="alert"
            className="mt-2 border-t border-gray-200 pt-2 text-sm font-normal text-red-800"
          >
            {errors?.[0]}
          </p>
        )}
      </div>
    </>
  );
};

export default FloatingLabelInput;
