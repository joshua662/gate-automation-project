import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../models/notification_model.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/skeleton_loader.dart';

class ResidentNotificationsScreen extends ConsumerWidget {
  const ResidentNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0D14), // Modern deep dark background
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          backgroundColor: const Color(0xFF161B22),
          onRefresh: () async => ref.refresh(notificationsProvider),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // ── Header Title & Subtitle Section ──────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 16.h),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Notifications',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 24.sp,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.5,
                              ),
                            ),
                            SizedBox(height: 4.h),
                            Text(
                              'View recent system and security notifications.',
                              style: TextStyle(
                                color: const Color(0xFF8B949E), // Muted zinc text
                                fontSize: 13.sp,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                      ),
                      notifsAsync.maybeWhen(
                        data: (notifications) {
                          if (notifications.isEmpty) return const SizedBox.shrink();
                          return TextButton(
                            onPressed: () async {
                              await ref.read(residentServiceProvider).markAllNotificationsRead();
                              // ignore: unused_result
                              ref.refresh(notificationsProvider);
                            },
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              'Mark Read',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 13.sp,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          );
                        },
                        orElse: () => const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Body / Content Section ──────────────────────────────
              SliverPadding(
                padding: EdgeInsets.fromLTRB(20.w, 0, 20.w, 100.h),
                sliver: notifsAsync.when(
                  loading: () => const SliverToBoxAdapter(
                    child: SkeletonListLoader(count: 3),
                  ),
                  error: (e, _) => SliverToBoxAdapter(
                    child: Container(
                      padding: EdgeInsets.all(24.r),
                      decoration: BoxDecoration(
                        color: const Color(0xFF13171F),
                        borderRadius: BorderRadius.circular(14.r),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                      ),
                      child: Center(
                        child: Text(
                          'Failed to load notifications.',
                          style: TextStyle(color: const Color(0xFF8B949E), fontSize: 13.sp),
                        ),
                      ),
                    ),
                  ),
                  data: (notifications) {
                    if (notifications.isEmpty) {
                      // ── Clean empty state matching screenshot ────────
                      return SliverToBoxAdapter(
                        child: Container(
                          width: double.infinity,
                          padding: EdgeInsets.symmetric(vertical: 42.h, horizontal: 20.w),
                          decoration: BoxDecoration(
                            color: const Color(0xFF13171F), // Dark card surface
                            borderRadius: BorderRadius.circular(14.r),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.06),
                              width: 1,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              "You're all caught up. No new notifications.",
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: const Color(0xFF8B949E),
                                fontSize: 13.5.sp,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ),
                        ),
                      );
                    }

                    return SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final notif = notifications[index];
                          return _NotificationTile(notif: notif);
                        },
                        childCount: notifications.length,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationModel notif;
  const _NotificationTile({required this.notif});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: 10.h),
      padding: EdgeInsets.all(14.r),
      decoration: BoxDecoration(
        color: notif.isRead
            ? const Color(0xFF13171F)
            : const Color(0xFF171D29),
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(
          color: notif.isRead
              ? Colors.white.withValues(alpha: 0.06)
              : AppColors.primary.withValues(alpha: 0.35),
          width: 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36.r,
            height: 36.r,
            decoration: BoxDecoration(
              color: notif.isRead
                  ? Colors.white.withValues(alpha: 0.05)
                  : AppColors.primary.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Icon(
              Icons.notifications_rounded,
              color: notif.isRead ? const Color(0xFF8B949E) : AppColors.primary,
              size: 18.r,
            ),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notif.title,
                  style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: notif.isRead ? FontWeight.w500 : FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 3.h),
                Text(
                  notif.message,
                  style: TextStyle(
                    fontSize: 12.5.sp,
                    color: const Color(0xFF8B949E),
                    height: 1.35,
                  ),
                ),
                SizedBox(height: 6.h),
                Text(
                  notif.createdAt,
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
  }
}

