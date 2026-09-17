import 'package:flutter/material.dart';

/// Custom calendar picker matching the app's dark violet design.
/// Shows a modal with fade+scale animation. Returns a [DateTime] or null.
Future<DateTime?> showCustomCalendarPicker({
  required BuildContext context,
  DateTime? initialDate,
}) {
  return showGeneralDialog<DateTime>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Calendar',
    barrierColor: Colors.black.withOpacity(0.6),
    transitionDuration: const Duration(milliseconds: 280),
    transitionBuilder: (ctx, animation, secondary, child) {
      final curve = CurvedAnimation(
        parent: animation,
        curve: const Cubic(0.34, 1.56, 0.64, 1),
      );
      return FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.92, end: 1.0).animate(curve),
          child: child,
        ),
      );
    },
    pageBuilder: (ctx, _, __) => _CalendarDialog(initialDate: initialDate ?? DateTime.now()),
  );
}

// ─── Dialog wrapper ─────────────────────────────────────────────────────────

class _CalendarDialog extends StatelessWidget {
  final DateTime initialDate;
  const _CalendarDialog({required this.initialDate});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.92,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1640),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF4C3A9E), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.5),
                blurRadius: 40,
                offset: const Offset(0, 16),
              ),
            ],
          ),
          child: _CalendarWidget(initialDate: initialDate),
        ),
      ),
    );
  }
}

// ─── Calendar widget ─────────────────────────────────────────────────────────

class _CalendarWidget extends StatefulWidget {
  final DateTime initialDate;
  const _CalendarWidget({required this.initialDate});

  @override
  State<_CalendarWidget> createState() => _CalendarWidgetState();
}

class _CalendarWidgetState extends State<_CalendarWidget> {
  late int _viewYear;
  late int _viewMonth;
  late DateTime _selectedDate;

  static const _weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  static const _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.initialDate;
    _viewYear  = widget.initialDate.year;
    _viewMonth = widget.initialDate.month;
  }

  void _prevMonth() => setState(() {
    if (_viewMonth == 1) { _viewMonth = 12; _viewYear--; }
    else _viewMonth--;
  });

  void _nextMonth() => setState(() {
    if (_viewMonth == 12) { _viewMonth = 1; _viewYear++; }
    else _viewMonth++;
  });

  int get _daysInMonth => DateTime(_viewYear, _viewMonth + 1, 0).day;
  int get _firstWeekday => DateTime(_viewYear, _viewMonth, 1).weekday % 7; // Sun=0

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final years = List.generate(110, (i) => now.year - i);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ── Header: month dropdown + year dropdown + prev/next ──────────────
        Row(
          children: [
            // Month dropdown
            _DropdownPill<int>(
              value: _viewMonth,
              items: List.generate(12, (i) => i + 1),
              label: (v) => _monthNames[v - 1],
              onChanged: (v) => setState(() => _viewMonth = v),
            ),
            const SizedBox(width: 8),
            // Year dropdown
            _DropdownPill<int>(
              value: _viewYear,
              items: years,
              label: (v) => v.toString(),
              onChanged: (v) => setState(() => _viewYear = v),
            ),
            const Spacer(),
            // Prev
            _NavButton(icon: Icons.chevron_left, onTap: _prevMonth),
            const SizedBox(width: 6),
            // Next
            _NavButton(icon: Icons.chevron_right, onTap: _nextMonth),
          ],
        ),

        const SizedBox(height: 16),

        // ── Weekday headers ─────────────────────────────────────────────────
        Row(
          children: _weekdays.map((d) => Expanded(
            child: Center(
              child: Text(
                d,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF8B82C4),
                  letterSpacing: 0.5,
                ),
              ),
            ),
          )).toList(),
        ),

        const SizedBox(height: 8),

        // ── Days grid ───────────────────────────────────────────────────────
        _buildDaysGrid(now),

        const SizedBox(height: 12),
        const Divider(color: Color(0xFF2D2860), height: 1),
        const SizedBox(height: 10),

        // ── Footer: Clear + Today ───────────────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
              style: TextButton.styleFrom(padding: EdgeInsets.zero),
              child: const Text(
                'Clear',
                style: TextStyle(
                  color: Color(0xFFDDD6FE),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(now),
              style: TextButton.styleFrom(padding: EdgeInsets.zero),
              child: const Text(
                'Today',
                style: TextStyle(
                  color: Color(0xFF7C3AED),
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDaysGrid(DateTime now) {
    final totalCells = _firstWeekday + _daysInMonth;
    final rows = (totalCells / 7).ceil();

    return Column(
      children: List.generate(rows, (row) {
        return Row(
          children: List.generate(7, (col) {
            final cellIndex = row * 7 + col;
            final day = cellIndex - _firstWeekday + 1;

            // Leading/trailing filler
            if (day < 1 || day > _daysInMonth) {
              final fillerDay = day < 1
                  ? DateTime(_viewYear, _viewMonth, 0).day + day
                  : day - _daysInMonth;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Center(
                    child: Text(
                      '$fillerDay',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF3D3870),
                      ),
                    ),
                  ),
                ),
              );
            }

            final thisDate = DateTime(_viewYear, _viewMonth, day);
            final isSelected = thisDate.year == _selectedDate.year &&
                thisDate.month == _selectedDate.month &&
                thisDate.day == _selectedDate.day;
            final isToday = thisDate.year == now.year &&
                thisDate.month == now.month &&
                thisDate.day == now.day;

            return Expanded(
              child: GestureDetector(
                onTap: () {
                  Navigator.of(context).pop(thisDate);
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Center(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 36,
                      height: 36,
                      decoration: isSelected
                          ? BoxDecoration(
                              color: const Color(0xFF6D28D9),
                              borderRadius: BorderRadius.circular(8),
                            )
                          : isToday
                              ? BoxDecoration(
                                  border: Border.all(
                                    color: const Color(0xFF7C3AED),
                                    width: 1.5,
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                )
                              : null,
                      child: Center(
                        child: Text(
                          '$day',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: isSelected || isToday
                                ? FontWeight.w700
                                : FontWeight.w400,
                            color: isSelected
                                ? Colors.white
                                : isToday
                                    ? const Color(0xFFC4B5FD)
                                    : const Color(0xFFDDD6FE),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }),
        );
      }),
    );
  }
}

// ─── Reusable dropdown pill ──────────────────────────────────────────────────

class _DropdownPill<T> extends StatelessWidget {
  final T value;
  final List<T> items;
  final String Function(T) label;
  final ValueChanged<T> onChanged;

  const _DropdownPill({
    required this.value,
    required this.items,
    required this.label,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF211D52),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF3D3870)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isDense: true,
          dropdownColor: const Color(0xFF211D52),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF8B82C4), size: 18),
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            color: Colors.white,
            fontFamily: 'Inter',
          ),
          items: items.map((item) => DropdownMenuItem<T>(
            value: item,
            child: Text(label(item)),
          )).toList(),
          onChanged: (v) { if (v != null) onChanged(v); },
        ),
      ),
    );
  }
}

// ─── Nav button (prev / next) ────────────────────────────────────────────────

class _NavButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _NavButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: const Color(0xFF211D52),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF3D3870)),
        ),
        child: Icon(icon, size: 18, color: const Color(0xFFDDD6FE)),
      ),
    );
  }
}
