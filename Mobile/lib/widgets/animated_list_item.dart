import 'package:flutter/material.dart';

/// Wraps a child widget in a staggered fade + slide-up animation.
///
/// Use [index] to stagger items in a list — each item starts its animation
/// [staggerDelay] * [index] ms after the previous one.
///
/// Example:
/// ```dart
/// AnimatedListItem(
///   index: i,
///   child: MyCard(...),
/// )
/// ```
class AnimatedListItem extends StatefulWidget {
  final Widget child;

  /// Position of this item in the list. Drives the stagger offset.
  final int index;

  /// Delay per item step. Total delay = index * staggerDelay.
  final Duration staggerDelay;

  /// Total duration of the entrance animation.
  final Duration duration;

  /// How far (in logical pixels) the child slides up from its resting position.
  final double slideOffset;

  const AnimatedListItem({
    super.key,
    required this.child,
    required this.index,
    this.staggerDelay = const Duration(milliseconds: 60),
    this.duration = const Duration(milliseconds: 420),
    this.slideOffset = 28.0,
  });

  @override
  State<AnimatedListItem> createState() => _AnimatedListItemState();
}

class _AnimatedListItemState extends State<AnimatedListItem>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();

    _ctrl = AnimationController(vsync: this, duration: widget.duration);

    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);

    _slide = Tween<Offset>(
      begin: Offset(0, widget.slideOffset / 100),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));

    // Stagger the start based on index
    final delay = widget.staggerDelay * widget.index;
    if (delay == Duration.zero) {
      _ctrl.forward();
    } else {
      Future.delayed(delay, () {
        if (mounted) _ctrl.forward();
      });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: widget.child,
      ),
    );
  }
}
