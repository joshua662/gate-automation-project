import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/router/app_router.dart';
import '../../core/utils/image_helper.dart';
import '../../core/utils/plate_input_formatter.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/modals/action_confirm_dialog.dart';
import '../../widgets/skeleton_loader.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  final bool isActive;

  const ProfileScreen({super.key, this.isActive = true});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _showAvatarPopover = false;
  String? _selectedAvatarPath;
  bool _isUploadingAvatar = false;

  // Edit form controllers
  final _editFormKey = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _colorCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  bool _isSubmittingEdit = false;

  @override
  void didUpdateWidget(ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Close popovers whenever the tab becomes inactive (user switched away)
    if (!widget.isActive && oldWidget.isActive) {
      setState(() => _showAvatarPopover = false);
    }
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _contactCtrl.dispose();
    _plateCtrl.dispose();
    _modelCtrl.dispose();
    _colorCtrl.dispose();
    _addressCtrl.dispose();
    _emailCtrl.dispose();
    _usernameCtrl.dispose();
    super.dispose();
  }

  void _openEditModal(User user) {
    final nameParts = user.name.trim().split(' ');
    _firstNameCtrl.text = (user.firstName?.isNotEmpty == true)
        ? user.firstName!
        : (nameParts.isNotEmpty ? nameParts.first : '');
    _lastNameCtrl.text = (user.lastName?.isNotEmpty == true)
        ? user.lastName!
        : (nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '');
    _contactCtrl.text = user.contactNumber ?? '';
    _plateCtrl.text = user.plateNumber ?? '';
    _modelCtrl.text = user.carModel ?? '';
    _colorCtrl.text = user.carColor ?? '';
    _addressCtrl.text = user.address ?? '';
    _emailCtrl.text = user.email;
    _usernameCtrl.text = user.username ?? user.slug ?? '';

    showDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.75),
      barrierDismissible: true,
      builder: (dialogCtx) => _EditProfileDialog(
        formKey: _editFormKey,
        firstNameCtrl: _firstNameCtrl,
        lastNameCtrl: _lastNameCtrl,
        contactCtrl: _contactCtrl,
        addressCtrl: _addressCtrl,
        plateCtrl: _plateCtrl,
        modelCtrl: _modelCtrl,
        colorCtrl: _colorCtrl,
        emailCtrl: _emailCtrl,
        usernameCtrl: _usernameCtrl,
        onSubmit: _submitProfileChanges,
        isSubmitting: _isSubmittingEdit,
      ),
    );
  }

  Future<bool> _submitProfileChanges() async {
    if (!(_editFormKey.currentState?.validate() ?? false)) return false;

    final confirmed = await ActionConfirmDialog.show(
      context,
      title: 'Update Profile',
      message:
          'Are you sure you want to submit these profile changes for administrator review and approval?',
      confirmLabel: 'Yes, Submit Changes',
      cancelLabel: 'Review Details',
      confirmColor: AppColors.primary,
      icon: Icons.edit_note_rounded,
    );

    if (confirmed != true) return false;

    setState(() => _isSubmittingEdit = true);
    try {
      final service = ref.read(residentServiceProvider);
      final fName = _firstNameCtrl.text.trim();
      final lName = _lastNameCtrl.text.trim();
      final contact = _contactCtrl.text.trim();
      final plate = _plateCtrl.text.trim().toUpperCase();
      final model = _modelCtrl.text.trim();
      final color = _colorCtrl.text.trim();
      final addr = _addressCtrl.text.trim();
      final email = _emailCtrl.text.trim();
      final username = _usernameCtrl.text.trim();

      await service.submitUpdateRequest({
        'request_type': 'profile_update',
        'first_name': fName,
        'last_name': lName,
        'contact_number': contact,
        'plate_number': plate,
        if (model.isNotEmpty) 'car_model': model,
        if (color.isNotEmpty) 'car_color': color,
        if (addr.isNotEmpty) 'address': addr,
        if (email.isNotEmpty) 'email': email,
        if (username.isNotEmpty) 'username': username,
      });

      // Optimistically update local Auth state so profile screen reflects changes live
      final currentUser = ref.read(authProvider).value;
      if (currentUser != null) {
        final combinedName = '$fName $lName'.trim();
        final updatedUser = currentUser.copyWith(
          name: combinedName.isNotEmpty ? combinedName : currentUser.name,
          firstName: fName.isNotEmpty ? fName : currentUser.firstName,
          lastName: lName.isNotEmpty ? lName : currentUser.lastName,
          contactNumber: contact.isNotEmpty ? contact : currentUser.contactNumber,
          plateNumber: plate.isNotEmpty ? plate : currentUser.plateNumber,
          carModel: model.isNotEmpty ? model : currentUser.carModel,
          carColor: color.isNotEmpty ? color : currentUser.carColor,
          address: addr.isNotEmpty ? addr : currentUser.address,
          email: email.isNotEmpty ? email : currentUser.email,
          username: username.isNotEmpty ? username : currentUser.username,
        );
        ref.read(authProvider.notifier).setUser(updatedUser);
      }

      // Invalidate requests provider so resident updates screen has the latest data
      ref.invalidate(myUpdateRequestsProvider);

      if (mounted) {
        ToastHelper.showSuccess(
            context, 'Profile changes submitted for admin review.');
      }
      return true;
    } catch (e) {
      if (mounted) {
        ToastHelper.showError(context, 'Failed to submit profile changes: $e');
      }
      return false;
    } finally {
      if (mounted) setState(() => _isSubmittingEdit = false);
    }
  }

  Future<void> _confirmLogout() async {
    final confirm = await ActionConfirmDialog.show(
      context,
      title: 'Sign Out',
      message:
          'Are you sure you want to sign out? You will need to sign in again.',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Cancel',
      confirmColor: const Color(0xFFEF4444),
      icon: Icons.logout_rounded,
    );
    if (confirm == true && mounted) {
      await ref.read(authProvider.notifier).logout();
      if (mounted) {
        ToastHelper.showInfo(context, AppStrings.logoutSuccess);
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRouter.login,
          (_) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: authAsync.when(
        loading: () => const SkeletonProfileLoader(),
        error: (e, _) => Center(
          child: Text('Error: $e', style: const TextStyle(color: Colors.white)),
        ),
        data: (user) {
          if (user == null) return const SkeletonProfileLoader();
          return _buildMainContent(user);
        },
      ),
    );
  }

  // ── Main scrollable content ──────────────────────────────────────────────
  Widget _buildMainContent(User user) {
    final firstName = user.firstName ?? user.name.split(' ').first;
    final lastName = user.lastName ??
        (user.name.split(' ').length > 1
            ? user.name.split(' ').sublist(1).join(' ')
            : '');

    final scrollContent = SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 32.h),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Profile Banner Card with Header Image ──────────────────
            _buildProfileBanner(user),

            SizedBox(height: 16.h),

            // ── Personal Information Card ──────────────────────────────
            _buildPersonalInfoCard(firstName, lastName, user),

            SizedBox(height: 16.h),

            // ── Account Information Card ───────────────────────────────
            _buildAccountInfoCard(user),

            SizedBox(height: 16.h),

            // ── Vehicle Information Card ───────────────────────────────
            _buildVehicleInfoCard(user),
          ],
        ),
      ),
    );

    // When the popover is open, place an invisible full-screen barrier
    // BEHIND the scroll content that dismisses it on tap-outside.
    // This prevents the outer layer from interfering with the avatar tap.
    if (_showAvatarPopover) {
      return Stack(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _showAvatarPopover = false),
            child: const SizedBox.expand(),
          ),
          scrollContent,
        ],
      );
    }

    return scrollContent;
  }

  // ── Profile Banner ───────────────────────────────────────────────────────
  Widget _buildProfileBanner(User user) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(20.r),
        border: Border.all(color: const Color(0xFF30363D)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Top Banner Image Header ──────────────────────────────────────
              Container(
                height: 150.h,
                width: double.infinity,
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
                        Colors.black.withValues(alpha: 0.75),
                        Colors.black.withValues(alpha: 0.35),
                        Colors.black.withValues(alpha: 0.85),
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                  padding: EdgeInsets.fromLTRB(20.w, 16.h, 16.w, 16.h),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'My Profile',
                        style: TextStyle(
                          fontSize: 22.sp,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                      SizedBox(height: 2.h),
                      Text(
                        'View and manage your personal and account information',
                        style: TextStyle(
                          fontSize: 11.5.sp,
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),

              // ── Content Area Under Banner Image ─────────────────────────────
              Padding(
                padding: EdgeInsets.fromLTRB(20.w, 62.h, 20.w, 18.h),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // User Name with Verified Badge
                        Expanded(
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  user.name,
                                  style: TextStyle(
                                    fontSize: 22.sp,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                    letterSpacing: -0.4,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              SizedBox(width: 6.w),
                              Icon(
                                Icons.verified_rounded,
                                color: const Color(0xFF3B82F6),
                                size: 20.r,
                              ),
                            ],
                          ),
                        ),

                        // Action Buttons (Edit Profile + Sign Out)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Edit Profile Button
                            GestureDetector(
                              onTap: () => _openEditModal(user),
                              child: Container(
                                padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF21262D),
                                  borderRadius: BorderRadius.circular(10.r),
                                  border: Border.all(color: const Color(0xFF363B42)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.edit_outlined,
                                      color: Colors.white,
                                      size: 14.r,
                                    ),
                                    SizedBox(width: 6.w),
                                    Text(
                                      'Edit Profile',
                                      style: TextStyle(
                                        fontSize: 12.sp,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            SizedBox(width: 8.w),
                            // Sign Out Button
                            GestureDetector(
                              onTap: _confirmLogout,
                              child: Container(
                                padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 8.h),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF3C1618),
                                  borderRadius: BorderRadius.circular(10.r),
                                  border: Border.all(color: const Color(0xFF5C1D21)),
                                ),
                                child: Text(
                                  'Sign Out',
                                  style: TextStyle(
                                    fontSize: 12.sp,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFFF87171),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    SizedBox(height: 6.h),

                    // Subtitle Metadata Row
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6.w,
                      runSpacing: 4.h,
                      children: [
                        if (user.email.isNotEmpty) ...[
                          Text(
                            user.email,
                            style: TextStyle(
                              fontSize: 12.sp,
                              color: const Color(0xFF9CA3AF),
                            ),
                          ),
                          Text(
                            '·',
                            style: TextStyle(
                              fontSize: 12.sp,
                              color: const Color(0xFF6B7280),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                        Text(
                          'Resident Member',
                          style: TextStyle(
                            fontSize: 12.sp,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF60A5FA),
                          ),
                        ),
                        Text(
                          '·',
                          style: TextStyle(
                            fontSize: 12.sp,
                            color: const Color(0xFF6B7280),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6.r,
                              height: 6.r,
                              decoration: const BoxDecoration(
                                color: Color(0xFF22C55E),
                                shape: BoxShape.circle,
                              ),
                            ),
                            SizedBox(width: 4.w),
                            Text(
                              'ACTIVE ACCOUNT',
                              style: TextStyle(
                                fontSize: 10.5.sp,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF22C55E),
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // ── Overlapping Avatar Circle ─────────────────────────────────────────
          Positioned(
            left: 20.w,
            top: 95.h,
            child: GestureDetector(
              onTap: () {
                setState(() => _showAvatarPopover = !_showAvatarPopover);
              },
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: 108.r,
                height: 108.r,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF21262D),
                  border: Border.all(color: const Color(0xFF161B22), width: 4.5.r),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.55),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    ClipOval(
                      child: _buildAvatarImage(user),
                    ),
                    if (!_isUploadingAvatar)
                      Positioned(
                        bottom: 4,
                        right: 4,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFF161B22), width: 2),
                          ),
                          child: const Icon(
                            Icons.camera_alt,
                            size: 12,
                            color: Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),

          // ── Popover Modal beside Avatar with Smooth Spring Open & Close Animation ──
          Positioned(
            left: 114.w,
            top: 125.h,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              reverseDuration: const Duration(milliseconds: 220),
              switchInCurve: const Cubic(0.34, 1.56, 0.64, 1),
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) {
                final scaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: const Cubic(0.34, 1.56, 0.64, 1),
                    reverseCurve: Curves.easeInBack,
                  ),
                );
                final fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOut,
                    reverseCurve: Curves.easeIn,
                  ),
                );

                return ScaleTransition(
                  scale: scaleAnimation,
                  alignment: Alignment.centerLeft,
                  child: FadeTransition(
                    opacity: fadeAnimation,
                    child: child,
                  ),
                );
              },
              child: _showAvatarPopover
                  ? _SpeechBubbleContainer(
                      key: const ValueKey('avatar_popover_open'),
                      child: InkWell(
                        onTap: () async {
                          setState(() => _showAvatarPopover = false);
                          final path = await ImageHelper.pickAndCropImage(context);
                          if (path != null && mounted) {
                            setState(() {
                              _selectedAvatarPath = path;
                              _isUploadingAvatar = true;
                            });
                            try {
                              final authService = ref.read(authServiceProvider);
                              final updatedUser = await authService.updateProfile(
                                {},
                                imagePath: path,
                              );
                              ref.read(authProvider.notifier).setUser(updatedUser);

                              if (mounted) {
                                ToastHelper.showSuccess(context, 'Profile photo updated successfully!');
                              }
                            } catch (e) {
                              // Fallback locally if network fails
                              final currentUser = ref.read(authProvider).value;
                              if (currentUser != null) {
                                final updatedUser = currentUser.copyWith(avatar: path);
                                ref.read(authProvider.notifier).setUser(updatedUser);
                              }
                              if (mounted) {
                                ToastHelper.showSuccess(context, 'Profile photo updated!');
                              }
                            } finally {
                              if (mounted) {
                                setState(() => _isUploadingAvatar = false);
                              }
                            }
                          }
                        },
                        borderRadius: BorderRadius.circular(18.r),
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 18.w, vertical: 10.h),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1D6BF3),
                            borderRadius: BorderRadius.circular(18.r),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.camera_alt_outlined,
                                color: Colors.white,
                                size: 19.r,
                              ),
                              SizedBox(width: 8.w),
                              Text(
                                'Upload Photo',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 14.sp,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
                  : const SizedBox.shrink(key: ValueKey('avatar_popover_closed')),
            ),
          ),
        ],
      ),
    );

  }

  // ── Personal Information Card ────────────────────────────────────────────
  Widget _buildPersonalInfoCard(
      String firstName, String lastName, User user) {
    return _SectionCard(
      icon: Icons.person_rounded,
      iconColor: const Color(0xFF3B82F6),
      iconBgColor: const Color(0xFF3B82F6).withAlpha(30),
      title: 'Personal Information',
      onEditTap: () => _openEditModal(user),
      child: Column(
        children: [
          // Row 1: First Name + Last Name
          Row(
            children: [
              Expanded(
                child: _InfoTile(
                  label: 'FIRST NAME',
                  value: firstName,
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: _InfoTile(
                  label: 'LAST NAME',
                  value: lastName,
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),

          // Row 2: Age + Contact Number
          Row(
            children: [
              Expanded(
                child: _InfoTile(
                  label: 'AGE',
                  value: user.age,
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: _InfoTile(
                  label: 'CONTACT NUMBER',
                  value: user.contactNumber,
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),

          // Row 3: Address (full width)
          _InfoTile(
            label: 'ADDRESS',
            value: user.address,
          ),
        ],
      ),
    );
  }

  // ── Account Information Card ─────────────────────────────────────────────
  Widget _buildAccountInfoCard(User user) {
    return _SectionCard(
      icon: Icons.shield_rounded,
      iconColor: const Color(0xFF22C55E),
      iconBgColor: const Color(0xFF22C55E).withAlpha(30),
      title: 'Account Information',
      onEditTap: () => _openEditModal(user),
      child: Column(
        children: [
          _InfoTile(label: 'EMAIL', value: user.email),
          SizedBox(height: 12.h),
          _InfoTile(label: 'USERNAME', value: user.username ?? user.slug),
          SizedBox(height: 12.h),
          Row(
            children: [
              Expanded(
                child: _InfoTile(
                  label: 'ACCOUNT ID',
                  value: '#${user.id}',
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: _InfoTile(
                  label: 'RFID UID',
                  value: user.rfidUid,
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),

          // Access Status badge
          Container(
            width: double.infinity,
            padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
            decoration: BoxDecoration(
              color: const Color(0xFF22C55E).withAlpha(20),
              borderRadius: BorderRadius.circular(10.r),
              border: Border.all(
                color: const Color(0xFF22C55E).withAlpha(50),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ACCESS STATUS',
                  style: TextStyle(
                    fontSize: 10.sp,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF22C55E),
                    letterSpacing: 0.5,
                  ),
                ),
                SizedBox(height: 4.h),
                Row(
                  children: [
                    Container(
                      width: 8.r,
                      height: 8.r,
                      decoration: const BoxDecoration(
                        color: Color(0xFF22C55E),
                        shape: BoxShape.circle,
                      ),
                    ),
                    SizedBox(width: 6.w),
                    Text(
                      'Active',
                      style: TextStyle(
                        fontSize: 13.sp,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF22C55E),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Vehicle Information Card ─────────────────────────────────────────────
  Widget _buildVehicleInfoCard(User user) {
    return _SectionCard(
      icon: Icons.directions_car_rounded,
      iconColor: const Color(0xFF8B5CF6),
      iconBgColor: const Color(0xFF8B5CF6).withAlpha(30),
      title: 'Vehicle Information',
      onEditTap: () => _openEditModal(user),
      child: Column(
        children: [
          // Row 1: Plate Number (highlighted) + Car Model
          Row(
            children: [
              Expanded(
                child: _InfoTile(
                  label: 'PLATE NUMBER',
                  value: user.plateNumber,
                  isHighlighted: true,
                  highlightColor: const Color(0xFF8B5CF6),
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: _InfoTile(
                  label: 'CAR MODEL',
                  value: user.carModel,
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),

          // Row 2: Car Color
          _InfoTile(
            label: 'CAR COLOR',
            value: user.carColor,
          ),
        ],
      ),
    );
  }



  Widget _buildAvatarImage(User user) {
    if (_isUploadingAvatar) {
      return const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          color: Color(0xFF3B82F6),
        ),
      );
    }

    final candidatePath = _selectedAvatarPath ?? user.avatar;
    if (candidatePath != null && candidatePath.isNotEmpty) {
      final cleanPath = candidatePath.replaceFirst('file://', '');
      try {
        final file = File(cleanPath);
        if (file.existsSync()) {
          final modTime = file.lastModifiedSync().millisecondsSinceEpoch;
          return Image.file(
            file,
            key: ValueKey('avatar_file_${file.path}_$modTime'),
            width: 108.r,
            height: 108.r,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => _buildInitialsText(user),
          );
        }
      } catch (_) {}
    }

    final url = user.avatarUrl;
    if (url.isNotEmpty &&
        (url.startsWith('http://') || url.startsWith('https://'))) {
      return Image.network(
        url,
        key: ValueKey('avatar_net_$url'),
        width: 108.r,
        height: 108.r,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _buildInitialsText(user),
      );
    }

    return _buildInitialsText(user);
  }

  Widget _buildInitialsText(User user) {
    return Center(
      child: Text(
        user.initials,
        style: TextStyle(
          fontSize: 34.sp,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Profile Dialog  (matches client web modal design)
// ─────────────────────────────────────────────────────────────────────────────

class _EditProfileDialog extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController firstNameCtrl;
  final TextEditingController lastNameCtrl;
  final TextEditingController contactCtrl;
  final TextEditingController addressCtrl;
  final TextEditingController plateCtrl;
  final TextEditingController modelCtrl;
  final TextEditingController colorCtrl;
  final TextEditingController emailCtrl;
  final TextEditingController usernameCtrl;
  final Future<bool> Function() onSubmit;
  final bool isSubmitting;

  const _EditProfileDialog({
    required this.formKey,
    required this.firstNameCtrl,
    required this.lastNameCtrl,
    required this.contactCtrl,
    required this.addressCtrl,
    required this.plateCtrl,
    required this.modelCtrl,
    required this.colorCtrl,
    required this.emailCtrl,
    required this.usernameCtrl,
    required this.onSubmit,
    required this.isSubmitting,
  });

  @override
  State<_EditProfileDialog> createState() => _EditProfileDialogState();
}

class _EditProfileDialogState extends State<_EditProfileDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<double> _scaleAnim;
  bool _localSubmitting = false;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _scaleAnim = Tween<double>(begin: 0.92, end: 1.0).animate(
      CurvedAnimation(parent: _animCtrl, curve: const Cubic(0.34, 1.56, 0.64, 1)),
    );
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() => _localSubmitting = true);
    final success = await widget.onSubmit();
    if (mounted) setState(() => _localSubmitting = false);
    if (success && mounted) Navigator.of(context).pop();
  }

  Future<void> _handleClose() async {
    await _animCtrl.reverse();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return FadeTransition(
      opacity: _fadeAnim,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 24.h),
        child: ScaleTransition(
          scale: _scaleAnim,
          child: Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
            decoration: BoxDecoration(
              color: const Color(0xFF161B22),
              borderRadius: BorderRadius.circular(20.r),
              border: Border.all(color: const Color(0xFF30363D)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.6),
                  blurRadius: 40,
                  spreadRadius: 4,
                  offset: const Offset(0, 16),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20.r),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ── Cover Banner Header ────────────────────────────────────
                  Container(
                    height: 80.h,
                    width: double.infinity,
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
                            Colors.black.withValues(alpha: 0.80),
                            Colors.indigo.withValues(alpha: 0.30),
                            Colors.purple.withValues(alpha: 0.55),
                          ],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                      padding: EdgeInsets.fromLTRB(18.w, 16.h, 14.w, 12.h),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Edit Profile',
                                style: TextStyle(
                                  fontSize: 20.sp,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  letterSpacing: -0.4,
                                ),
                              ),
                              SizedBox(height: 2.h),
                              Text(
                                'Changes are submitted for admin approval',
                                style: TextStyle(
                                  fontSize: 10.5.sp,
                                  color: Colors.white.withValues(alpha: 0.75),
                                ),
                              ),
                            ],
                          ),
                          // Close button
                          GestureDetector(
                            onTap: _handleClose,
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.45),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.15),
                                ),
                              ),
                              child: Icon(
                                Icons.close_rounded,
                                color: Colors.white.withValues(alpha: 0.85),
                                size: 18.r,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ── Scrollable form body ──────────────────────────────────
                  Flexible(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(18.w, 18.h, 18.w, bottom + 20.h),
                      child: Form(
                        key: widget.formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Personal Details section
                            _DialogSectionHeader(
                              label: 'Personal Details',
                              icon: Icons.person_rounded,
                              color: const Color(0xFF3B82F6),
                            ),
                            SizedBox(height: 10.h),
                            Row(
                              children: [
                                Expanded(
                                  child: _ModalField(
                                    label: 'First Name',
                                    controller: widget.firstNameCtrl,
                                    isRequired: true,
                                  ),
                                ),
                                SizedBox(width: 10.w),
                                Expanded(
                                  child: _ModalField(
                                    label: 'Last Name',
                                    controller: widget.lastNameCtrl,
                                    isRequired: true,
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 10.h),
                            _ModalField(
                              label: 'Contact Number',
                              controller: widget.contactCtrl,
                              isRequired: true,
                              maxLength: 11,
                              keyboardType: TextInputType.phone,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(11),
                              ],
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) return 'Required';
                                if (v.trim().length != 11) return 'Must be 11 digits';
                                return null;
                              },
                            ),
                            SizedBox(height: 10.h),
                            _ModalField(label: 'Address', controller: widget.addressCtrl),

                            SizedBox(height: 18.h),

                            // Vehicle Details section
                            _DialogSectionHeader(
                              label: 'Vehicle Details',
                              icon: Icons.directions_car_rounded,
                              color: const Color(0xFF8B5CF6),
                            ),
                            SizedBox(height: 10.h),
                            Row(
                              children: [
                                Expanded(
                                  child: _ModalField(
                                    label: 'Plate Number',
                                    hint: 'e.g. ABC 1234',
                                    controller: widget.plateCtrl,
                                    isRequired: true,
                                    inputFormatters: [PlateInputFormatter()],
                                  ),
                                ),
                                SizedBox(width: 10.w),
                                Expanded(
                                  child: _ModalField(
                                    label: 'Car Model',
                                    controller: widget.modelCtrl,
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 10.h),
                            _ModalField(label: 'Car Color', controller: widget.colorCtrl),

                            SizedBox(height: 18.h),

                            // Account Information section
                            _DialogSectionHeader(
                              label: 'Account Information',
                              icon: Icons.shield_rounded,
                              color: const Color(0xFF22C55E),
                            ),
                            SizedBox(height: 10.h),
                            _ModalField(
                              label: 'Email Address',
                              controller: widget.emailCtrl,
                              isRequired: true,
                              keyboardType: TextInputType.emailAddress,
                            ),
                            SizedBox(height: 10.h),
                            _ModalField(
                              label: 'Username',
                              controller: widget.usernameCtrl,
                              isRequired: true,
                            ),

                            SizedBox(height: 18.h),

                            // Notice
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.all(10.r),
                              decoration: BoxDecoration(
                                color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10.r),
                                border: Border.all(
                                  color: const Color(0xFF3B82F6).withValues(alpha: 0.25),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    Icons.info_outline_rounded,
                                    color: const Color(0xFF93C5FD),
                                    size: 15.r,
                                  ),
                                  SizedBox(width: 8.w),
                                  Expanded(
                                    child: Text(
                                      'Changes are submitted for admin review and approval. '
                                      'You will be notified once processed.',
                                      style: TextStyle(
                                        fontSize: 11.sp,
                                        color: const Color(0xFF93C5FD),
                                        height: 1.45,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            SizedBox(height: 20.h),

                            // Action buttons
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: _localSubmitting ? null : _handleClose,
                                    style: OutlinedButton.styleFrom(
                                      padding: EdgeInsets.symmetric(vertical: 12.h),
                                      side: const BorderSide(color: Color(0xFF30363D)),
                                      foregroundColor: const Color(0xFF9CA3AF),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12.r),
                                      ),
                                    ),
                                    child: Text(
                                      'Cancel',
                                      style: TextStyle(
                                        fontSize: 13.sp,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                                SizedBox(width: 10.w),
                                Expanded(
                                  flex: 2,
                                  child: ElevatedButton(
                                    onPressed: _localSubmitting ? null : _handleSubmit,
                                    style: ElevatedButton.styleFrom(
                                      padding: EdgeInsets.symmetric(vertical: 12.h),
                                      backgroundColor: const Color(0xFF2563EB),
                                      foregroundColor: Colors.white,
                                      disabledBackgroundColor:
                                          const Color(0xFF2563EB).withValues(alpha: 0.45),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12.r),
                                      ),
                                      elevation: 0,
                                    ),
                                    child: _localSubmitting
                                        ? SizedBox(
                                            height: 18.r,
                                            width: 18.r,
                                            child: const CircularProgressIndicator(
                                              strokeWidth: 2.2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : Text(
                                            'Submit for Review',
                                            style: TextStyle(
                                              fontSize: 13.sp,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Small coloured header row for each form section inside the dialog
class _DialogSectionHeader extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;

  const _DialogSectionHeader({
    required this.label,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 24.r,
          height: 24.r,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(6.r),
          ),
          child: Center(child: Icon(icon, color: color, size: 13.r)),
        ),
        SizedBox(width: 8.w),
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5.sp,
            fontWeight: FontWeight.w700,
            color: color,
            letterSpacing: 0.1,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Widgets
// ─────────────────────────────────────────────────────────────────────────────

/// Section card with icon, title and content
class _SectionCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String title;
  final Widget child;
  final VoidCallback? onEditTap;

  const _SectionCard({
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.title,
    required this.child,
    this.onEditTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(16.r),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header with icon and optional edit trigger
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32.r,
                    height: 32.r,
                    decoration: BoxDecoration(
                      color: iconBgColor,
                      borderRadius: BorderRadius.circular(8.r),
                    ),
                    child: Center(
                      child: Icon(icon, color: iconColor, size: 18.r),
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15.sp,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              if (onEditTap != null)
                GestureDetector(
                  onTap: onEditTap,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                    decoration: BoxDecoration(
                      color: const Color(0xFF21262D),
                      borderRadius: BorderRadius.circular(8.r),
                      border: Border.all(color: const Color(0xFF363B42)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.edit_outlined,
                          color: const Color(0xFF9CA3AF),
                          size: 13.r,
                        ),
                        SizedBox(width: 4.w),
                        Text(
                          'Edit',
                          style: TextStyle(
                            fontSize: 11.sp,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF9CA3AF),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          SizedBox(height: 16.h),
          child,
        ],
      ),
    );
  }
}

/// Individual info tile matching the screenshot: label on top, value below,
/// with a dark background and subtle border
class _InfoTile extends StatelessWidget {
  final String label;
  final String? value;
  final bool isHighlighted;
  final Color? highlightColor;

  const _InfoTile({
    required this.label,
    this.value,
    this.isHighlighted = false,
    this.highlightColor,
  });

  @override
  Widget build(BuildContext context) {
    final hColor = highlightColor ?? const Color(0xFF8B5CF6);
    final displayValue = (value != null && value!.isNotEmpty) ? value! : '—';

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
      decoration: BoxDecoration(
        color: isHighlighted
            ? hColor.withAlpha(15)
            : const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(
          color: isHighlighted
              ? hColor.withAlpha(80)
              : const Color(0xFF30363D),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 9.5.sp,
              fontWeight: FontWeight.w700,
              color: isHighlighted
                  ? hColor.withAlpha(200)
                  : const Color(0xFF9CA3AF),
              letterSpacing: 0.5,
            ),
          ),
          SizedBox(height: 4.h),
          Text(
            displayValue,
            style: TextStyle(
              fontSize: isHighlighted ? 15.sp : 13.5.sp,
              fontWeight: FontWeight.w600,
              fontFamily: isHighlighted ? 'monospace' : null,
              color: isHighlighted ? hColor : Colors.white,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

/// Dark modal text input field
class _ModalField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool isRequired;
  final int? maxLength;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final String? hint;

  const _ModalField({
    required this.label,
    required this.controller,
    this.isRequired = false,
    this.maxLength,
    this.inputFormatters,
    this.keyboardType,
    this.validator,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          isRequired ? '$label *' : label,
          style: TextStyle(
            fontSize: 11.5.sp,
            fontWeight: FontWeight.w500,
            color: const Color(0xFF9CA3AF),
          ),
        ),
        SizedBox(height: 4.h),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          maxLength: maxLength,
          buildCounter: maxLength != null
              ? (context, {required currentLength, required isFocused, required maxLength}) => null
              : null,
          validator: validator ?? (isRequired
              ? (v) => (v == null || v.trim().isEmpty)
                  ? 'This field is required'
                  : null
              : null),
          style: TextStyle(fontSize: 13.sp, color: Colors.white),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              color: const Color(0x4DFFFFFF),
              fontSize: 13.sp,
            ),
            filled: true,
            fillColor: const Color(0xFF0D1117),
            contentPadding: EdgeInsets.symmetric(
              horizontal: 12.w,
              vertical: 10.h,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: const BorderSide(color: Color(0xFF30363D)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: const BorderSide(color: Color(0xFF30363D)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: const BorderSide(color: Color(0xFF2563EB)),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: const BorderSide(color: Color(0xFFEF4444)),
            ),
          ),
        ),
      ],
    );
  }
}

class _SpeechBubbleContainer extends StatelessWidget {
  final Widget child;

  const _SpeechBubbleContainer({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _SpeechBubblePainter(
        color: const Color(0xFF13121A),
        borderColor: const Color(0xFF2A2838),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(16.w, 7.r, 7.r, 7.r),
        child: child,
      ),
    );
  }
}

class _SpeechBubblePainter extends CustomPainter {
  final Color color;
  final Color borderColor;

  _SpeechBubblePainter({
    required this.color,
    required this.borderColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const double arrowW = 9.0;
    const double arrowH = 14.0;
    const double radius = 20.0;

    final Path path = Path();
    // Top-left of container body after arrow
    path.moveTo(arrowW + radius, 0);
    path.lineTo(size.width - radius, 0);
    path.arcToPoint(
      Offset(size.width, radius),
      radius: const Radius.circular(radius),
    );
    path.lineTo(size.width, size.height - radius);
    path.arcToPoint(
      Offset(size.width - radius, size.height),
      radius: const Radius.circular(radius),
    );
    path.lineTo(arrowW + radius, size.height);
    path.arcToPoint(
      Offset(arrowW, size.height - radius),
      radius: const Radius.circular(radius),
    );

    // Left border going up to arrow bottom point
    final double centerY = size.height / 2;
    path.lineTo(arrowW, centerY + arrowH / 2);
    // Sharp arrow tip pointing left
    path.lineTo(0, centerY);
    // Up to arrow top point
    path.lineTo(arrowW, centerY - arrowH / 2);
    path.lineTo(arrowW, radius);
    path.arcToPoint(
      Offset(arrowW + radius, 0),
      radius: const Radius.circular(radius),
    );
    path.close();

    // Fill background
    final Paint fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    // Stroke border
    final Paint borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawPath(path, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
