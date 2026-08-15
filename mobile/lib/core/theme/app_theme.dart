import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Visual tokens aligned with the CR8 web app.
class Cr8Colors {
  Cr8Colors._();
  static const bg = Color(0xFF0B0B0E);
  static const surface = Color(0xFF121212);
  static const text = Color(0xFFF4F4F0);
  static const accent = Color(0xFFFF3B30);
  static const success = Color(0xFF34C759);
  static const warning = Color(0xFFFF9500);
  static const info = Color(0xFF0A84FF);
  static const muted = Color(0x99F4F4F0);
  static const hairline = Color(0x26FFFFFF);
}

class AppTheme {
  AppTheme._();

  static ThemeData dark({bool highContrast = false, double fontScale = 1}) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: Cr8Colors.bg,
      colorScheme: const ColorScheme.dark(
        primary: Cr8Colors.accent,
        secondary: Cr8Colors.success,
        surface: Cr8Colors.surface,
        onPrimary: Colors.white,
        onSurface: Cr8Colors.text,
        error: Cr8Colors.accent,
      ),
    );

    final editorial = GoogleFonts.playfairDisplayTextTheme(base.textTheme)
        .apply(bodyColor: Cr8Colors.text, displayColor: Cr8Colors.text);
    final mono = GoogleFonts.jetBrainsMonoTextTheme(base.textTheme);

    return base.copyWith(
      textTheme: editorial.copyWith(
        bodyLarge: GoogleFonts.manrope(color: Cr8Colors.text, fontSize: 16 * fontScale),
        bodyMedium: GoogleFonts.manrope(color: Cr8Colors.text, fontSize: 14 * fontScale),
        bodySmall: mono.bodySmall?.copyWith(
          color: highContrast ? Cr8Colors.text : Cr8Colors.muted,
          letterSpacing: 1.2,
          fontSize: 11 * fontScale,
        ),
        labelSmall: mono.labelSmall?.copyWith(
          color: highContrast ? Cr8Colors.text : Cr8Colors.muted,
          letterSpacing: 2.2,
          fontSize: 10 * fontScale,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Cr8Colors.bg.withValues(alpha: 0.9),
        foregroundColor: Cr8Colors.text,
        elevation: 0,
        titleTextStyle: GoogleFonts.playfairDisplay(
          color: Cr8Colors.text,
          fontSize: 22,
          fontStyle: FontStyle.italic,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        isDense: true,
        hintStyle: GoogleFonts.manrope(color: Cr8Colors.muted, fontSize: 14 * fontScale),
        labelStyle: GoogleFonts.manrope(
          color: Cr8Colors.muted,
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
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: Cr8Colors.hairline),
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
          foregroundColor: Cr8Colors.text,
          side: const BorderSide(color: Cr8Colors.hairline),
        ),
      ),
      dividerColor: Cr8Colors.hairline,
      cardColor: Cr8Colors.surface,
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: Cr8Colors.surface,
        contentTextStyle: TextStyle(color: Cr8Colors.text),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Cr8Colors.bg,
        indicatorColor: Cr8Colors.accent,
        elevation: 0,
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.manrope(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? Cr8Colors.text : Cr8Colors.muted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? Colors.white : Cr8Colors.muted, size: 22);
        }),
      ),
      cardTheme: CardThemeData(
        color: Cr8Colors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
    );
  }

  static ThemeData light({bool highContrast = false, double fontScale = 1}) {
    return dark(highContrast: highContrast, fontScale: fontScale).copyWith(
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF4F4F0),
      colorScheme: const ColorScheme.light(
        primary: Cr8Colors.accent,
        surface: Colors.white,
        onSurface: Color(0xFF0A0A0A),
      ),
    );
  }
}
