import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Full-bleed studio atmosphere matching the web landing/login look:
/// hero photo (optional), gradient veil, grain, and soft pulsing glow orbs.
class StudioBackdrop extends StatefulWidget {
  const StudioBackdrop({
    super.key,
    this.child,
    this.showHeroImage = true,
    this.dim = 0.55,
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
    _veil = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..forward();
  }

  @override
  void dispose() {
    _orb.dispose();
    _veil.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: Color(0xFF0A0A0A)),
        if (widget.showHeroImage)
          FadeTransition(
            opacity: CurvedAnimation(parent: _veil, curve: const Interval(0.25, 1, curve: Curves.easeOut)),
            child: ScaleTransition(
              scale: Tween<double>(begin: 1.08, end: 1.0).animate(
                CurvedAnimation(parent: _veil, curve: const Interval(0.2, 1, curve: Curves.easeOutCubic)),
              ),
              child: Image.asset(
                'assets/images/hero_models_bg.jpg',
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          ),
        // Left-weighted dark veil like the web hero
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                const Color(0xFF0A0A0A),
                const Color(0xFF0A0A0A).withValues(alpha: 0.88),
                const Color(0xFF0A0A0A).withValues(alpha: widget.dim),
                const Color(0xFF0A0A0A).withValues(alpha: 0.25),
              ],
              stops: const [0.0, 0.35, 0.55, 1.0],
            ),
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.transparent,
                const Color(0xFF0A0A0A).withValues(alpha: 0.35),
                const Color(0xFF0A0A0A),
              ],
              stops: const [0.45, 0.75, 1.0],
            ),
          ),
        ),
        AnimatedBuilder(
          animation: _orb,
          builder: (context, _) {
            final t = _orb.value;
            return Stack(
              children: [
                _GlowOrb(
                  color: Cr8Colors.accent,
                  size: 220,
                  left: -40,
                  top: MediaQuery.sizeOf(context).height * 0.22,
                  opacity: 0.04 + 0.05 * t,
                ),
                _GlowOrb(
                  color: const Color(0xFF007AFF),
                  size: 160,
                  left: 24,
                  top: MediaQuery.sizeOf(context).height * 0.62,
                  opacity: 0.03 + 0.05 * (1 - t),
                ),
                _GlowOrb(
                  color: Cr8Colors.success,
                  size: 140,
                  right: -20,
                  top: MediaQuery.sizeOf(context).height * 0.18,
                  opacity: 0.03 + 0.04 * math.sin(t * math.pi),
                ),
              ],
            );
          },
        ),
        // Soft film grain
        IgnorePointer(
          child: Opacity(
            opacity: 0.04,
            child: CustomPaint(painter: _GrainPainter(seed: 7), size: Size.infinite),
          ),
        ),
        // Curtain reveal
        IgnorePointer(
          child: AnimatedBuilder(
            animation: _veil,
            builder: (context, _) {
              final p = Curves.easeInOutCubic.transform(_veil.value.clamp(0.0, 1.0));
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
        if (widget.child != null) widget.child!,
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
        imageFilter: ImageFilter.blur(sigmaX: 48, sigmaY: 48),
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
    final paint = Paint()..color = Colors.white;
    for (var i = 0; i < 180; i++) {
      final x = rnd.nextDouble() * size.width;
      final y = rnd.nextDouble() * size.height;
      canvas.drawCircle(Offset(x, y), rnd.nextDouble() * 0.8 + 0.2, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GrainPainter oldDelegate) => false;
}

/// Fade + slide entrance used on landing / auth copy (web MaskLine / FadeUp parity).
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

/// Thin accent bar like the web login card top edge.
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
