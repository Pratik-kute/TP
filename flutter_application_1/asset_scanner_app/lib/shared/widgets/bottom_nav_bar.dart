import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';

class BottomNavBar extends StatelessWidget {
  const BottomNavBar({
    required this.currentIndex,
    required this.onTap,
    super.key,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 80,
      decoration: BoxDecoration(
        color: AppColors.background,
        border: const Border(
          top: BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: <Widget>[
            _NavItem(
              icon: Icons.dashboard_outlined,
              label: 'Home',
              isActive: currentIndex == 0,
              onTap: () => onTap(0),
            ),
            _NavItem(
              icon: Icons.inventory_2_outlined,
              label: 'Assets',
              isActive: currentIndex == 1,
              onTap: () => onTap(1),
            ),
            _NavItem(
              icon: Icons.qr_code_scanner,
              label: 'Scan',
              isActive: currentIndex == 2,
              isProminent: true,
              onTap: () => onTap(2),
            ),
            _NavItem(
              icon: Icons.history,
              label: 'Activity',
              isActive: currentIndex == 3,
              onTap: () => onTap(3),
            ),
            _NavItem(
              icon: Icons.person_outline,
              label: 'Profile',
              isActive: currentIndex == 4,
              onTap: () => onTap(4),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
    this.isProminent = false,
  });

  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  final bool isProminent;

  @override
  Widget build(BuildContext context) {
    final color = isActive ? AppColors.brand : AppColors.textMuted;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Container(
              padding: isProminent ? const EdgeInsets.all(8) : EdgeInsets.zero,
              decoration: isProminent
                  ? BoxDecoration(
                      color: isActive
                          ? AppColors.brand
                          : AppColors.brand.withOpacity(0.1),
                      shape: BoxShape.circle,
                    )
                  : null,
              child: Icon(
                icon,
                color: isProminent && isActive ? Colors.white : color,
                size: isProminent ? 28 : 24,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label.toUpperCase(),
              style: AppTypography.sectionLabel.copyWith(
                color: color,
                fontSize: 10,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
