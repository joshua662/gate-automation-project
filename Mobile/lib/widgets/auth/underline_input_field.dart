import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

class UnderlineInputField extends StatelessWidget {
  final String label;
  final String? hint;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final bool required;
  final String? errorText;
  final IconData? trailingIcon;
  final bool readOnly;
  final VoidCallback? onTap;
  final void Function(String)? onChanged;
  final String? Function(String?)? validator;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;

  const UnderlineInputField({
    super.key,
    required this.label,
    this.hint,
    this.controller,
    this.keyboardType = TextInputType.text,
    this.required = false,
    this.errorText,
    this.trailingIcon,
    this.readOnly = false,
    this.onTap,
    this.onChanged,
    this.validator,
    this.inputFormatters,
    this.maxLength,
  });

  @override
  Widget build(BuildContext context) {
    final hasError = errorText != null && errorText!.isNotEmpty;

    return Padding(
      padding: EdgeInsets.only(bottom: 20.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Label ────────────────────────────────────────────────────────
          RichText(
            text: TextSpan(
              text: label,
              style: TextStyle(
                fontSize: 13.sp,
                fontWeight: FontWeight.w500,
                color: const Color(0xCCDDD6FE), // text-violet-200/80
                fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
              ),
              children: [
                if (required)
                  const TextSpan(
                    text: ' *',
                    style: TextStyle(
                      color: Color(0xFFF87171), // red-400
                      fontWeight: FontWeight.bold,
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(height: 2.h),

          // ── Input Field ──────────────────────────────────────────────────
          TextFormField(
            controller: controller,
            keyboardType: keyboardType,
            readOnly: readOnly,
            onTap: onTap,
            onChanged: onChanged,
            validator: validator,
            inputFormatters: inputFormatters,
            maxLength: maxLength,
            buildCounter: maxLength != null
                ? (context, {required currentLength, required isFocused, required maxLength}) => null
                : null,
            style: TextStyle(
              fontSize: 14.5.sp,
              color: Colors.white,
            ),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(
                color: const Color(0x4DFFFFFF),
                fontSize: 14.sp,
              ),
              contentPadding: EdgeInsets.only(bottom: 8.h, top: 4.h),
              isDense: true,
              filled: false,
              suffixIcon: trailingIcon != null
                  ? Padding(
                      padding: EdgeInsets.only(bottom: 6.h),
                      child: Icon(
                        trailingIcon,
                        color: const Color(0x99C4B5FD), // violet-300/60
                        size: 18.r,
                      ),
                    )
                  : null,
              suffixIconConstraints: BoxConstraints(minWidth: 24.w, minHeight: 24.h),
              enabledBorder: const UnderlineInputBorder(
                borderSide: BorderSide(
                  color: Color(0x33FFFFFF),
                  width: 1.5,
                ),
              ),
              focusedBorder: const UnderlineInputBorder(
                borderSide: BorderSide(
                  color: Color(0xFFA78BFA),
                  width: 2,
                ),
              ),
              errorBorder: const UnderlineInputBorder(
                borderSide: BorderSide(
                  color: Color(0xFFF87171),
                  width: 1.5,
                ),
              ),
              focusedErrorBorder: const UnderlineInputBorder(
                borderSide: BorderSide(
                  color: Color(0xFFF87171),
                  width: 2,
                ),
              ),
              errorStyle: const TextStyle(height: 0, fontSize: 0),
            ),
          ),

          // ── Error Message Below ──────────────────────────────────────────
          if (hasError) ...[
            SizedBox(height: 4.h),
            Text(
              errorText!,
              style: TextStyle(
                color: const Color(0xFFF87171),
                fontSize: 12.sp,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
