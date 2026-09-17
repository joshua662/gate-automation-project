import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/router/app_router.dart';
import '../../core/utils/toast_helper.dart';
import '../../providers/user_provider.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/app_loading.dart';
import '../../widgets/modals/action_confirm_dialog.dart';
import '../../widgets/user_card.dart';

class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});

  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(usersProvider);

    return Scaffold(
      body: Column(
        children: [
          // ── Custom app bar ─────────────────────────────────────────────
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0A0E27), Color(0xFF1D4ED8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: EdgeInsets.fromLTRB(20.w, 16.h, 12.w, 16.h),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        AppStrings.users,
                        style: TextStyle(
                          fontSize: 20.sp,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.refresh_rounded,
                        color: Colors.white70,
                      ),
                      onPressed: () =>
                          ref.read(usersProvider.notifier).refresh(),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Search bar ─────────────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 0),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search by name or email...',
                prefixIcon:
                    const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 16.w,
                  vertical: 12.h,
                ),
              ),
            ),
          ),

          SizedBox(height: 8.h),

          // ── Users list ─────────────────────────────────────────────────
          Expanded(
            child: usersAsync.when(
              loading: () => const AppLoading(),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.error.withAlpha(20),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.error_outline_rounded,
                        size: 40,
                        color: AppColors.error,
                      ),
                    ),
                    SizedBox(height: 16.h),
                    Text(
                      'Failed to load users',
                      style: TextStyle(
                        fontSize: 15.sp,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    SizedBox(height: 12.h),
                    ElevatedButton.icon(
                      onPressed: () =>
                          ref.read(usersProvider.notifier).refresh(),
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (users) {
                final filtered = _query.isEmpty
                    ? users
                    : users
                        .where(
                          (u) =>
                              u.name.toLowerCase().contains(_query) ||
                              u.email.toLowerCase().contains(_query),
                        )
                        .toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: AppColors.textSecondary.withAlpha(18),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.people_outline_rounded,
                            size: 48,
                            color: AppColors.textSecondary.withAlpha(150),
                          ),
                        ),
                        SizedBox(height: 16.h),
                        Text(
                          _query.isEmpty
                              ? 'No users yet'
                              : 'No results for "$_query"',
                          style: TextStyle(
                            fontSize: 15.sp,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () =>
                      ref.read(usersProvider.notifier).refresh(),
                  child: ListView.builder(
                    padding: EdgeInsets.symmetric(
                      horizontal: 12.w,
                      vertical: 8.h,
                    ),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final user = filtered[index];
                      return AnimatedListItem(
                        index: index,
                        staggerDelay: const Duration(milliseconds: 50),
                        child: UserCard(
                          user: user,
                          onTap: () => Navigator.of(context).pushNamed(
                            AppRouter.viewUser,
                            arguments: user,
                          ),
                          onEdit: () async {
                            await Navigator.of(context).pushNamed(
                              AppRouter.editUser,
                              arguments: user,
                            );
                            ref.read(usersProvider.notifier).refresh();
                          },
                          onDelete: () => _confirmDelete(user.id, user.name),
                          onRestore: user.isDeleted
                              ? () => _restore(user.id)
                              : null,
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).pushNamed(AppRouter.createUser);
          ref.read(usersProvider.notifier).refresh();
        },
        icon: const Icon(Icons.person_add_rounded),
        label: const Text('New User'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 4,
      ),
    );
  }

  Future<void> _confirmDelete(int id, String name) async {
    final confirm = await ActionConfirmDialog.show(
      context,
      title: 'Delete User',
      message: 'Are you sure you want to delete "$name"? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmColor: const Color(0xFFEF4444),
      icon: Icons.delete_outline_rounded,
    );
    if (confirm == true && mounted) {
      try {
        await ref.read(usersProvider.notifier).deleteUser(id);
        if (mounted) ToastHelper.showSuccess(context, 'User deleted');
      } catch (e) {
        if (mounted) ToastHelper.showError(context, 'Failed to delete user');
      }
    }
  }

  Future<void> _restore(int id) async {
    try {
      await ref.read(usersProvider.notifier).restoreUser(id);
      if (mounted) ToastHelper.showSuccess(context, 'User restored');
    } catch (e) {
      if (mounted) ToastHelper.showError(context, 'Failed to restore user');
    }
  }
}
