import 'package:flutter/material.dart';

/// flugr brand assets — P6 stacked identity.
enum BrandLogoVariant { mark, wordmark, stacked }

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
    final asset = switch (variant) {
      BrandLogoVariant.mark => 'assets/images/flugr-mark.png',
      BrandLogoVariant.stacked => 'assets/images/flugr-logo-stacked.png',
      BrandLogoVariant.wordmark => 'assets/images/flugr-logo.png',
    };
    return Image.asset(
      asset,
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      errorBuilder: (_, __, ___) => Text(
        'flugr',
        style: TextStyle(
          color: const Color(0xFFFF2D55),
          fontSize: height * 0.55,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}
