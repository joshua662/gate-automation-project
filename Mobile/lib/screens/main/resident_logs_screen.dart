import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../models/gate_log_model.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/skeleton_loader.dart';

class ResidentLogsScreen extends ConsumerWidget {
  const ResidentLogsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsAsync = ref.watch(myGateLogsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Gate Access Logs'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.refresh(myGateLogsProvider),
          ),
        ],
      ),
      body: logsAsync.when(
        loading: () => const SkeletonListLoader(count: 6),
        error: (e, _) => Center(child: Text('Failed to load logs: $e')),
        data: (logs) {
          final entriesToday = logs.where((l) => l.direction == 'IN').length;
          final exitsToday = logs.where((l) => l.direction == 'OUT').length;
          final unauthorized =
              logs.where((l) => l.status.toLowerCase() == 'unauthorized').length;

          return RefreshIndicator(
            onRefresh: () async => ref.refresh(myGateLogsProvider),
            child: ListView(
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
              children: [
                // ── Summary Cards ─────────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: _LogStatCard(
                        label: 'Entries Today',
                        value: '$entriesToday',
                        color: AppColors.success,
                        icon: Icons.login_rounded,
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      child: _LogStatCard(
                        label: 'Exits Today',
                        value: '$exitsToday',
                        color: AppColors.primary,
                        icon: Icons.logout_rounded,
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      child: _LogStatCard(
                        label: 'Unauthorized',
                        value: '$unauthorized',
                        color: AppColors.error,
                        icon: Icons.warning_amber_rounded,
                      ),
                    ),
                  ],
                ),

                SizedBox(height: 20.h),

                Text(
                  'Recent Access Records',
                  style: TextStyle(
                    fontSize: 16.sp,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: 10.h),

                if (logs.isEmpty)
                  Padding(
                    padding: EdgeInsets.only(top: 40.h),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(
                            Icons.history_toggle_off_rounded,
                            size: 48.r,
                            color: AppColors.textSecondary.withAlpha(120),
                          ),
                          SizedBox(height: 12.h),
                          Text(
                            'No access logs found',
                            style: TextStyle(
                              fontSize: 14.sp,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...List.generate(logs.length, (i) => AnimatedListItem(
                    index: i,
                    staggerDelay: const Duration(milliseconds: 50),
                    child: _LogItemTile(log: logs[i]),
                  )),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _LogStatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  const _LogStatCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20.r),
          SizedBox(height: 6.h),
          Text(
            value,
            style: TextStyle(
              fontSize: 18.sp,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          SizedBox(height: 2.h),
          Text(
            label,
            style: TextStyle(
              fontSize: 10.sp,
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _LogItemTile extends StatelessWidget {
  final GateLogModel log;
  const _LogItemTile({required this.log});

  @override
  Widget build(BuildContext context) {
    final isEntry = log.direction == 'IN';
    final color = isEntry ? AppColors.success : AppColors.primary;

    return Container(
      margin: EdgeInsets.only(bottom: 8.h),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(
          color: Theme.of(context).dividerColor.withAlpha(50),
        ),
      ),
      child: ListTile(
        leading: Container(
          width: 38.r,
          height: 38.r,
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            shape: BoxShape.circle,
          ),
          child: Icon(
            isEntry ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
            color: color,
            size: 20.r,
          ),
        ),
        title: Text(
          isEntry ? 'Gate Entry (IN)' : 'Gate Exit (OUT)',
          style: TextStyle(
            fontSize: 14.sp,
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Text(
          'Plate: ${log.plateNumber ?? 'N/A'} • ${log.loggedAt}',
          style: TextStyle(
            fontSize: 12.sp,
            color: AppColors.textSecondary,
          ),
        ),
        trailing: Container(
          padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 3.h),
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            log.status.toUpperCase(),
            style: TextStyle(
              fontSize: 10.sp,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ),
      ),
    );
  }
}
