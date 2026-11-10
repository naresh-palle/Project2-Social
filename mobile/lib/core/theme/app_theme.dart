import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Vibrant light social palette aligned with flugr web.
class Cr8Colors {
  Cr8Colors._();
  static const bg = Color(0xFFFFF7FB);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF1E1B4B);
  static const accent = Color(0xFFFF2D55);
  static const success = Color(0xFF14B8A6);
  static const violet = Color(0xFF7C3AED);
  static const warning = Color(0xFFF59E0B);
  static const info = Color(0xFF7C3AED);
  static const muted = Color(0xFF5B5678);
  static const hairline = Color(0x1F7C3AED);
}

/// Dark-mode counterparts kept for ThemeMode.dark.
class Cr8DarkColors {
  Cr8DarkColors._();
  static const bg = Color(0xFF0B0B0E);
  static const surface = Color(0xFF121212);
  static const text = Color(0xFFF4F4F0);
  static const muted = Color(0x99F4F4F0);
  static const hairline = Color(0x26FFFFFF);
}

class AppTheme {
  AppTheme._();

  static ThemeData _build({
    required Brightness brightness,
    required Color bg,
    required Color surface,
    required Color text,
    required Color muted,
    required Color hairline,
    required bool highContrast,
    required double fontScale,
  }) {
    final isDark = brightness == Brightness.dark;
    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: Cr8Colors.accent,
        onPrimary: Colors.white,
        secondary: Cr8Colors.violet,
        onSecondary: Colors.white,
        tertiary: Cr8Colors.success,
        onTertiary: Colors.white,
        surface: surface,
        onSurface: text,
        error: Cr8Colors.accent,
        onError: Colors.white,
      ),
    );

    final editorial = GoogleFonts.playfairDisplayTextTheme(base.textTheme)
        .apply(bodyColor: text, displayColor: text);
    final mono = GoogleFonts.jetBrainsMonoTextTheme(base.textTheme);

    return base.copyWith(
      textTheme: editorial.copyWith(
        bodyLarge: GoogleFonts.manrope(color: text, fontSize: 16 * fontScale),
        bodyMedium: GoogleFonts.manrope(color: text, fontSize: 14 * fontScale),
        bodySmall: mono.bodySmall?.copyWith(
          color: highContrast ? text : muted,
          letterSpacing: 1.2,
          fontSize: 11 * fontScale,
        ),
        labelSmall: mono.labelSmall?.copyWith(
          color: highContrast ? text : muted,
          letterSpacing: 2.2,
          fontSize: 10 * fontScale,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bg.withValues(alpha: 0.92),
        foregroundColor: text,
        elevation: 0,
        titleTextStyle: GoogleFonts.playfairDisplay(
          color: text,
          fontSize: 22,
          fontStyle: FontStyle.italic,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        isDense: true,
        hintStyle: GoogleFonts.manrope(color: muted, fontSize: 14 * fontScale),
        labelStyle: GoogleFonts.manrope(
          color: muted,
          fontSize: 11 * fontScale,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.4,
        ),
        floatingLabelStyle: GoogleFonts.manrope(
          color: Cr8Colors.accent,
          fontSize: 11 * fontScale,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.4,
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 8),
        enabledBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: hairline),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: Cr8Colors.accent),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Cr8Colors.accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          textStyle: GoogleFonts.manrope(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.6,
            fontSize: 12 * fontScale,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          side: BorderSide(color: hairline),
        ),
      ),
      dividerColor: hairline,
      cardColor: surface,
      snackBarTheme: SnackBarThemeData(
        backgroundColor: surface,
        contentTextStyle: TextStyle(color: text),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: Cr8Colors.accent,
        elevation: 0,
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.manrope(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? text : muted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? Colors.white : muted,
            size: 22,
          );
        }),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        shadowColor: isDark ? Colors.black54 : const Color(0x227C3AED),
      ),
    );
  }

  static ThemeData dark({bool highContrast = false, double fontScale = 1}) {
    return _build(
      brightness: Brightness.dark,
      bg: Cr8DarkColors.bg,
      surface: Cr8DarkColors.surface,
      text: Cr8DarkColors.text,
      muted: Cr8DarkColors.muted,
      hairline: Cr8DarkColors.hairline,
      highContrast: highContrast,
      fontScale: fontScale,
    );
  }

  static ThemeData light({bool highContrast = false, double fontScale = 1}) {
    return _build(
      brightness: Brightness.light,
      bg: Cr8Colors.bg,
      surface: Cr8Colors.surface,
      text: Cr8Colors.text,
      muted: Cr8Colors.muted,
      hairline: Cr8Colors.hairline,
      highContrast: highContrast,
      fontScale: fontScale,
    );
  }
}
