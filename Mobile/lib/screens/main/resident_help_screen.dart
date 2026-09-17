import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../widgets/animated_list_item.dart';

class ResidentHelpScreen extends StatelessWidget {
  const ResidentHelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Help & Security Contacts'),
      ),
      body: ListView(
        padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
        children: [
          // ── Emergency Alert Banner ────────────────────────────────
          AnimatedListItem(
            index: 0,
            child: Container(
              padding: EdgeInsets.all(16.r),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFDC2626), Color(0xFF991B1B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16.r),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.error.withAlpha(80),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(10.r),
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(40),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.phone_in_talk_rounded,
                        color: Colors.white, size: 24.r),
                  ),
                  SizedBox(width: 14.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Security Guard Main Gate Hotline',
                          style: TextStyle(
                            fontSize: 14.sp,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        SizedBox(height: 2.h),
                        Text(
                          '0917-800-NODSL (66375)',
                          style: TextStyle(
                            fontSize: 16.sp,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          SizedBox(height: 24.h),

          AnimatedListItem(
            index: 1,
            child: Text(
              'Emergency Hotlines',
              style: TextStyle(
                fontSize: 16.sp,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          SizedBox(height: 10.h),

          AnimatedListItem(
            index: 2,
            child: const _HotlineTile(
              title: 'Subdivision Admin Office',
              phone: '(02) 8888-1234',
              icon: Icons.business_rounded,
              iconColor: AppColors.primary,
            ),
          ),
          AnimatedListItem(
            index: 3,
            child: const _HotlineTile(
              title: 'Local Police Station (PNP)',
              phone: '911 / (02) 8888-9111',
              icon: Icons.local_police_rounded,
              iconColor: AppColors.info,
            ),
          ),
          AnimatedListItem(
            index: 4,
            child: const _HotlineTile(
              title: 'Bureau of Fire Protection (BFP)',
              phone: '(02) 8888-3473',
              icon: Icons.local_fire_department_rounded,
              iconColor: AppColors.error,
            ),
          ),

          SizedBox(height: 24.h),

          AnimatedListItem(
            index: 5,
            child: Text(
              'Frequently Asked Questions',
              style: TextStyle(
                fontSize: 16.sp,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          SizedBox(height: 10.h),

          AnimatedListItem(
            index: 6,
            child: const _FaqTile(
              question: 'How do I generate my Gate Access QR Code?',
              answer:
                  'Go to the Home tab and tap "Member Card QR" to display your personalized QR code for instant gate scanning.',
            ),
          ),
          AnimatedListItem(
            index: 7,
            child: const _FaqTile(
              question: 'How do I request a visitor or guest pass?',
              answer:
                  'Navigate to the Updates tab, fill out the Guest Pass form with your visitor\'s name and plate number, and submit.',
            ),
          ),
          AnimatedListItem(
            index: 8,
            child: const _FaqTile(
              question: 'What should I do if my plate number changes?',
              answer:
                  'You can submit a Profile Update Request under the Updates tab or contact the Admin office to update your registered vehicle.',
            ),
          ),
        ],
      ),
    );
  }
}

class _HotlineTile extends StatelessWidget {
  final String title;
  final String phone;
  final IconData icon;
  final Color iconColor;

  const _HotlineTile({
    required this.title,
    required this.phone,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
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
            color: iconColor.withAlpha(25),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: iconColor, size: 20.r),
        ),
        title: Text(
          title,
          style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          phone,
          style: TextStyle(
            fontSize: 13.sp,
            fontWeight: FontWeight.bold,
            color: AppColors.primary,
          ),
        ),
        trailing: Icon(Icons.phone_callback_rounded,
            color: AppColors.primary, size: 20.r),
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  final String question;
  final String answer;

  const _FaqTile({required this.question, required this.answer});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: 8.h),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(
          color: Theme.of(context).dividerColor.withAlpha(40),
        ),
      ),
      child: ExpansionTile(
        title: Text(
          question,
          style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600),
        ),
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(16.w, 0, 16.w, 12.h),
            child: Text(
              answer,
              style: TextStyle(fontSize: 12.sp, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
