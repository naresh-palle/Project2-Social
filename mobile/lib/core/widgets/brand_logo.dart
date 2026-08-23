import 'package:flutter/material.dart';

/// flugr brand assets — speed-F mark and F+FLUGR wordmark.
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.variant = BrandLogoVariant.wordmark,
    this.height = 36,
  });

  final BrandLogoVariant variant;
  final double height;

  @override
  Widget build(BuildContext context) {
    final asset = variant == BrandLogoVariant.mark
        ? 'assets/images/flugr-mark.png'
        : 'assets/images/flugr-logo.png';
    return Image.asset(
      asset,
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      errorBuilder: (_, __, ___) => Text(
        'flugr',
        style: TextStyle(
          color: const Color(0xFFFF3B30),
          fontSize: height * 0.7,
          fontStyle: FontStyle.italic,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

enum BrandLogoVariant { mark, wordmark }
