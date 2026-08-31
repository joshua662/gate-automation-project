import 'dart:ui';
import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

class NavItemData {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool hasBadge;

  const NavItemData({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.hasBadge = false,
  });
}

/// A modern floating navigation bar matching the design:
/// - Rounded pill floating container with blur
/// - Rounded squircle card background for the active tab
/// - Icon on top, label below, and a small glowing active dot underneath
/// - Small notification indicator badge support
class CustomFloatingBottomNavBar extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onItemSelected;
  final List<NavItemData> items;

  const CustomFloatingBottomNavBar({
    super.key,
    required this.selectedIndex,
    required this.onItemSelected,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Translucent bar container
    final barBgColor = isDark
        ? const Color(0xFF13171F).withValues(alpha: 0.85) // Dark glass
        : const Color(0xFFFFFFFF).withValues(alpha: 0.90); // Light glass

    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.black.withValues(alpha: 0.06);

    // Active item background card (subtle highlighted squircle)
    final activeCardColor = isDark
        ? Colors.white.withValues(alpha: 0.10)
        : AppColors.primary.withValues(alpha: 0.12);

    final activeColor = isDark ? Colors.white : AppColors.primary;
    final inactiveColor = isDark
        ? const Color(0xFF8B949E)
        : const Color(0xFF64748B);

    return Container(
      color: Colors.transparent,
      padding: const EdgeInsets.only(left: 16, right: 16, bottom: 18, top: 4),
      child: SafeArea(
        top: false,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(40),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              height: 74,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: barBgColor,
                borderRadius: BorderRadius.circular(40),
                border: Border.all(color: borderColor, width: 1),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.08),
                    blurRadius: 28,
                    spreadRadius: 2,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: List.generate(items.length, (index) {
                  final isSelected = selectedIndex == index;
                  final item = items[index];

                  return Expanded(
                    child: GestureDetector(
                      onTap: () => onItemSelected(index),
                      behavior: HitTestBehavior.opaque,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeOutCubic,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        decoration: BoxDecoration(
                          color: isSelected ? activeCardColor : Colors.transparent,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // ── Icon with Badge ───────────────────────
                            Stack(
                              clipBehavior: Clip.none,
                              alignment: Alignment.center,
                              children: [
                                Icon(
                                  isSelected ? item.selectedIcon : item.icon,
                                  color: isSelected ? activeColor : inactiveColor,
                                  size: 22,
                                ),
                                if (item.hasBadge)
                                  Positioned(
                                    top: -1,
                                    right: -3,
                                    child: Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 3),

                            // ── Label ────────────────────────────────
                            Text(
                              item.label,
                              style: TextStyle(
                                color: isSelected ? activeColor : inactiveColor,
                                fontSize: 11.5,
                                fontWeight: isSelected
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                                letterSpacing: -0.2,
                              ),
                            ),
                            const SizedBox(height: 3),

                            // ── Bottom Active Indicator Dot ──────────
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: isSelected ? 4 : 0,
                              height: isSelected ? 4 : 0,
                              decoration: BoxDecoration(
                                color: activeColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
}


