import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';

/// Shared back helper — prefers pop, otherwise goes to [fallback].
void cr8Back(BuildContext context, {String fallback = '/'}) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(fallback);
  }
}

/// Full-bleed studio atmosphere (web hero parity), tuned for **mobile portrait**
/// so the photo stays visible (previous veil was nearly solid black on phones).
class StudioBackdrop extends StatefulWidget {
  const StudioBackdrop({
    super.key,
    this.child,
    this.showHeroImage = true,
    /// 0 = bright photo, 1 = heavy dim. Mobile default keeps the image readable.
    this.dim = 0.35,
  });

  final Widget? child;
  final bool showHeroImage;
  final double dim;

  @override
  State<StudioBackdrop> createState() => _StudioBackdropState();
}

class _StudioBackdropState extends State<StudioBackdrop> with TickerProviderStateMixin {
  late final AnimationController _orb;
  late final AnimationController _veil;

  @override
  void initState() {
    super.initState();
    _orb = AnimationController(vsync: this, duration: const Duration(seconds: 6))..repeat(reverse: true);
    _veil = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();
  }

  @override
  void dispose() {
    _orb.dispose();
    _veil.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dim = widget.dim.clamp(0.0, 0.85);
    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: Color(0xFF0A0A0A)),
        if (widget.showHeroImage)
          Positioned.fill(
            child: FadeTransition(
              opacity: CurvedAnimation(
                parent: _veil,
                curve: const Interval(0.05, 0.55, curve: Curves.easeOut),
              ),
              child: ScaleTransition(
                scale: Tween<double>(begin: 1.06, end: 1.0).animate(
                  CurvedAnimation(parent: _veil, curve: const Interval(0.0, 0.7, curve: Curves.easeOutCubic)),
                ),
                child: Image.asset(
                  'assets/images/hero_models_bg.jpg',
                  fit: BoxFit.cover,
                  alignment: const Alignment(0.15, -0.4),
                  filterQuality: FilterQuality.medium,
                  errorBuilder: (_, __, ___) => const ColoredBox(color: Color(0xFF1A1214)),
                ),
              ),
            ),
          ),
        // Mobile-friendly veil: keep photo visible, darken mainly at bottom for text/CTAs
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xFF0A0A0A).withOpacity(0.25 + dim * 0.25),
                  const Color(0xFF0A0A0A).withOpacity(0.15 + dim * 0.2),
                  const Color(0xFF0A0A0A).withOpacity(0.55 + dim * 0.25),
                  const Color(0xFF0A0A0A).withOpacity(0.92),
                ],
                stops: const [0.0, 0.35, 0.65, 1.0],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  const Color(0xFF0A0A0A).withOpacity(0.55),
                  const Color(0xFF0A0A0A).withOpacity(0.2),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.45, 1.0],
              ),
            ),
          ),
        ),
        AnimatedBuilder(
          animation: _orb,
          builder: (context, _) {
            final t = _orb.value;
            final h = MediaQuery.sizeOf(context).height;
            return Stack(
              children: [
                _GlowOrb(
                  color: Cr8Colors.accent,
                  size: 200,
                  left: -30,
                  top: h * 0.18,
                  opacity: 0.08 + 0.06 * t,
                ),
                _GlowOrb(
                  color: const Color(0xFF007AFF),
                  size: 160,
                  right: -24,
                  top: h * 0.55,
                  opacity: 0.06 + 0.05 * (1 - t),
                ),
                _GlowOrb(
                  color: Cr8Colors.success,
                  size: 120,
                  left: 40,
                  top: h * 0.72,
                  opacity: 0.05 + 0.04 * math.sin(t * math.pi),
                ),
              ],
            );
          },
        ),
        IgnorePointer(
          child: Opacity(
            opacity: 0.045,
            child: CustomPaint(painter: _GrainPainter(seed: 7), size: Size.infinite),
          ),
        ),
        // Curtain wipe (short)
        IgnorePointer(
          child: AnimatedBuilder(
            animation: _veil,
            builder: (context, _) {
              final p = Curves.easeInOutCubic.transform(_veil.value.clamp(0.0, 1.0));
              if (p >= 0.99) return const SizedBox.shrink();
              return Align(
                alignment: Alignment.topCenter,
                child: FractionallySizedBox(
                  heightFactor: (1 - p).clamp(0.0, 1.0),
                  widthFactor: 1,
                  child: const ColoredBox(color: Color(0xFF0A0A0A)),
                ),
              );
            },
          ),
        ),
        if (widget.child != null) Positioned.fill(child: widget.child!),
      ],
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({
    required this.color,
    required this.size,
    required this.opacity,
    this.left,
    this.right,
    this.top,
  });

  final Color color;
  final double size;
  final double opacity;
  final double? left;
  final double? right;
  final double? top;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: left,
      right: right,
      top: top,
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 42, sigmaY: 42),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withOpacity(opacity),
          ),
        ),
      ),
    );
  }
}

class _GrainPainter extends CustomPainter {
  _GrainPainter({required this.seed});
  final int seed;

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(seed);
    final paint = Paint()..color = Colors.white;
    final count = (size.width * size.height / 9000).clamp(120, 400).toInt();
    for (var i = 0; i < count; i++) {
      final x = rnd.nextDouble() * size.width;
      final y = rnd.nextDouble() * size.height;
      canvas.drawCircle(Offset(x, y), rnd.nextDouble() * 0.7 + 0.2, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GrainPainter oldDelegate) => false;
}

class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    required this.animation,
    this.begin = const Offset(0, 0.12),
    this.interval = const Interval(0.2, 1, curve: Curves.easeOutCubic),
  });

  final Widget child;
  final Animation<double> animation;
  final Offset begin;
  final Interval interval;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: animation, curve: interval);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(begin: begin, end: Offset.zero).animate(curved),
        child: child,
      ),
    );
  }
}

class StudioAccentBar extends StatelessWidget {
  const StudioAccentBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 3,
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Cr8Colors.accent, Color(0xFF7C3AED), Cr8Colors.success],
        ),
      ),
    );
  }
}

/// AppBar-style back that always returns somewhere sensible.
class Cr8BackButton extends StatelessWidget {
  const Cr8BackButton({super.key, this.fallback = '/', this.color = Colors.white70});
  final String fallback;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Back',
      onPressed: () => cr8Back(context, fallback: fallback),
      icon: Icon(Icons.arrow_back, color: color),
    );
  }
}
