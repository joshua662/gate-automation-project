import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/router/app_router.dart';
import '../../core/utils/plate_input_formatter.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/auth/login_state.dart';
import '../../providers/login_provider.dart';
import '../../widgets/auth/auth_input_field.dart';
import '../../widgets/auth/auth_page_layout.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();

  bool _rememberMe = true;
  bool _isPlateLogin = false;

  late AnimationController _staggerController;
  late Animation<double> _brandingFade;
  late Animation<double> _formFade;

  @override
  void initState() {
    super.initState();
    _staggerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    // Branding (logo, headline, subtitle) — fades in first (0% → 60%)
    _brandingFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _staggerController,
        curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
      ),
    );

    // Form section — fades in with delay (25% → 100%)
    _formFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _staggerController,
        curve: const Interval(0.25, 1.0, curve: Curves.easeOut),
      ),
    );

    _staggerController.forward();
  }

  @override
  void dispose() {
    _staggerController.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _plateCtrl.dispose();
    _contactCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_isPlateLogin) {
      ref.read(loginProvider.notifier).residentLoginByPlate(
            _plateCtrl.text.trim().toUpperCase(),
            _contactCtrl.text.trim(),
          );
    } else {
      ref.read(loginProvider.notifier).login(
            _emailCtrl.text.trim(),
            _passwordCtrl.text,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<LoginState>(loginProvider, (_, next) {
      if (next is LoginSuccess) {
        ref.read(loginProvider.notifier).reset();
        Navigator.of(context).pushReplacementNamed(AppRouter.main);
      } else if (next is LoginError) {
        ToastHelper.showError(context, next.message);
      }
    });

    final loginState = ref.watch(loginProvider);
    final isLoading = loginState is LoginLoading;

    return AuthPageLayout(
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // ── Branding Section (stagger fade-in) ────────────────────────
            FadeTransition(
              opacity: _brandingFade,
              child: Column(
                children: [
                  // ── Pueblo de Panay Logo ──────────────────────────────────
                  Image.asset(
                    'assets/images/pdp-logo-invert.png',
                    height: 70.h,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => Icon(
                      Icons.security_rounded,
                      size: 56.r,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 16.h),

                  // ── Headline & Subtitle ───────────────────────────────────
                  Text(
                    'Welcome back!',
                    style: TextStyle(
                      fontSize: 24.sp,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 8.h),
                  Text(
                    _isPlateLogin
                        ? 'Sign in using your registered plate number & 11-digit contact number.'
                        : 'Sign in to reach your gate dashboard and stay on top of access activity.',
                    style: TextStyle(
                      fontSize: 13.sp,
                      color: const Color(0xE0DDD6FE), // text-violet-200/88
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 20.h),
                ],
              ),
            ),

            // ── Form Section (stagger fade-in with delay) ─────────────────
            FadeTransition(
              opacity: _formFade,
              child: Column(
                children: [
                  // ── Mode Switcher Tabs ───────────────────────────────────
                  Container(
                    margin: EdgeInsets.only(bottom: 20.h),
                    padding: EdgeInsets.all(4.r),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(20),
                      borderRadius: BorderRadius.circular(24.r),
                      border: Border.all(color: Colors.white.withAlpha(30)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _isPlateLogin = false),
                            child: Container(
                              padding: EdgeInsets.symmetric(vertical: 8.h),
                              decoration: BoxDecoration(
                                color: !_isPlateLogin
                                    ? Colors.white
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(20.r),
                              ),
                              child: Text(
                                'Account Login',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12.5.sp,
                                  fontWeight: FontWeight.bold,
                                  color: !_isPlateLogin
                                      ? const Color(0xFF0F172A)
                                      : Colors.white70,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _isPlateLogin = true),
                            child: Container(
                              padding: EdgeInsets.symmetric(vertical: 8.h),
                              decoration: BoxDecoration(
                                color: _isPlateLogin
                                    ? Colors.white
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(20.r),
                              ),
                              child: Text(
                                'Plate Login',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12.5.sp,
                                  fontWeight: FontWeight.bold,
                                  color: _isPlateLogin
                                      ? const Color(0xFF0F172A)
                                      : Colors.white70,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  if (!_isPlateLogin) ...[
                    // ── Account Login Fields ─────────────────────────────
                    AuthInputField(
                      label: 'Username',
                      hint: 'Enter your username or email',
                      controller: _emailCtrl,
                      required: true,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Username or email is required';
                        }
                        return null;
                      },
                    ),
                    AuthInputField(
                      label: 'Password',
                      hint: '••••••••',
                      controller: _passwordCtrl,
                      isPassword: true,
                      required: true,
                      validator: (v) {
                        if (v == null || v.isEmpty) {
                          return 'Password is required';
                        }
                        return null;
                      },
                    ),
                  ] else ...[
                    // ── Plate & Contact Login Fields ─────────────────────
                    AuthInputField(
                      label: 'Plate Number',
                      hint: 'e.g. ABC 1234',
                      controller: _plateCtrl,
                      required: true,
                      textCapitalization: TextCapitalization.characters,
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9\s]')),
                        PlateInputFormatter(),
                      ],
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Plate number is required';
                        }
                        return null;
                      },
                    ),
                    AuthInputField(
                      label: 'Contact Number',
                      hint: '09XXXXXXXXX',
                      controller: _contactCtrl,
                      required: true,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(11),
                      ],
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Contact number is required';
                        }
                        if (v.trim().length != 11) {
                          return 'Contact number must be exactly 11 digits';
                        }
                        return null;
                      },
                    ),
                  ],

                  // ── Remember Me & Forgot Password ─────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            _rememberMe = !_rememberMe;
                          });
                        },
                        child: Row(
                          children: [
                            SizedBox(
                              width: 20.w,
                              height: 20.h,
                              child: Checkbox(
                                value: _rememberMe,
                                onChanged: (val) {
                                  setState(() {
                                    _rememberMe = val ?? true;
                                  });
                                },
                                activeColor: const Color(0xFF8B5CF6), // violet-500
                                side: const BorderSide(
                                  color: Color(0x66FFFFFF),
                                  width: 1.5,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4.r),
                                ),
                              ),
                            ),
                            SizedBox(width: 8.w),
                            Text(
                              'Remember me',
                              style: TextStyle(
                                fontSize: 13.sp,
                                color: const Color(0xF2EDE9FE), // violet-100/95
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (!_isPlateLogin)
                        GestureDetector(
                          onTap: () {
                            Navigator.of(context).pushNamed(AppRouter.forgotPassword);
                          },
                          child: Text(
                            'Forgot password?',
                            style: TextStyle(
                              fontSize: 12.sp,
                              fontWeight: FontWeight.w500,
                              color: const Color(0xF2DDD6FE), // violet-200/95
                            ),
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: 28.h),

                  // ── Submit Button (White Pill) ───────────────────────────
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF0F172A), // slate-900
                        disabledBackgroundColor: Colors.white60,
                        elevation: 8,
                        shadowColor: const Color(0x4D000000),
                        padding: EdgeInsets.symmetric(vertical: 14.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30.r),
                        ),
                      ),
                      child: isLoading
                          ? SizedBox(
                              height: 20.r,
                              width: 20.r,
                              child: const CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Color(0xFF0F172A),
                              ),
                            )
                          : Text(
                              _isPlateLogin ? 'Plate Log In' : 'Log In',
                              style: TextStyle(
                                fontSize: 14.sp,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.3,
                              ),
                            ),
                    ),
                  ),
                  SizedBox(height: 24.h),

                  // ── Register Now Footer Link ─────────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Don't have an account? ",
                        style: TextStyle(
                          fontSize: 13.sp,
                          color: const Color(0xE6DDD6FE), // violet-200/90
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.of(context).pushNamed(AppRouter.register);
                        },
                        child: Text(
                          'Register Now',
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
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
