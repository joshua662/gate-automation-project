import 'dart:convert';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/router/app_router.dart';
import '../../core/utils/plate_input_formatter.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_page_layout.dart';
import '../../widgets/auth/underline_input_field.dart';
import '../../widgets/custom_calendar_picker.dart';
import '../../widgets/modals/confirmation_dialog.dart';
import '../../widgets/modals/success_modal.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();

  final _firstNameCtrl = TextEditingController();
  final _middleNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _birthDateCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  final _captchaCtrl = TextEditingController();

  int _selectedGenderId = 1; // 1: Male, 2: Female, 3: Prefer Not to Say
  String _selectedRole = 'Resident'; // Security Guard or Resident
  bool _isLoading = false;

  int _captchaA = 12;
  int _captchaB = 3;
  String? _captchaError;

  final Map<String, String> _fieldErrors = {};

  late AnimationController _animController;
  late Animation<double> _barAnim;

  @override
  void initState() {
    super.initState();
    _refreshCaptcha();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _barAnim = CurvedAnimation(
      parent: _animController,
      curve: Curves.fastOutSlowIn,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _firstNameCtrl.dispose();
    _middleNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _birthDateCtrl.dispose();
    _contactCtrl.dispose();
    _plateCtrl.dispose();
    _captchaCtrl.dispose();
    super.dispose();
  }

  void _refreshCaptcha() {
    final rand = math.Random();
    setState(() {
      _captchaA = rand.nextInt(90) + 10;
      _captchaB = rand.nextInt(9) + 1;
      _captchaCtrl.clear();
      _captchaError = null;
    });
  }

  Future<void> _selectBirthDate() async {
    final initialDate = DateTime.tryParse(_birthDateCtrl.text) ?? DateTime(2000, 1, 1);
    final picked = await showCustomCalendarPicker(
      context: context,
      initialDate: initialDate,
    );
    if (picked != null) {
      final formatted =
          "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      setState(() {
        _birthDateCtrl.text = formatted;
      });
    }
  }

  Future<void> _onFormSubmitPressed() async {
    setState(() {
      _fieldErrors.clear();
      _captchaError = null;
    });

    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Validate CAPTCHA
    final userAns = int.tryParse(_captchaCtrl.text.trim());
    final expected = _captchaA + _captchaB;
    if (userAns == null || userAns != expected) {
      setState(() {
        _captchaError = 'Please solve the verification correctly.';
      });
      return;
    }

    final email = _emailCtrl.text.trim();

    // Show Confirmation Dialog Modal matching Client works!
    final confirmed = await ConfirmationDialog.show(
      context,
      email: email,
    );

    if (confirmed == true && mounted) {
      await _executeRegistration();
    }
  }

  Future<void> _executeRegistration() async {
    setState(() => _isLoading = true);

    try {
      final authService = ref.read(authServiceProvider);
      final email = _emailCtrl.text.trim();

      final payload = {
        'first_name': _firstNameCtrl.text.trim(),
        if (_middleNameCtrl.text.trim().isNotEmpty)
          'middle_name': _middleNameCtrl.text.trim(),
        'last_name': _lastNameCtrl.text.trim(),
        'gender': _selectedGenderId,
        'birth_date': _birthDateCtrl.text,
        'email': email,
        'role': _selectedRole == 'Security Guard' ? 'security_guard' : 'resident',
      };

      if (_selectedRole == 'Security Guard') {
        await authService.registerSecurityGuard(payload);
      } else {
        payload['contact_number'] = _contactCtrl.text.trim();
        payload['plate_number'] = _plateCtrl.text.trim().toUpperCase();

        await authService.registerResident(payload);
      }

      if (mounted) {
        // Show Success Modal matching Client works!
        await SuccessModal.show(
          context,
          title: 'Registration complete!',
          message: 'Please wait for a moment while the admin accepts your registration to receive your credentials.',
          autoDismissDuration: const Duration(seconds: 3),
        );
        if (mounted) {
          Navigator.of(context).pushReplacementNamed(AppRouter.login);
        }
      }
    } on DioException catch (e) {
      _parseDioError(e);
      _refreshCaptcha();
    } catch (e) {
      if (mounted) ToastHelper.showError(context, e.toString());
      _refreshCaptcha();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _parseDioError(DioException e) {
    dynamic data = e.response?.data;
    if (data is String && data.isNotEmpty) {
      try {
        data = jsonDecode(data);
      } catch (_) {}
    }
    if (data is Map) {
      if (data['errors'] != null && data['errors'] is Map) {
        final errors = data['errors'] as Map;
        String? firstMsg;
        errors.forEach((key, val) {
          if (val is List && val.isNotEmpty) {
            _fieldErrors[key.toString()] = val.first.toString();
            firstMsg ??= val.first.toString();
          } else if (val != null) {
            _fieldErrors[key.toString()] = val.toString();
            firstMsg ??= val.toString();
          }
        });
        if (mounted && firstMsg != null) {
          ToastHelper.showError(context, firstMsg!);
        }
        return;
      } else if (data['message'] != null) {
        if (mounted) ToastHelper.showError(context, data['message'].toString());
        return;
      }
    }
    if (mounted) ToastHelper.showError(context, 'Registration failed. Please check your inputs.');
  }

  @override
  Widget build(BuildContext context) {
    return AuthPageLayout(
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Subdivision Logo ─────────────────────────────────────────────
            Center(
              child: Image.asset(
                'assets/images/pdp-logo-invert.png',
                height: 54.h,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
            SizedBox(height: 16.h),

            // ── Top Header Title & Animated Accent Bar ────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Admission Registration',
                        style: TextStyle(
                          fontSize: 22.sp,
                          fontWeight: FontWeight.w400,
                          color: Colors.white,
                          letterSpacing: -0.3,
                        ),
                      ),
                      SizedBox(height: 8.h),
                      AnimatedBuilder(
                        animation: _barAnim,
                        builder: (context, child) {
                          return Container(
                            height: 3.h,
                            width: 140.w * _barAnim.value,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFA78BFA), Color(0xFF7C3AED)],
                              ),
                              borderRadius: BorderRadius.circular(2.r),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.of(context).pushReplacementNamed(AppRouter.login),
                  child: Container(
                    padding: EdgeInsets.all(6.r),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withAlpha(20),
                      border: Border.all(color: Colors.white.withAlpha(30)),
                    ),
                    child: Icon(
                      Icons.close,
                      color: Colors.white70,
                      size: 16.r,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 24.h),

            // ── Form Inputs ───────────────────────────────────────────────
            UnderlineInputField(
              label: 'First Name',
              hint: 'e.g. Juan',
              controller: _firstNameCtrl,
              required: true,
              trailingIcon: Icons.person_outline,
              errorText: _fieldErrors['first_name'],
              validator: (v) => v == null || v.trim().isEmpty ? 'First name is required' : null,
            ),

            UnderlineInputField(
              label: 'Last Name',
              hint: 'e.g. Santos',
              controller: _lastNameCtrl,
              required: true,
              trailingIcon: Icons.person_outline,
              errorText: _fieldErrors['last_name'],
              validator: (v) => v == null || v.trim().isEmpty ? 'Last name is required' : null,
            ),

            UnderlineInputField(
              label: 'Middle Name',
              hint: 'Optional',
              controller: _middleNameCtrl,
              trailingIcon: Icons.person_outline,
              errorText: _fieldErrors['middle_name'],
            ),

            UnderlineInputField(
              label: 'Date of Birth (DD/MM/YYYY)',
              hint: 'mm/dd/yyyy',
              controller: _birthDateCtrl,
              readOnly: true,
              required: true,
              onTap: _selectBirthDate,
              trailingIcon: Icons.calendar_today_outlined,
              errorText: _fieldErrors['birth_date'],
              validator: (v) => v == null || v.trim().isEmpty ? 'Date of birth is required' : null,
            ),

            UnderlineInputField(
              label: 'Email',
              hint: 'you@gmail.com',
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              required: true,
              trailingIcon: Icons.email_outlined,
              errorText: _fieldErrors['email'],
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email is required';
                if (!v.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),

            // ── Gender Selection ──────────────────────────────────────────
            Padding(
              padding: EdgeInsets.only(bottom: 20.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      text: 'Gender',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xCCDDD6FE),
                        fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
                      ),
                      children: const [
                        TextSpan(
                          text: ' *',
                          style: TextStyle(
                            color: Color(0xFFF87171),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 6.h),
                  Row(
                    children: [
                      _buildRadioOption('Male', 1, _selectedGenderId, (val) {
                        setState(() => _selectedGenderId = val);
                      }),
                      SizedBox(width: 16.w),
                      _buildRadioOption('Female', 2, _selectedGenderId, (val) {
                        setState(() => _selectedGenderId = val);
                      }),
                      SizedBox(width: 16.w),
                      _buildRadioOption('Prefer Not to Say', 3, _selectedGenderId, (val) {
                        setState(() => _selectedGenderId = val);
                      }),
                    ],
                  ),
                ],
              ),
            ),

            // ── Role Selection ────────────────────────────────────────────
            Padding(
              padding: EdgeInsets.only(bottom: 20.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      text: 'Role',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xCCDDD6FE),
                        fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
                      ),
                      children: const [
                        TextSpan(
                          text: ' *',
                          style: TextStyle(
                            color: Color(0xFFF87171),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 6.h),
                  Row(
                    children: [
                      _buildRoleRadioOption('Security Guard', (val) {
                        setState(() => _selectedRole = val);
                      }),
                      SizedBox(width: 20.w),
                      _buildRoleRadioOption('Resident', (val) {
                        setState(() => _selectedRole = val);
                      }),
                    ],
                  ),
                ],
              ),
            ),

            // ── Resident Specific Fields ──────────────────────────────────
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              child: AnimatedOpacity(
                opacity: _selectedRole == 'Resident' ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 300),
                child: _selectedRole == 'Resident'
                    ? Column(
                        children: [
                          UnderlineInputField(
                            label: 'Contact Number',
                            hint: 'e.g. 09171234567',
                            controller: _contactCtrl,
                            keyboardType: TextInputType.phone,
                            required: true,
                            maxLength: 11,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(11),
                            ],
                            trailingIcon: Icons.phone_outlined,
                            errorText: _fieldErrors['contact_number'],
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) {
                                return 'Contact number is required for residents';
                              }
                              if (v.trim().length != 11) {
                                return 'Contact number must be exactly 11 digits';
                              }
                              return null;
                            },
                          ),
                          UnderlineInputField(
                            label: 'Plate Number',
                            hint: 'e.g. ABC 1234',
                            controller: _plateCtrl,
                            required: true,
                            trailingIcon: Icons.directions_car_outlined,
                            inputFormatters: [PlateInputFormatter()],
                            errorText: _fieldErrors['plate_number'],
                            validator: (v) =>
                                v == null || v.trim().isEmpty ? 'Plate number is required for residents' : null,
                          ),
                        ],
                      )
                    : const SizedBox.shrink(),
              ),
            ),

            // ── Auto Credentials Helper Text ──────────────────────────────
            Text(
              'Your username and password will be generated automatically and sent to the email address above.',
              style: TextStyle(
                fontSize: 12.sp,
                color: const Color(0xA6DDD6FE),
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 20.h),

            // ── CAPTCHA Section ───────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildCaptchaBox('$_captchaA'),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6.w),
                  child: Text('+', style: TextStyle(fontSize: 18.sp, color: const Color(0x99C4B5FD))),
                ),
                _buildCaptchaBox('$_captchaB'),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6.w),
                  child: Text('=', style: TextStyle(fontSize: 18.sp, color: const Color(0x99C4B5FD))),
                ),
                SizedBox(
                  width: 54.w,
                  child: TextFormField(
                    controller: _captchaCtrl,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 18.sp,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'monospace',
                    ),
                    decoration: InputDecoration(
                      hintText: '?',
                      hintStyle: TextStyle(
                        color: Colors.white30,
                        fontSize: 18.sp,
                      ),
                      filled: true,
                      fillColor: Colors.white.withAlpha(25),
                      contentPadding: EdgeInsets.symmetric(vertical: 10.h),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6.r),
                        borderSide: BorderSide(color: Colors.white.withAlpha(50)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6.r),
                        borderSide: BorderSide(color: Colors.white.withAlpha(50)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6.r),
                        borderSide: const BorderSide(color: Color(0xFFA78BFA), width: 1.5),
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 10.w),
                GestureDetector(
                  onTap: _refreshCaptcha,
                  child: Container(
                    width: 38.r,
                    height: 38.r,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withAlpha(20),
                      border: Border.all(color: Colors.white.withAlpha(40)),
                    ),
                    child: Icon(
                      Icons.refresh_rounded,
                      color: Colors.white70,
                      size: 18.r,
                    ),
                  ),
                ),
              ],
            ),
            if (_captchaError != null) ...[
              SizedBox(height: 8.h),
              Center(
                child: Text(
                  _captchaError!,
                  style: TextStyle(
                    color: const Color(0xFFF87171),
                    fontSize: 12.sp,
                  ),
                ),
              ),
            ],
            SizedBox(height: 24.h),

            // ── Submit Button (Purple Pill with Arrow) ───────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _onFormSubmitPressed,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED), // bg-violet-600
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.white30,
                  elevation: 8,
                  shadowColor: const Color(0x664C1D95),
                  padding: EdgeInsets.symmetric(vertical: 14.h),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30.r),
                  ),
                ),
                child: _isLoading
                    ? SizedBox(
                        height: 20.r,
                        width: 20.r,
                        child: const CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.white,
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'SUBMIT',
                            style: TextStyle(
                              fontSize: 13.5.sp,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                          ),
                          SizedBox(width: 6.w),
                          Icon(
                            Icons.north_east_rounded,
                            size: 16.r,
                          ),
                        ],
                      ),
              ),
            ),
            SizedBox(height: 20.h),

            // ── Sign In Footer Link ───────────────────────────────────────
            Center(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Already have an account? ',
                    style: TextStyle(
                      fontSize: 13.sp,
                      color: const Color(0xE6DDD6FE),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).pushReplacementNamed(AppRouter.login);
                    },
                    child: Text(
                      'Sign In',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        decoration: TextDecoration.underline,
                        decorationColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRadioOption<T>(
    String label,
    T value,
    T groupValue,
    ValueChanged<T> onChanged,
  ) {
    final isSelected = value == groupValue;
    return GestureDetector(
      onTap: () => onChanged(value),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 16.r,
            height: 16.r,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected ? const Color(0xFFA78BFA) : Colors.white54,
                width: isSelected ? 5.r : 1.5.r,
              ),
              color: isSelected ? Colors.white : Colors.transparent,
            ),
          ),
          SizedBox(width: 6.w),
          Text(
            label,
            style: TextStyle(
              fontSize: 13.sp,
              color: Colors.white.withAlpha(230),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoleRadioOption(
    String roleName,
    ValueChanged<String> onChanged,
  ) {
    return _buildRadioOption(roleName, roleName, _selectedRole, onChanged);
  }

  Widget _buildCaptchaBox(String text) {
    return Container(
      constraints: BoxConstraints(minWidth: 44.w),
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(25),
        borderRadius: BorderRadius.circular(6.r),
        border: Border.all(color: Colors.white.withAlpha(50)),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 18.sp,
          fontWeight: FontWeight.bold,
          color: Colors.white,
          fontFamily: 'monospace',
        ),
      ),
    );
  }
}
