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

/// Full-bleed studio atmosphere (web hero parity) — light SaaS aurora.
class StudioBackdrop extends StatefulWidget {
  const StudioBackdrop({
    super.key,
    this.child,
    this.showHeroImage = true,
    /// 0 = bright photo, 1 = heavier soft veil. Light default keeps art readable.
    this.dim = 0.18,
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
    const base = Cr8Colors.bg;
    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: base),
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
                  'assets/images/flugr-home-light-aurora-mobile.jpg',
                  fit: BoxFit.cover,
                  alignment: const Alignment(0, -0.15),
                  filterQuality: FilterQuality.medium,
                  errorBuilder: (_, __, ___) => Image.asset(
                    'assets/images/hero_models_bg.jpg',
                    fit: BoxFit.cover,
                    alignment: const Alignment(0, -0.15),
                    errorBuilder: (_, __, ___) => const ColoredBox(color: Cr8Colors.bg),
                  ),
                ),
              ),
            ),
          ),
        // Soft light veil — keep aurora visible, gently lift bottom for CTAs
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.white.withValues(alpha: 0.18 + dim * 0.15),
                  Colors.white.withValues(alpha: 0.08 + dim * 0.1),
                  const Color(0xFFFFF7FB).withValues(alpha: 0.30 + dim * 0.2),
                  const Color(0xFFF3EEFF).withValues(alpha: 0.72 + dim * 0.12),
                ],
                stops: const [0.0, 0.35, 0.68, 1.0],
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
                  Colors.white.withValues(alpha: 0.35),
                  Colors.white.withValues(alpha: 0.08),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.4, 1.0],
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
                  opacity: 0.07 + 0.05 * t,
                ),
                _GlowOrb(
                  color: Cr8Colors.violet,
                  size: 180,
                  right: -24,
                  top: h * 0.12,
                  opacity: 0.06 + 0.05 * (1 - t),
                ),
                _GlowOrb(
                  color: Cr8Colors.success,
                  size: 140,
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
            opacity: 0.03,
            child: CustomPaint(painter: _GrainPainter(seed: 7), size: Size.infinite),
          ),
        ),
        // Curtain wipe (short) — light paper
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
                  child: const ColoredBox(color: Cr8Colors.bg),
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
            color: color.withValues(alpha: opacity),
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
    final paint = Paint()..color = const Color(0xFF0F172A);
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
          colors: [Cr8Colors.accent, Cr8Colors.violet, Cr8Colors.success],
        ),
      ),
    );
  }
}

/// AppBar-style back that always returns somewhere sensible.
class Cr8BackButton extends StatelessWidget {
  const Cr8BackButton({super.key, this.fallback = '/', this.color = Cr8Colors.text});
  final String fallback;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Back',
      onPressed: () => cr8Back(context, fallback: fallback),
      icon: Icon(Icons.arrow_back, color: color.withValues(alpha: 0.72)),
    );
  }
}
