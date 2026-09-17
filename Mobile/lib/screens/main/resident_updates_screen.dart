import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/update_request_model.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/animated_list_item.dart';

class ResidentUpdatesScreen extends ConsumerStatefulWidget {
  const ResidentUpdatesScreen({super.key});

  @override
  ConsumerState<ResidentUpdatesScreen> createState() =>
      _ResidentUpdatesScreenState();
}

class _ResidentUpdatesScreenState
    extends ConsumerState<ResidentUpdatesScreen> {
  final _guestNameCtrl = TextEditingController();
  final _guestPlateCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();

  bool _isSubmitting = false;

  @override
  void dispose() {
    _guestNameCtrl.dispose();
    _guestPlateCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitGuestAccess() async {
    if (_guestNameCtrl.text.trim().isEmpty) {
      ToastHelper.showError(context, 'Guest name is required');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final service = ref.read(residentServiceProvider);
      await service.submitUpdateRequest({
        'request_type': 'guest_access',
        'guest_name': _guestNameCtrl.text.trim(),
        'guest_plate_number': _guestPlateCtrl.text.trim().toUpperCase(),
        'access_reason': _reasonCtrl.text.trim().isEmpty
            ? 'Visitor Access'
            : _reasonCtrl.text.trim(),
      });

      _guestNameCtrl.clear();
      _guestPlateCtrl.clear();
      _reasonCtrl.clear();

      if (mounted) {
        ToastHelper.showSuccess(context, 'Guest access request submitted!');
      }
      // ignore: unused_result
      ref.refresh(myUpdateRequestsProvider);
    } on DioException catch (e) {
      String msg = 'Failed to submit request';
      dynamic data = e.response?.data;
      if (data is Map) {
        if (data['errors'] != null && data['errors'] is Map) {
          final errors = data['errors'] as Map;
          final messages = <String>[];
          errors.forEach((key, val) {
            if (val is List && val.isNotEmpty) {
              messages.add(val.first.toString());
            } else if (val != null) {
              messages.add(val.toString());
            }
          });
          if (messages.isNotEmpty) {
            msg = messages.join('\n');
          }
        } else if (data['message'] != null) {
          msg = data['message'].toString();
        }
      }
      if (mounted) ToastHelper.showError(context, msg);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(myUpdateRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Update Requests & Guest Passes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.refresh(myUpdateRequestsProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(myUpdateRequestsProvider),
        child: ListView(
          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
          children: [
          // ── Guest Access Pass Form Card ─────────────────────────────
          Container(
            padding: EdgeInsets.all(16.r),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(
                color: AppColors.primary.withAlpha(50),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(10),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.directions_car_rounded,
                        color: AppColors.primary, size: 22.r),
                    SizedBox(width: 8.w),
                    Text(
                      'Request Guest Access Pass',
                      style: TextStyle(
                        fontSize: 16.sp,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 12.h),
                TextField(
                  controller: _guestNameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Guest Name',
                    hintText: 'John Visitor',
                    prefixIcon: Icon(Icons.person_outline, size: 18),
                  ),
                ),
                SizedBox(height: 10.h),
                TextField(
                  controller: _guestPlateCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Guest Plate Number',
                    hintText: 'ABC 9999',
                    prefixIcon: Icon(Icons.badge_outlined, size: 18),
                  ),
                ),
                SizedBox(height: 10.h),
                TextField(
                  controller: _reasonCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Reason for Visit',
                    hintText: 'Family gathering / Delivery',
                    prefixIcon: Icon(Icons.notes_rounded, size: 18),
                  ),
                ),
                SizedBox(height: 16.h),
                SizedBox(
                  width: double.infinity,
                  height: 46.h,
                  child: ElevatedButton.icon(
                    onPressed: _isSubmitting ? null : _submitGuestAccess,
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 18),
                    label: Text(_isSubmitting ? 'Submitting...' : 'Submit Pass'),
                  ),
                ),
              ],
            ),
          ),

          SizedBox(height: 24.h),

          Text(
            'My Request History',
            style: TextStyle(
              fontSize: 16.sp,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 10.h),

          // ── Requests History List ─────────────────────────────────────
          requestsAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (e, _) => Center(child: Text('Failed to load history: $e')),
            data: (requests) {
              if (requests.isEmpty) {
                return Padding(
                  padding: EdgeInsets.only(top: 24.h),
                  child: Center(
                    child: Text(
                      'No past requests found',
                      style: TextStyle(
                        fontSize: 13.sp,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                );
              }

              return Column(
                children: List.generate(requests.length, (i) {
                  final req = requests[i];
                  return AnimatedListItem(
                    index: i,
                    staggerDelay: const Duration(milliseconds: 55),
                    child: _RequestTile(
                      req: req,
                      onTap: () => _showTicketDialog(context, req),
                    ),
                  );
                }),
              );
            },
          ),
        ],
      ),
    ),
    );
  }

  void _showTicketDialog(BuildContext context, UpdateRequestModel req) {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Ticket',
      barrierColor: Colors.black.withAlpha(180),
      transitionDuration: const Duration(milliseconds: 280),
      transitionBuilder: (ctx, animation, _, child) {
        final curve = CurvedAnimation(
          parent: animation,
          curve: const Cubic(0.34, 1.56, 0.64, 1.0),
          reverseCurve: Curves.easeIn,
        );
        return FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.92, end: 1.0).animate(curve),
            child: child,
          ),
        );
      },
      pageBuilder: (ctx, _, __) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 24.h),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(24.r),
            border: Border.all(
              color: req.isApproved
                  ? AppColors.success
                  : req.isRejected
                      ? AppColors.error
                      : AppColors.warning,
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: (req.isApproved
                        ? AppColors.success
                        : req.isRejected
                            ? AppColors.error
                            : AppColors.warning)
                    .withAlpha(60),
                blurRadius: 24,
                spreadRadius: 2,
              ),
            ],
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Ticket Header
                Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
                  decoration: BoxDecoration(
                    color: (req.isApproved
                            ? AppColors.success
                            : req.isRejected
                                ? AppColors.error
                                : AppColors.warning)
                        .withAlpha(25),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(22.r),
                      topRight: Radius.circular(22.r),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        req.isApproved
                            ? Icons.verified_rounded
                            : req.isRejected
                                ? Icons.cancel_rounded
                                : Icons.access_time_filled_rounded,
                        color: req.isApproved
                            ? AppColors.success
                            : req.isRejected
                                ? AppColors.error
                                : AppColors.warning,
                        size: 24.r,
                      ),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: Text(
                          req.isGuestAccess
                              ? 'GUEST GATE ENTRY TICKET'
                              : 'GUEST GATE ACCESS PASS',
                          style: TextStyle(
                            fontSize: 14.sp,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),

                Padding(
                  padding: EdgeInsets.all(20.r),
                  child: Column(
                    children: [
                      // Status Badge
                      Container(
                        padding: EdgeInsets.symmetric(
                            horizontal: 16.w, vertical: 6.h),
                        decoration: BoxDecoration(
                          color: (req.isApproved
                                  ? AppColors.success
                                  : req.isRejected
                                      ? AppColors.error
                                      : AppColors.warning)
                              .withAlpha(40),
                          borderRadius: BorderRadius.circular(20.r),
                          border: Border.all(
                            color: (req.isApproved
                                ? AppColors.success
                                : req.isRejected
                                    ? AppColors.error
                                    : AppColors.warning),
                          ),
                        ),
                        child: Text(
                          req.isApproved
                              ? '✓ PASS APPROVED - VALID FOR ENTRY'
                              : req.isRejected
                                  ? '✕ ACCESS REQUEST REJECTED'
                                  : '⏳ PENDING GUARD REVIEW',
                          style: TextStyle(
                            fontSize: 12.sp,
                            fontWeight: FontWeight.bold,
                            color: req.isApproved
                                ? AppColors.success
                                : req.isRejected
                                    ? AppColors.error
                                    : AppColors.warning,
                          ),
                        ),
                      ),

                      SizedBox(height: 20.h),

                      // Ticket Pass Details Box
                      Container(
                        padding: EdgeInsets.all(16.r),
                        decoration: BoxDecoration(
                          color: Colors.white.withAlpha(8),
                          borderRadius: BorderRadius.circular(16.r),
                          border: Border.all(color: Colors.white.withAlpha(20)),
                        ),
                        child: Column(
                          children: [
                            _TicketRow(
                              label: 'Guest Name',
                              value: req.guestName ?? 'Resident Request',
                              bold: true,
                            ),
                            Divider(color: Colors.white12, height: 16.h),
                            _TicketRow(
                              label: 'Vehicle Plate',
                              value: req.guestPlateNumber ?? 'N/A',
                              badge: true,
                            ),
                            Divider(color: Colors.white12, height: 16.h),
                            _TicketRow(
                              label: 'Reason for Visit',
                              value: req.accessReason ?? 'Visitor Access',
                            ),
                            Divider(color: Colors.white12, height: 16.h),
                            _TicketRow(
                              label: 'Pass Reference',
                              value: '#GP-${req.id}',
                            ),
                            Divider(color: Colors.white12, height: 16.h),
                            _TicketRow(
                              label: 'Requested On',
                              value: req.createdAt.split('.').first,
                            ),
                          ],
                        ),
                      ),

                      SizedBox(height: 20.h),

                      // Simulated Barcode / QR section for Guard Verification
                      Container(
                        width: double.infinity,
                        padding: EdgeInsets.symmetric(
                            horizontal: 16.w, vertical: 12.h),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12.r),
                        ),
                        child: Column(
                          children: [
                            Icon(Icons.qr_code_2_rounded,
                                size: 72.r, color: Colors.black),
                            SizedBox(height: 4.h),
                            Text(
                              'SHOW THIS PASS TO GATE SECURITY',
                              style: TextStyle(
                                fontSize: 10.sp,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                      ),

                      SizedBox(height: 16.h),

                      SizedBox(
                        width: double.infinity,
                        height: 44.h,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12.r),
                            ),
                          ),
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Close Ticket',
                              style: TextStyle(color: Colors.white)),
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
    );
  }
}

