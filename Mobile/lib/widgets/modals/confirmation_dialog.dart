import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

class ConfirmationDialog extends StatefulWidget {
  final bool isOpen;
  final String email;
  final bool loading;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  const ConfirmationDialog({
    super.key,
    required this.isOpen,
    required this.email,
    required this.loading,
    required this.onCancel,
    required this.onConfirm,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String email,
    Future<void> Function()? onConfirm,
  }) async {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withAlpha(180),
      builder: (ctx) {
        return _ConfirmationDialogContent(
          email: email,
          onConfirm: onConfirm,
        );
      },
    );
  }

  @override
  State<ConfirmationDialog> createState() => _ConfirmationDialogState();
}

class _ConfirmationDialogState extends State<ConfirmationDialog> {
  @override
  Widget build(BuildContext context) {
    if (!widget.isOpen) return const SizedBox.shrink();
    return _ConfirmationDialogContent(
      email: widget.email,
      onConfirm: () async {
        widget.onConfirm();
      },
      onCancelOverride: widget.onCancel,
    );
  }
}

class _ConfirmationDialogContent extends StatefulWidget {
  final String email;
  final Future<void> Function()? onConfirm;
  final VoidCallback? onCancelOverride;

  const _ConfirmationDialogContent({
    required this.email,
    this.onConfirm,
    this.onCancelOverride,
  });

  @override
  State<_ConfirmationDialogContent> createState() => _ConfirmationDialogContentState();
}

class _ConfirmationDialogContentState extends State<_ConfirmationDialogContent>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;
  bool _isLoading = false;
  bool _isClosing = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _scaleAnim = Tween<double>(begin: 0.92, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: const Cubic(0.34, 1.56, 0.64, 1)),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _handleCancel() async {
    if (_isLoading || _isClosing) return;
    _isClosing = true;
    await _animController.reverse();
    if (!mounted) return;
    if (widget.onCancelOverride != null) {
      widget.onCancelOverride!();
    } else {
      Navigator.of(context).pop(false);
    }
  }

  Future<void> _handleConfirm() async {
    if (_isLoading || _isClosing) return;
    setState(() => _isLoading = true);
    try {
      if (widget.onConfirm != null) {
        await widget.onConfirm!();
      }
      if (mounted) {
        _isClosing = true;
        await _animController.reverse();
        if (mounted) Navigator.of(context).pop(true);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animController,
      builder: (context, child) {
        return FadeTransition(
          opacity: _fadeAnim,
          child: ScaleTransition(
            scale: _scaleAnim,
            child: Dialog(
              backgroundColor: Colors.transparent,
              elevation: 0,
              insetPadding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 24.h),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24.r),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 32.h),
                    decoration: BoxDecoration(
                      color: const Color(0xED1E1E24), // #1e1e24 with opacity
                      borderRadius: BorderRadius.circular(24.r),
                      border: Border.all(
                        color: Colors.white.withAlpha(25),
                        width: 1,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x8C000000),
                          blurRadius: 32,
                          offset: Offset(0, 16),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // ── Envelope Icon with Checkmark Badge ────────────────
                        SizedBox(
                          height: 72.r,
                          width: 72.r,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 64.r,
                                height: 64.r,
                                decoration: const BoxDecoration(
                                  color: Color(0x269CA3AF),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.mark_email_unread_outlined,
                                  color: const Color(0xFFD4D4D8),
                                  size: 34.r,
                                ),
                              ),
                              Positioned(
                                top: 0,
                                right: 0,
                                child: Container(
                                  width: 26.r,
                                  height: 26.r,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF18181B),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFF1E1E24),
                                      width: 2,
                                    ),
                                  ),
                                  child: Icon(
                                    Icons.check_circle,
                                    color: const Color(0xFF10B981), // emerald-500
                                    size: 20.r,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: 16.h),

                        // ── Title & Message ────────────────────────────────────
                        Text(
                          'Confirm registration!',
                          style: TextStyle(
                            fontSize: 20.sp,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 12.h),
                        RichText(
                          textAlign: TextAlign.center,
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 13.5.sp,
                              color: const Color(0xFFA1A1AA),
                              height: 1.5,
                              fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
                            ),
                            children: [
                              const TextSpan(
                                text: 'Create this account and send the generated username and password to ',
                              ),
                              TextSpan(
                                text: widget.email.isEmpty ? 'your email' : widget.email,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const TextSpan(text: '?'),
                            ],
                          ),
                        ),
                        SizedBox(height: 28.h),

                        // ── Buttons ───────────────────────────────────────────
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _handleConfirm,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF7C3AED), // violet-600
                              foregroundColor: Colors.white,
                              elevation: 6,
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
                                : Text(
                                    'Confirm registration',
                                    style: TextStyle(
                                      fontSize: 14.sp,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                          ),
                        ),
                        SizedBox(height: 14.h),
                        GestureDetector(
                          onTap: _handleCancel,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.chevron_left,
                                color: const Color(0xFFA1A1AA),
                                size: 18.r,
                              ),
                              Text(
                                'Review details',
                                style: TextStyle(
                                  fontSize: 13.5.sp,
                                  color: const Color(0xFFA1A1AA),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
