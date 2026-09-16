import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

class AuthInputField extends StatefulWidget {
  final String label;
  final String? hint;
  final TextEditingController? controller;
  final TextInputType keyboardType;
  final bool isPassword;
  final bool required;
  final String? errorText;
  final Widget? suffixIcon;
  final void Function(String)? onChanged;
  final String? Function(String?)? validator;
  final bool readOnly;
  final VoidCallback? onTap;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;

  const AuthInputField({
    super.key,
    required this.label,
    this.hint,
    this.controller,
    this.keyboardType = TextInputType.text,
    this.isPassword = false,
    this.required = false,
    this.errorText,
    this.suffixIcon,
    this.onChanged,
    this.validator,
    this.readOnly = false,
    this.onTap,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters,
  });

  @override
  State<AuthInputField> createState() => _AuthInputFieldState();
}

class _AuthInputFieldState extends State<AuthInputField> {
  bool _obscureText = true;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.isPassword;
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;

    return Padding(
      padding: EdgeInsets.only(bottom: 16.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Label ────────────────────────────────────────────────────────
          RichText(
            text: TextSpan(
              text: widget.label,
              style: TextStyle(
                fontSize: 12.sp,
                fontWeight: FontWeight.w500,
                color: const Color(0xF2DDD6FE), // text-violet-200/95
                letterSpacing: 0.3,
                fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
              ),
              children: [
                if (widget.required)
                  const TextSpan(
                    text: ' *',
                    style: TextStyle(
                      color: Color(0xFFF472B6), // pink-400
                      fontWeight: FontWeight.bold,
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(height: 8.h),

          // ── Input Field ──────────────────────────────────────────────────
          TextFormField(
            controller: widget.controller,
            keyboardType: widget.keyboardType,
            obscureText: widget.isPassword ? _obscureText : false,
            onChanged: widget.onChanged,
            validator: widget.validator,
            readOnly: widget.readOnly,
            onTap: widget.onTap,
            textCapitalization: widget.textCapitalization,
            inputFormatters: widget.inputFormatters,
            style: TextStyle(
              fontSize: 14.sp,
              color: Colors.white,
              fontWeight: FontWeight.w400,
            ),
            decoration: InputDecoration(
              hintText: widget.hint,
              hintStyle: TextStyle(
                color: const Color(0x73DDD6FE), // violet-200/45
                fontSize: 14.sp,
              ),
              filled: true,
              fillColor: const Color(0x731E1B4B), // bg-indigo-950/45
              contentPadding: EdgeInsets.symmetric(
                horizontal: 16.w,
                vertical: 14.h,
              ),
              suffixIcon: widget.isPassword
                  ? IconButton(
                      icon: Icon(
                        _obscureText
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: const Color(0xD9FFFFFF),
                        size: 20.r,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscureText = !_obscureText;
                        });
                      },
                    )
                  : widget.suffixIcon,
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14.r),
                borderSide: BorderSide(
                  color: hasError
                      ? const Color(0x99F87171)
                      : const Color(0x47DDD6FE), // border-violet-200/28
                  width: 1,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14.r),
                borderSide: BorderSide(
                  color: hasError
                      ? const Color(0xFFF87171)
                      : const Color(0x8CDDD6FE), // focus:border-violet-200/55
                  width: 1.5,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14.r),
                borderSide: const BorderSide(
                  color: Color(0xFFF87171),
                  width: 1,
                ),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14.r),
                borderSide: const BorderSide(
                  color: Color(0xFFF87171),
                  width: 1.5,
                ),
              ),
              errorStyle: const TextStyle(height: 0, fontSize: 0),
            ),
          ),

          // ── Error Message Below ──────────────────────────────────────────
          if (hasError) ...[
            SizedBox(height: 6.h),
            Text(
              widget.errorText!,
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