class _TicketRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final bool badge;

  const _TicketRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.badge = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.sp,
            color: Colors.white60,
          ),
        ),
        badge
            ? Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(40),
                  borderRadius: BorderRadius.circular(6.r),
                  border: Border.all(color: AppColors.primary.withAlpha(80)),
                ),
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: 12.sp,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
              )
            : Text(
                value,
                style: TextStyle(
                  fontSize: 12.sp,
                  fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                  color: Colors.white,
                ),
              ),
      ],
    );
  }
}

class _RequestTile extends StatelessWidget {
  final UpdateRequestModel req;
  final VoidCallback onTap;

  const _RequestTile({required this.req, required this.onTap});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusText;
    switch (req.status.toLowerCase()) {
      case 'approved':
        statusColor = AppColors.success;
        statusText = 'APPROVED';
        break;
      case 'rejected':
        statusColor = AppColors.error;
        statusText = 'REJECTED';
        break;
      default:
        statusColor = AppColors.warning;
        statusText = 'PENDING';
    }

    final gName = req.guestName;
    final gPlate = req.guestPlateNumber;
    final String displayName;
    if (gName != null && gName.isNotEmpty) {
      displayName = 'Guest Pass: $gName';
    } else if (gPlate != null && gPlate.isNotEmpty) {
      displayName = 'Guest Pass ($gPlate)';
    } else {
      displayName = 'Guest Access Ticket Pass';
    }

