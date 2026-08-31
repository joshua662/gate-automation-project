import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/resident_provider.dart';
import '../../widgets/custom_floating_nav_bar.dart';
import 'profile_screen.dart';
import 'resident_home_screen.dart';
import 'resident_notifications_screen.dart';

class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen> {
  int _currentIndex = 0;

  void _onNavigateTab(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final notifsAsync = ref.watch(notificationsProvider);
    final hasUnreadNotifs = notifsAsync.maybeWhen(
      data: (list) => list.any((n) => !n.isRead),
      orElse: () => false,
    );

    final tabs = [
      ResidentHomeScreen(onNavigateTab: _onNavigateTab),
      const ResidentNotificationsScreen(),
      ProfileScreen(isActive: _currentIndex == 2),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0A0D14),
      extendBody: true,
      body: IndexedStack(index: _currentIndex, children: tabs),
      bottomNavigationBar: CustomFloatingBottomNavBar(
        selectedIndex: _currentIndex,
        onItemSelected: (i) => setState(() => _currentIndex = i),
        items: [
          const NavItemData(
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            label: 'Home',
          ),
          NavItemData(
            icon: Icons.notifications_outlined,
            selectedIcon: Icons.notifications_rounded,
            label: 'Alerts',
            hasBadge: hasUnreadNotifs,
          ),
          const NavItemData(
            icon: Icons.person_outline,
            selectedIcon: Icons.person_rounded,
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

