import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/gate_log_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/resident_provider.dart';

enum ResidentModalType { notifications, logs, guest, profile, none }

class ResidentHomeScreen extends ConsumerStatefulWidget {
  final Function(int)? onNavigateTab;

  const ResidentHomeScreen({super.key, this.onNavigateTab});

  @override
  ConsumerState<ResidentHomeScreen> createState() => _ResidentHomeScreenState();
}

class _ResidentHomeScreenState extends ConsumerState<ResidentHomeScreen> {
  ResidentModalType _activeModal = ResidentModalType.none;
  late Timer _clockTimer;
  DateTime _currentTime = DateTime.now();

  // Guest Access Form controllers
  final _guestFormKey = GlobalKey<FormState>();
  final _guestNameCtrl = TextEditingController();
  final _guestAgeCtrl = TextEditingController();
  final _guestContactCtrl = TextEditingController();
  final _guestAddressCtrl = TextEditingController();
  final _guestPlateCtrl = TextEditingController();
  final _guestModelCtrl = TextEditingController();
  final _guestColorCtrl = TextEditingController();
  final _guestDateCtrl = TextEditingController();
  final _guestReasonCtrl = TextEditingController();
  bool _isSubmittingGuest = false;

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _currentTime = DateTime.now();
        });
      }
    });
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    _guestNameCtrl.dispose();
    _guestAgeCtrl.dispose();
    _guestContactCtrl.dispose();
    _guestAddressCtrl.dispose();
    _guestPlateCtrl.dispose();
    _guestModelCtrl.dispose();
    _guestColorCtrl.dispose();
    _guestDateCtrl.dispose();
    _guestReasonCtrl.dispose();
    super.dispose();
  }

  void _openModal(ResidentModalType type) {
    setState(() => _activeModal = type);
  }

  void _closeModal() {
    setState(() => _activeModal = ResidentModalType.none);
  }

  Future<void> _submitGuestAccess() async {
    if (!(_guestFormKey.currentState?.validate() ?? false)) return;

    setState(() => _isSubmittingGuest = true);
    try {
      final service = ref.read(residentServiceProvider);
      await service.submitUpdateRequest({
        'request_type': 'guest_access',
        'guest_name': _guestNameCtrl.text.trim(),
        if (_guestAgeCtrl.text.trim().isNotEmpty)
          'guest_age': _guestAgeCtrl.text.trim(),
        'guest_contact_number': _guestContactCtrl.text.trim(),
        if (_guestAddressCtrl.text.trim().isNotEmpty)
          'guest_address': _guestAddressCtrl.text.trim(),
        'guest_plate_number': _guestPlateCtrl.text.trim().toUpperCase(),
        'guest_car_model': _guestModelCtrl.text.trim(),
        if (_guestColorCtrl.text.trim().isNotEmpty)
          'guest_car_color': _guestColorCtrl.text.trim(),
        'access_date': _guestDateCtrl.text.trim(),
        'access_reason': _guestReasonCtrl.text.trim(),
      });

      _guestNameCtrl.clear();
      _guestAgeCtrl.clear();
      _guestContactCtrl.clear();
      _guestAddressCtrl.clear();
      _guestPlateCtrl.clear();
      _guestModelCtrl.clear();
      _guestColorCtrl.clear();
      _guestDateCtrl.clear();
      _guestReasonCtrl.clear();

      ref.invalidate(myUpdateRequestsProvider);

      if (mounted) {
        ToastHelper.showSuccess(
          context,
          'Guest access request submitted for admin review.',
        );
      }
    } catch (e) {
      if (mounted) {
        ToastHelper.showError(
          context,
          'Failed to submit guest access request.',
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmittingGuest = false);
    }
  }

  String _formatDateTime(DateTime dt) {
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final dayStr = days[dt.weekday % 7];
    final monthStr = months[dt.month - 1];
    final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    final minuteStr = dt.minute.toString().padLeft(2, '0');
    final secondStr = dt.second.toString().padLeft(2, '0');

    return '$dayStr, $monthStr ${dt.day}, ${dt.year} • $hour:$minuteStr:$secondStr $ampm';
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final monthStr = months[dt.month - 1];
      final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      final minStr = dt.minute.toString().padLeft(2, '0');
      return '$monthStr ${dt.day}, ${dt.year} at $hour:$minStr $ampm';
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authProvider);
    final logsAsync = ref.watch(myGateLogsProvider);
    final notifsAsync = ref.watch(notificationsProvider);
    final requestsAsync = ref.watch(myUpdateRequestsProvider);

    return Scaffold(
      body: authAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (user) {
          final logs = logsAsync.value ?? [];
          final notifs = notifsAsync.value ?? [];
          final requests = requestsAsync.value ?? [];

          final lastEntry = logs.firstWhere(
            (l) => l.direction == 'IN',
            orElse: () => GateLogModel(
              id: 0,
              loggedAt: '',
              status: '',
              direction: '',
            ),
          );
          final lastExit = logs.firstWhere(
            (l) => l.direction == 'OUT',
            orElse: () => GateLogModel(
              id: 0,
              loggedAt: '',
              status: '',
              direction: '',
            ),
          );
          final unauthorizedCount =
              logs.where((l) => l.status.toLowerCase() == 'unauthorized').length;

          return Stack(
            children: [
              RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(myGateLogsProvider);
                  ref.invalidate(notificationsProvider);
                  ref.invalidate(myUpdateRequestsProvider);
                },
                child: CustomScrollView(
                  slivers: [
                    // ── Header Banner with Clock ─────────────────────────────
                    SliverAppBar(
                      automaticallyImplyLeading: false,
                      expandedHeight: 180.h,
                      pinned: true,
                      elevation: 0,
                      backgroundColor: const Color(0xFF0A0E27),
                      flexibleSpace: FlexibleSpaceBar(
                        background: Container(
                          decoration: const BoxDecoration(
                            image: DecorationImage(
                              image: AssetImage('assets/images/subdivision-gate-background.png'),
                              fit: BoxFit.cover,
                            ),
                          ),
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.black.withAlpha(190),
                                  Colors.black.withAlpha(90),
                                  Colors.black.withAlpha(210),
                                ],
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                              ),
                            ),
                          child: SafeArea(
                            child: Padding(
                              padding: EdgeInsets.fromLTRB(20.w, 12.h, 20.w, 0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  // ── Top Row: Welcome + Clock Badge ─────────
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      // Left: Welcome back text
                                      Expanded(
                                        child: Text(
                                          'Welcome back,',
                                          style: TextStyle(
                                            fontSize: 14.sp,
                                            color: Colors.white60,
                                          ),
                                        ),
                                      ),
                                      // Right: Clock Badge
                                      Container(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 12.w,
                                          vertical: 8.h,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.black.withAlpha(80),
                                          borderRadius: BorderRadius.circular(16.r),
                                          border: Border.all(
                                            color: const Color(0xFFC5A073).withAlpha(120),
                                            width: 1.5,
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withAlpha(60),
                                              blurRadius: 8,
                                            ),
                                          ],
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              Icons.access_time_rounded,
                                              color: const Color(0xFFC5A073),
                                              size: 14.r,
                                            ),
                                            SizedBox(width: 6.w),
                                            Text(
                                              _formatDateTime(_currentTime),
                                              style: TextStyle(
                                                fontSize: 11.sp,
                                                fontFamily: 'monospace',
                                                color: const Color(0xFFF4F4F5),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  SizedBox(height: 4.h),
                                  // ── User Name ──────────────────────────────
                                  Text(
                                    user?.name ?? 'Resident',
                                    style: TextStyle(
                                      fontSize: 26.sp,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  SizedBox(height: 6.h),
                                  // ── Plate Badge ────────────────────────────
                                  if (user?.plateNumber != null)
                                    Container(
                                      padding: EdgeInsets.symmetric(
                                        horizontal: 10.w,
                                        vertical: 4.h,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withAlpha(40),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(
                                          color: Colors.white.withAlpha(60),
                                        ),
                                      ),
                                      child: Text(
                                        'Plate: ${user!.plateNumber!}',
                                        style: TextStyle(
                                          fontSize: 12.sp,
                                          color: Colors.white,
                                          fontWeight: FontWeight.w600,
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
                    ),

                    // ── Main Content ─────────────────────────────────────────
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 24.h),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          // ── 3 Summary Cards ──────────────────────────────
                          Row(
                            children: [
                              Expanded(
                                child: _SummaryCardTile(
                                  title: 'Last Entry',
                                  value: lastEntry.loggedAt.isNotEmpty
                                      ? lastEntry.loggedAt
                                      : 'No entries',
                                  badge: lastEntry.loggedAt.isNotEmpty ? 'AUTHORIZED' : null,
                                  badgeColor: const Color(0xFF10B981),
                                  icon: Icons.arrow_downward_rounded,
                                  iconColor: const Color(0xFF10B981),
                                ),
                              ),
                              SizedBox(width: 10.w),
                              Expanded(
                                child: _SummaryCardTile(
                                  title: 'Last Exit',
                                  value: lastExit.loggedAt.isNotEmpty
                                      ? lastExit.loggedAt
                                      : 'No exits',
                                  badge: lastExit.loggedAt.isNotEmpty ? 'AUTHORIZED' : null,
                                  badgeColor: const Color(0xFF3B82F6),
                                  icon: Icons.arrow_upward_rounded,
                                  iconColor: const Color(0xFF3B82F6),
                                ),
                              ),
                              SizedBox(width: 10.w),
                              Expanded(
                                child: _SummaryCardTile(
                                  title: 'Access Status',
                                  value: 'Authorized',
                                  subText: '${logs.length} accesses',
                                  badge: unauthorizedCount > 0
                                      ? '$unauthorizedCount alert'
                                      : null,
                                  badgeColor: const Color(0xFFEF4444),
                                  icon: Icons.lock_outline_rounded,
                                  iconColor: const Color(0xFF10B981),
                                ),
                              ),
                            ],
                          ),

                          SizedBox(height: 20.h),

                          // ── Quick Links Box ──────────────────────────────
                          Container(
                            padding: EdgeInsets.all(16.r),
                            decoration: BoxDecoration(
                              color: Theme.of(context).cardColor,
                              borderRadius: BorderRadius.circular(16.r),
                              border: Border.all(
                                color: Theme.of(context).dividerColor.withAlpha(40),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Quick Links',
                                  style: TextStyle(
                                    fontSize: 15.sp,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(height: 12.h),
                                Row(
                                  children: [
                                    Expanded(
                                      child: _QuickLinkAction(
                                        icon: Icons.assignment_outlined,
                                        title: 'Gate Logs',
                                        sub: 'IN/OUT history',
                                        color: const Color(0xFF3B82F6),
                                        onTap: () => _openModal(ResidentModalType.logs),
                                      ),
                                    ),
                                    SizedBox(width: 10.w),
                                    Expanded(
                                      child: _QuickLinkAction(
                                        icon: Icons.directions_car_outlined,
                                        title: 'Guest Access',
                                        sub: 'Request visitor access',
                                        color: const Color(0xFF7C3AED),
                                        onTap: () => _openModal(ResidentModalType.guest),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          SizedBox(height: 20.h),

                          // ── Recent Notifications Box ──────────────────────
                          Container(
                            padding: EdgeInsets.all(16.r),
                            decoration: BoxDecoration(
                              color: Theme.of(context).cardColor,
                              borderRadius: BorderRadius.circular(16.r),
                              border: Border.all(
                                color: Theme.of(context).dividerColor.withAlpha(40),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Recent Notifications',
                                      style: TextStyle(
                                        fontSize: 15.sp,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () => _openModal(ResidentModalType.notifications),
                                      child: Text(
                                        'View All',
                                        style: TextStyle(
                                          fontSize: 13.sp,
                                          fontWeight: FontWeight.w600,
                                          color: const Color(0xFF3B82F6),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                SizedBox(height: 12.h),

                                if (notifs.isEmpty)
                                  Padding(
                                    padding: EdgeInsets.symmetric(vertical: 20.h),
                                    child: Center(
                                      child: Text(
                                        'No notifications yet',
                                        style: TextStyle(
                                          fontSize: 13.sp,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                  )
                                else
                                  Column(
                                    children: notifs.take(3).map((notif) {
                                      return Container(
                                        margin: EdgeInsets.only(bottom: 8.h),
                                        padding: EdgeInsets.all(12.r),
                                        decoration: BoxDecoration(
                                          color: notif.isRead
                                              ? Theme.of(context).cardColor
                                              : const Color(0x1F3B82F6),
                                          borderRadius: BorderRadius.circular(10.r),
                                          border: Border(
                                            left: BorderSide(
                                              color: notif.isRead
                                                  ? Colors.grey.shade600
                                                  : const Color(0xFF3B82F6),
                                              width: 3.5,
                                            ),
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    notif.title.isNotEmpty
                                                        ? notif.title
                                                        : 'System Notification',
                                                    style: TextStyle(
                                                      fontSize: 13.sp,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                                if (!notif.isRead)
                                                  Container(
                                                    width: 8.r,
                                                    height: 8.r,
                                                    decoration: const BoxDecoration(
                                                      color: Color(0xFF3B82F6),
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                              ],
                                            ),
                                            SizedBox(height: 4.h),
                                            Text(
                                              notif.message,
                                              style: TextStyle(
                                                fontSize: 12.sp,
                                                color: AppColors.textSecondary,
                                                height: 1.3,
                                              ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ),
                              ],
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Interactive Dashboard Modals ───────────────────────────────

              // 1. Notifications Modal
              if (_activeModal == ResidentModalType.notifications)
                _DashboardModalShell(
                  title: 'Notifications',
                  onClose: _closeModal,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Subtitle + Mark All Read Row ──────────────
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: EdgeInsets.all(6.r),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF3B82F6).withAlpha(25),
                                  borderRadius: BorderRadius.circular(8.r),
                                ),
                                child: Icon(
                                  Icons.notifications_active_rounded,
                                  color: const Color(0xFF3B82F6),
                                  size: 14.r,
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Text(
                                'Security alerts & messages',
                                style: TextStyle(
                                  fontSize: 12.sp,
                                  color: const Color(0xFF8B949E),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                          if (notifs.isNotEmpty)
                            GestureDetector(
                              onTap: () async {
                                await ref
                                    .read(residentServiceProvider)
                                    .markAllNotificationsRead();
                                ref.invalidate(notificationsProvider);
                              },
                              child: Container(
                                padding: EdgeInsets.symmetric(
                                  horizontal: 10.w,
                                  vertical: 5.h,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF3B82F6).withAlpha(20),
                                  borderRadius: BorderRadius.circular(8.r),
                                  border: Border.all(
                                    color: const Color(0xFF3B82F6).withAlpha(50),
                                  ),
                                ),
                                child: Text(
                                  'Mark all read',
                                  style: TextStyle(
                                    fontSize: 11.sp,
                                    color: const Color(0xFF60A5FA),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      SizedBox(height: 14.h),
                      // ── Notification List or Empty State ──────────
                      ConstrainedBox(
                        constraints: BoxConstraints(maxHeight: 400.h),
                        child: notifs.isEmpty
                            ? Container(
                                width: double.infinity,
                                padding: EdgeInsets.symmetric(
                                  vertical: 40.h,
                                  horizontal: 20.w,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF13171F),
                                  borderRadius: BorderRadius.circular(14.r),
                                  border: Border.all(
                                    color: Colors.white.withAlpha(15),
                                  ),
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      padding: EdgeInsets.all(14.r),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withAlpha(8),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        Icons.notifications_off_rounded,
                                        color: const Color(0xFF6E7681),
                                        size: 28.r,
                                      ),
                                    ),
                                    SizedBox(height: 12.h),
                                    Text(
                                      "You're all caught up!",
                                      style: TextStyle(
                                        fontSize: 14.sp,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white,
                                      ),
                                    ),
                                    SizedBox(height: 4.h),
                                    Text(
                                      'No new notifications at this time.',
                                      style: TextStyle(
                                        fontSize: 12.sp,
                                        color: const Color(0xFF8B949E),
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                itemCount: notifs.length,
                                itemBuilder: (ctx, i) {
                                  final item = notifs[i];
                                  return Container(
                                    margin: EdgeInsets.only(bottom: 8.h),
                                    padding: EdgeInsets.all(14.r),
                                    decoration: BoxDecoration(
                                      color: item.isRead
                                          ? const Color(0xFF13171F)
                                          : const Color(0xFF171D29),
                                      borderRadius: BorderRadius.circular(12.r),
                                      border: Border.all(
                                        color: item.isRead
                                            ? Colors.white.withAlpha(15)
                                            : const Color(0xFF3B82F6).withAlpha(60),
                                      ),
                                    ),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          width: 34.r,
                                          height: 34.r,
                                          decoration: BoxDecoration(
                                            color: item.isRead
                                                ? Colors.white.withAlpha(12)
                                                : const Color(0xFF3B82F6).withAlpha(25),
                                            borderRadius: BorderRadius.circular(10.r),
                                          ),
                                          child: Icon(
                                            Icons.notifications_rounded,
                                            color: item.isRead
                                                ? const Color(0xFF8B949E)
                                                : const Color(0xFF3B82F6),
                                            size: 16.r,
                                          ),
                                        ),
                                        SizedBox(width: 12.w),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      item.title,
                                                      style: TextStyle(
                                                        fontSize: 13.sp,
                                                        fontWeight: item.isRead
                                                            ? FontWeight.w500
                                                            : FontWeight.w600,
                                                        color: Colors.white,
                                                      ),
                                                    ),
                                                  ),
                                                  if (!item.isRead)
                                                    Container(
                                                      width: 7.r,
                                                      height: 7.r,
                                                      margin: EdgeInsets.only(left: 8.w),
                                                      decoration: const BoxDecoration(
                                                        color: Color(0xFF3B82F6),
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                              SizedBox(height: 4.h),
                                              Text(
                                                item.message,
                                                style: TextStyle(
                                                  fontSize: 12.sp,
                                                  color: const Color(0xFF8B949E),
                                                  height: 1.35,
                                                ),
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              SizedBox(height: 6.h),
                                              Text(
                                                item.createdAt,
                                                style: TextStyle(
                                                  fontSize: 10.5.sp,
                                                  color: const Color(0xFF6E7681),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),

              // 2. Gate Logs Modal
              if (_activeModal == ResidentModalType.logs)
                _DashboardModalShell(
                  title: 'Gate Access Logs',
                  onClose: _closeModal,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _MiniStatPill(
                              label: 'Entries Today',
                              value: '${logs.where((l) => l.direction == 'IN').length}',
                              color: const Color(0xFF10B981),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            child: _MiniStatPill(
                              label: 'Exits Today',
                              value: '${logs.where((l) => l.direction == 'OUT').length}',
                              color: const Color(0xFF3B82F6),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            child: _MiniStatPill(
                              label: 'Unauthorized',
                              value: '$unauthorizedCount',
                              color: const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 14.h),
                      ConstrainedBox(
                        constraints: BoxConstraints(maxHeight: 380.h),
                        child: logs.isEmpty
                            ? Center(
                                child: Padding(
                                  padding: EdgeInsets.all(24.r),
                                  child: const Text('No gate logs found.'),
                                ),
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                itemCount: logs.length,
                                itemBuilder: (ctx, i) {
                                  final item = logs[i];
                                  final isEntry = item.direction == 'IN';
                                  return Container(
                                    margin: EdgeInsets.only(bottom: 8.h),
                                    padding: EdgeInsets.all(12.r),
                                    decoration: BoxDecoration(
                                      color: const Color(0x1F27272A),
                                      borderRadius: BorderRadius.circular(10.r),
                                      border: Border.all(
                                        color: Colors.white.withAlpha(15),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: EdgeInsets.all(8.r),
                                          decoration: BoxDecoration(
                                            color: (isEntry
                                                    ? const Color(0xFF10B981)
                                                    : const Color(0xFF3B82F6))
                                                .withAlpha(30),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            isEntry
                                                ? Icons.arrow_downward_rounded
                                                : Icons.arrow_upward_rounded,
                                            color: isEntry
                                                ? const Color(0xFF10B981)
                                                : const Color(0xFF3B82F6),
                                            size: 16.r,
                                          ),
                                        ),
                                        SizedBox(width: 12.w),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                isEntry ? 'Entry Log' : 'Exit Log',
                                                style: TextStyle(
                                                  fontSize: 13.sp,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                ),
                                              ),
                                              SizedBox(height: 2.h),
                                              Text(
                                                item.loggedAt,
                                                style: TextStyle(
                                                  fontSize: 11.sp,
                                                  color: const Color(0xFFA1A1AA),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if (item.plateNumber != null)
                                          Text(
                                            item.plateNumber!,
                                            style: TextStyle(
                                              fontSize: 12.sp,
                                              fontFamily: 'monospace',
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),

              // 3. Guest Access Modal
              if (_activeModal == ResidentModalType.guest)
                _DashboardModalShell(
                  title: 'Guest Access Request',
                  onClose: _closeModal,
                  child: SingleChildScrollView(
                    child: Form(
                      key: _guestFormKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Host Info Box
                          Container(
                            padding: EdgeInsets.all(12.r),
                            decoration: BoxDecoration(
                              color: const Color(0x263B82F6),
                              borderRadius: BorderRadius.circular(10.r),
                              border: Border.all(
                                color: const Color(0xFF3B82F6).withAlpha(60),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.person_pin_rounded,
                                  color: const Color(0xFF60A5FA),
                                  size: 20.r,
                                ),
                                SizedBox(width: 10.w),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Host: ${user?.name ?? ""}',
                                      style: TextStyle(
                                        fontSize: 12.sp,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    if (user?.plateNumber != null)
                                      Text(
                                        'Plate: ${user!.plateNumber!}',
                                        style: TextStyle(
                                          fontSize: 11.sp,
                                          color: const Color(0xFF93C5FD),
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          SizedBox(height: 14.h),

                          _ModalSectionHeading(title: 'Guest Vehicle Owner'),
                          SizedBox(height: 8.h),
                          _DarkModalInput(
                            label: 'Guest Name *',
                            controller: _guestNameCtrl,
                            hint: 'Full name of visitor',
                            required: true,
                          ),
                          SizedBox(height: 8.h),
                          _DarkModalInput(
                            label: 'Guest Contact Number *',
                            controller: _guestContactCtrl,
                            hint: '09123456789',
                            required: true,
                            maxLength: 11,
                            keyboardType: TextInputType.phone,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(11),
                            ],
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) {
                                return 'Required';
                              }
                              if (v.trim().length != 11) {
                                return 'Contact number must be 11 digits';
                              }
                              return null;
                            },
                          ),
                          SizedBox(height: 14.h),

                          _ModalSectionHeading(title: 'Guest Vehicle Details'),
                          SizedBox(height: 8.h),
                          Row(
                            children: [
                              Expanded(
                                child: _DarkModalInput(
                                  label: 'Plate Number *',
                                  controller: _guestPlateCtrl,
                                  hint: 'ABC 1234',
                                  required: true,
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Expanded(
                                child: _DarkModalInput(
                                  label: 'Car Model *',
                                  controller: _guestModelCtrl,
                                  hint: 'Toyota Vios',
                                  required: true,
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 14.h),

                          _ModalSectionHeading(title: 'Access Details'),
                          SizedBox(height: 8.h),
                          _DarkModalInput(
                            label: 'Access Date (YYYY-MM-DD) *',
                            controller: _guestDateCtrl,
                            hint: '2026-07-28',
                            required: true,
                          ),
                          SizedBox(height: 8.h),
                          _DarkModalInput(
                            label: 'Reason for Access *',
                            controller: _guestReasonCtrl,
                            hint: 'Family visit, delivery, etc.',
                            required: true,
                          ),
                          SizedBox(height: 18.h),

                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: _isSubmittingGuest ? null : _submitGuestAccess,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF7C3AED),
                                foregroundColor: Colors.white,
                                padding: EdgeInsets.symmetric(vertical: 13.h),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24.r),
                                ),
                              ),
                              child: _isSubmittingGuest
                                  ? SizedBox(
                                      height: 18.r,
                                      width: 18.r,
                                      child: const CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text(
                                      'Submit Guest Access Request',
                                      style: TextStyle(
                                        fontSize: 13.sp,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ),

                          if (requests.isNotEmpty) ...[
                            SizedBox(height: 20.h),
                            _ModalSectionHeading(title: 'Past Guest Requests'),
                            SizedBox(height: 8.h),
                            ...requests.take(3).map((req) {
                              final isApproved = req.isApproved;
                              final isRejected = req.isRejected;
                              return Container(
                                margin: EdgeInsets.only(bottom: 6.h),
                                padding: EdgeInsets.all(10.r),
                                decoration: BoxDecoration(
                                  color: const Color(0x1F27272A),
                                  borderRadius: BorderRadius.circular(8.r),
                                ),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Request #${req.id}',
                                      style: TextStyle(
                                        fontSize: 12.sp,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Container(
                                      padding: EdgeInsets.symmetric(
                                        horizontal: 8.w,
                                        vertical: 2.h,
                                      ),
                                      decoration: BoxDecoration(
                                        color: (isApproved
                                                ? const Color(0xFF10B981)
                                                : isRejected
                                                    ? const Color(0xFFEF4444)
                                                    : const Color(0xFFF59E0B))
                                            .withAlpha(40),
                                        borderRadius:
                                            BorderRadius.circular(12.r),
                                      ),
                                      child: Text(
                                        req.status.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 10.sp,
                                          fontWeight: FontWeight.bold,
                                          color: isApproved
                                              ? const Color(0xFF10B981)
                                              : isRejected
                                                  ? const Color(0xFFEF4444)
                                                  : const Color(0xFFF59E0B),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),

              // 4. User Profile Modal
              if (_activeModal == ResidentModalType.profile)
                _DashboardModalShell(
                  title: 'My Profile',
                  onClose: _closeModal,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 14.w,
                          vertical: 6.h,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withAlpha(80),
                          borderRadius: BorderRadius.circular(16.r),
                          border: Border.all(
                            color: const Color(0xFFC5A073).withAlpha(120),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.access_time_rounded,
                              color: const Color(0xFFC5A073),
                              size: 14.r,
                            ),
                            SizedBox(width: 6.w),
                            Text(
                              _formatDateTime(_currentTime),
                              style: TextStyle(
                                fontSize: 11.sp,
                                fontFamily: 'monospace',
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: 10.h),
                      Text(
                        user?.name ?? '',
                        style: TextStyle(
                          fontSize: 18.sp,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(height: 4.h),
                      Text(
                        user?.email ?? '',
                        style: TextStyle(
                          fontSize: 12.sp,
                          color: const Color(0xFFA1A1AA),
                        ),
                      ),
                      SizedBox(height: 16.h),
                      Container(
                        padding: EdgeInsets.all(12.r),
                        decoration: BoxDecoration(
                          color: const Color(0x1F27272A),
                          borderRadius: BorderRadius.circular(12.r),
                          border: Border.all(
                            color: Colors.white.withAlpha(20),
                          ),
                        ),
                        child: Column(
                          children: [
                            _ProfileModalRow(
                              label: 'Account ID',
                              value: '#${user?.id ?? 0}',
                            ),
                            if (user?.plateNumber != null)
                              _ProfileModalRow(
                                label: 'Vehicle Plate',
                                value: user!.plateNumber!,
                              ),
                            if (user?.contactNumber != null)
                              _ProfileModalRow(
                                label: 'Contact Number',
                                value: user!.contactNumber!,
                              ),
                            if (user?.createdAt != null)
                              _ProfileModalRow(
                                label: 'Registered Date & Time',
                                value: _formatDate(user!.createdAt!),
                              ),
                            _ProfileModalRow(
                              label: 'Role',
                              value: 'Resident Member',
                            ),
                            _ProfileModalRow(
                              label: 'Access Status',
                              value: 'Active',
                              valueColor: const Color(0xFF10B981),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components matching Client Resident Dashboard design
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryCardTile extends StatelessWidget {
  final String title;
  final String value;
  final String? subText;
  final String? badge;
  final Color badgeColor;
  final IconData icon;
  final Color iconColor;

  const _SummaryCardTile({
    required this.title,
    required this.value,
    this.subText,
    this.badge,
    required this.badgeColor,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(
          color: Theme.of(context).dividerColor.withAlpha(35),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 11.sp,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(icon, color: iconColor, size: 16.r),
            ],
          ),
          SizedBox(height: 8.h),
          Text(
            value,
            style: TextStyle(
              fontSize: 13.sp,
              fontWeight: FontWeight.bold,
            ),
            overflow: TextOverflow.ellipsis,
          ),
          if (subText != null) ...[
            SizedBox(height: 2.h),
            Text(
              subText!,
              style: TextStyle(
                fontSize: 10.sp,
                color: AppColors.textSecondary,
              ),
            ),
          ],
          if (badge != null) ...[
            SizedBox(height: 4.h),
            Text(
              badge!,
              style: TextStyle(
                fontSize: 10.sp,
                fontWeight: FontWeight.bold,
                color: badgeColor,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuickLinkAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String sub;
  final Color color;
  final VoidCallback onTap;

  const _QuickLinkAction({
    required this.icon,
    required this.title,
    required this.sub,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(12.r),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(12.r),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(8.r),
              decoration: BoxDecoration(
                color: color.withAlpha(25),
                borderRadius: BorderRadius.circular(8.r),
              ),
              child: Icon(icon, color: color, size: 20.r),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 12.5.sp,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    sub,
                    style: TextStyle(
                      fontSize: 10.5.sp,
                      color: AppColors.textSecondary,
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
}

class _DashboardModalShell extends StatelessWidget {
  final String title;
  final VoidCallback onClose;
  final Widget child;

  const _DashboardModalShell({
    required this.title,
    required this.onClose,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Stack(
        children: [
          // Dark backdrop filter
          Positioned.fill(
            child: GestureDetector(
              onTap: onClose,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  color: Colors.black.withAlpha(180),
                ),
              ),
            ),
          ),
          // Modal Dialog Card
          SafeArea(
            child: Center(
              child: Padding(
                padding: EdgeInsets.all(20.r),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24.r),
                  child: Container(
                    padding: EdgeInsets.all(20.r),
                    decoration: BoxDecoration(
                      color: const Color(0xFA1E1E24),
                      borderRadius: BorderRadius.circular(24.r),
                      border: Border.all(
                        color: Colors.white.withAlpha(30),
                        width: 1,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black87,
                          blurRadius: 32,
                          offset: Offset(0, 16),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              title,
                              style: TextStyle(
                                fontSize: 18.sp,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            GestureDetector(
                              onTap: onClose,
                              child: Container(
                                padding: EdgeInsets.all(4.r),
                                decoration: BoxDecoration(
                                  color: Colors.white.withAlpha(20),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.close_rounded,
                                  color: Colors.white70,
                                  size: 18.r,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Divider(
                          color: Colors.white.withAlpha(20),
                          height: 24.h,
                        ),
                        Flexible(child: child),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStatPill extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStatPill({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(vertical: 8.h, horizontal: 8.w),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16.sp,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 9.5.sp,
              color: Colors.white70,
            ),
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _ModalSectionHeading extends StatelessWidget {
  final String title;
  const _ModalSectionHeading({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 12.sp,
        fontWeight: FontWeight.bold,
        color: const Color(0xFFC5A073),
        letterSpacing: 0.3,
      ),
    );
  }
}

class _DarkModalInput extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String hint;
  final bool required;
  final int? maxLength;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;

  const _DarkModalInput({
    required this.label,
    required this.controller,
    required this.hint,
    this.required = false,
    this.maxLength,
    this.inputFormatters,
    this.keyboardType,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 11.5.sp,
            color: const Color(0xFFA1A1AA),
          ),
        ),
        SizedBox(height: 4.h),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          maxLength: maxLength,
          buildCounter: maxLength != null
              ? (context, {required currentLength, isFocused, maxLength}) => null
              : null,
          validator: validator ?? (required
              ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
              : null),
          style: TextStyle(fontSize: 13.sp, color: Colors.white),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(fontSize: 12.sp, color: Colors.white30),
            filled: true,
            fillColor: const Color(0x2627272A),
            contentPadding: EdgeInsets.symmetric(
              horizontal: 12.w,
              vertical: 10.h,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: BorderSide(color: Colors.white.withAlpha(20)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: BorderSide(color: Colors.white.withAlpha(20)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: const BorderSide(color: Color(0xFF7C3AED)),
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileModalRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _ProfileModalRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 6.h),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12.sp,
              color: const Color(0xFFA1A1AA),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12.5.sp,
              fontWeight: FontWeight.bold,
              color: valueColor ?? Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