    return Container(
      margin: EdgeInsets.only(bottom: 10.h),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(
          color: statusColor.withAlpha(60),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(15),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16.r),
        child: InkWell(
          borderRadius: BorderRadius.circular(16.r),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.all(14.r),
            child: Row(
              children: [
                // Pass Icon Badge
                Container(
                  width: 42.r,
                  height: 42.r,
                  decoration: BoxDecoration(
                    color: statusColor.withAlpha(25),
                    borderRadius: BorderRadius.circular(12.r),
                    border: Border.all(color: statusColor.withAlpha(60)),
                  ),
                  child: Icon(
                    req.isGuestAccess
                        ? Icons.confirmation_number_outlined
                        : Icons.person_outline,
                    color: statusColor,
                    size: 22.r,
                  ),
                ),
                SizedBox(width: 12.w),

                // Pass Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              displayName,
                              style: TextStyle(
                                fontSize: 14.sp,
                                fontWeight: FontWeight.bold,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 4.h),
                      Row(
                        children: [
                          if (req.guestPlateNumber != null &&
                              req.guestPlateNumber!.isNotEmpty) ...[
                            Container(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 6.w, vertical: 1.h),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withAlpha(30),
                                borderRadius: BorderRadius.circular(4.r),
                              ),
                              child: Text(
                                req.guestPlateNumber!,
                                style: TextStyle(
                                  fontSize: 10.sp,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                            SizedBox(width: 8.w),
                          ],
                          Text(
                            req.createdAt.split('.').first,
                            style: TextStyle(
                              fontSize: 11.sp,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                SizedBox(width: 8.w),

                // Status Badge & View Ticket Icon
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                          horizontal: 10.w, vertical: 4.h),
                      decoration: BoxDecoration(
                        color: statusColor.withAlpha(25),
                        borderRadius: BorderRadius.circular(20.r),
                        border: Border.all(color: statusColor.withAlpha(80)),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(
                          fontSize: 10.sp,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'View Pass',
                          style: TextStyle(
                            fontSize: 10.sp,
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 14.r,
                          color: AppColors.primary,
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
