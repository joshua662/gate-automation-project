import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

class SuccessModal extends StatefulWidget {
  final String title;
  final String message;
  final String? secondaryMessage;
  final VoidCallback? onClose;
  final Duration autoDismissDuration;

  const SuccessModal({
    super.key,
    required this.title,
    required this.message,
    this.secondaryMessage,
    this.onClose,
    this.autoDismissDuration = const Duration(seconds: 3),
  });

  static Future<void> show(
    BuildContext context, {
    required String title,
    required String message,
    String? secondaryMessage,
    Duration autoDismissDuration = const Duration(seconds: 3),
  }) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withAlpha(180),
      builder: (ctx) {
        return SuccessModal(
          title: title,
          message: message,
          secondaryMessage: secondaryMessage,
          autoDismissDuration: autoDismissDuration,
          onClose: () => Navigator.of(ctx).pop(),
        );
      },
    );
  }

  @override
  State<SuccessModal> createState() => _SuccessModalState();
}

class _SuccessModalState extends State<SuccessModal>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;
  Timer? _dismissTimer;
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

    if (widget.autoDismissDuration > Duration.zero) {
      _dismissTimer = Timer(widget.autoDismissDuration, () {
        if (mounted) {
          _close();
        }
      });
    }
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _close() async {
    if (_isClosing) return;
    _isClosing = true;
    await _animController.reverse();
    if (!mounted) return;
    if (widget.onClose != null) {
      widget.onClose!();
    } else {
      Navigator.of(context).pop();
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
                  filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 32.h),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0xB3141030), // rgba(20,16,48,0.7)
                          Color(0xCC0E0C24), // rgba(14,12,36,0.8)
                        ],
                      ),
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
                        // ── Envelope Icon with Emerald Checkmark Badge ───────
                        SizedBox(
                          height: 80.r,
                          width: 80.r,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 70.r,
                                height: 70.r,
                                decoration: const BoxDecoration(
                                  color: Color(0x1AE4E4E7),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.mark_email_read_outlined,
                                  color: const Color(0xFFE4E4E7),
                                  size: 38.r,
                                ),
                              ),
                              Positioned(
                                top: 0,
                                right: 0,
                                child: Container(
                                  width: 28.r,
                                  height: 28.r,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF13112A),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFF13112A),
                                      width: 2.5,
                                    ),
                                  ),
                                  child: Icon(
                                    Icons.check_circle_rounded,
                                    color: const Color(0xFF10B981), // emerald-500
                                    size: 22.r,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: 18.h),

                        // ── Title & Message ────────────────────────────────────
                        Text(
                          widget.title,
                          style: TextStyle(
                            fontSize: 20.sp,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: -0.3,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 10.h),
                        Text(
                          widget.message,
                          style: TextStyle(
                            fontSize: 13.5.sp,
                            color: const Color(0xD9D4D4D8),
                            height: 1.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        if (widget.secondaryMessage != null) ...[
                          SizedBox(height: 8.h),
                          Text(
                            widget.secondaryMessage!,
                            style: TextStyle(
                              fontSize: 12.5.sp,
                              color: const Color(0x99A1A1AA),
                              height: 1.4,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
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
