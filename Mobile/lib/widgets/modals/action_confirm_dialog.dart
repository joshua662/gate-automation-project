import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

/// Reusable dark-glass action confirmation dialog matching Client's
/// modal design language.
///
/// Used for delete, logout, and other destructive/important confirmations.
/// Replaces the plain AlertDialog pattern with the premium glass style.
class ActionConfirmDialog extends StatefulWidget {
  final String title;
  final String message;
  final String confirmLabel;
  final String cancelLabel;
  final Color confirmColor;
  final IconData icon;

  const ActionConfirmDialog({
    super.key,
    required this.title,
    required this.message,
    this.confirmLabel = 'Confirm',
    this.cancelLabel = 'Cancel',
    this.confirmColor = const Color(0xFFEF4444), // red-500 by default
    this.icon = Icons.warning_amber_rounded,
  });

  /// Show the dialog and return `true` if confirmed, `false` / `null` if cancelled.
  static Future<bool?> show(
    BuildContext context, {
    required String title,
    required String message,
    String confirmLabel = 'Confirm',
    String cancelLabel = 'Cancel',
    Color confirmColor = const Color(0xFFEF4444),
    IconData icon = Icons.warning_amber_rounded,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withAlpha(180),
      builder: (ctx) {
        return ActionConfirmDialog(
          title: title,
          message: message,
          confirmLabel: confirmLabel,
          cancelLabel: cancelLabel,
          confirmColor: confirmColor,
          icon: icon,
        );
      },
    );
  }

  @override
  State<ActionConfirmDialog> createState() => _ActionConfirmDialogState();
}

class _ActionConfirmDialogState extends State<ActionConfirmDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;
  bool _isClosing = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );

    // Client's modal-panel-in: cubic-bezier(0.34, 1.56, 0.64, 1)
    _scaleAnim = Tween<double>(begin: 0.92, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Cubic(0.34, 1.56, 0.64, 1.0),
      ),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);

    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _animateAndPop(bool result) async {
    if (_isClosing) return;
    _isClosing = true;
    await _animController.reverse();
    if (mounted) Navigator.of(context).pop(result);
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
              insetPadding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24.r),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 28.w, vertical: 32.h),
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
                        // ── Icon ──────────────────────────────────────────────
                        Container(
                          width: 60.r,
                          height: 60.r,
                          decoration: BoxDecoration(
                            color: widget.confirmColor.withAlpha(30),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            widget.icon,
                            color: widget.confirmColor,
                            size: 30.r,
                          ),
                        ),
                        SizedBox(height: 18.h),

                        // ── Title ─────────────────────────────────────────────
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

                        // ── Message ───────────────────────────────────────────
                        Text(
                          widget.message,
                          style: TextStyle(
                            fontSize: 13.5.sp,
                            color: const Color(0xFFA1A1AA), // zinc-400
                            height: 1.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 28.h),

                        // ── Buttons ───────────────────────────────────────────
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => _animateAndPop(true),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: widget.confirmColor,
                              foregroundColor: Colors.white,
                              elevation: 6,
                              padding: EdgeInsets.symmetric(vertical: 14.h),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(30.r),
                              ),
                            ),
                            child: Text(
                              widget.confirmLabel,
                              style: TextStyle(
                                fontSize: 14.sp,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                        SizedBox(height: 14.h),
                        GestureDetector(
                          onTap: () => _animateAndPop(false),
                          child: Text(
                            widget.cancelLabel,
                            style: TextStyle(
                              fontSize: 13.5.sp,
                              color: const Color(0xFFA1A1AA),
                              fontWeight: FontWeight.w500,
                            ),
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
