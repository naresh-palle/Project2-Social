import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme/app_theme.dart';

class Cr8Button extends StatelessWidget {
  const Cr8Button({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.outlined = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          )
        : Text(label.toUpperCase());

    if (outlined) {
      return SizedBox(
        width: double.infinity,
        child: OutlinedButton(onPressed: loading ? null : onPressed, child: child),
      );
    }
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(onPressed: loading ? null : onPressed, child: child),
    );
  }
}

class Cr8SectionLabel extends StatelessWidget {
  const Cr8SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.muted),
    );
  }
}

/// Label sits tightly above the underline field — matches web Register spacing.
class Cr8LabeledField extends StatelessWidget {
  const Cr8LabeledField({
    super.key,
    required this.label,
    required this.controller,
    this.obscureText = false,
    this.keyboardType,
    this.maxLength,
    this.prefixText,
    this.validator,
    this.enabled = true,
    this.textInputAction,
    this.onChanged,
    this.inputFormatters,
  });

  final String label;
  final TextEditingController controller;
  final bool obscureText;
  final TextInputType? keyboardType;
  final int? maxLength;
  final String? prefixText;
  final FormFieldValidator<String>? validator;
  final bool enabled;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final List<TextInputFormatter>? inputFormatters;

  @override
  Widget build(BuildContext context) {
    final labelStyle = GoogleFonts.manrope(
      color: Cr8Colors.muted,
      fontSize: 11,
      fontWeight: FontWeight.w600,
      letterSpacing: 1.4,
      height: 1.1,
    );
    final valueStyle = GoogleFonts.manrope(
      color: Cr8Colors.text,
      fontSize: 16,
      fontWeight: FontWeight.w500,
      height: 1.25,
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label.toUpperCase(), style: labelStyle),
          const SizedBox(height: 4),
          TextFormField(
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            maxLength: maxLength,
            enabled: enabled,
            textInputAction: textInputAction,
            onChanged: onChanged,
            inputFormatters: inputFormatters,
            style: valueStyle,
            cursorColor: Cr8Colors.accent,
            validator: validator,
            decoration: InputDecoration(
              isDense: true,
              counterText: '',
              prefixText: prefixText,
              prefixStyle: valueStyle.copyWith(color: Cr8Colors.muted),
              contentPadding: const EdgeInsets.only(top: 2, bottom: 8),
              border: const UnderlineInputBorder(borderSide: BorderSide(color: Cr8Colors.hairline)),
              enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Cr8Colors.hairline)),
              focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Cr8Colors.accent)),
              errorBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Cr8Colors.accent)),
              errorStyle: GoogleFonts.manrope(fontSize: 11, color: Cr8Colors.accent),
            ),
          ),
        ],
      ),
    );
  }
}

class LoadingScaffold extends StatelessWidget {
  const LoadingScaffold({super.key, this.message = 'Loading…'});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: Cr8Colors.accent),
            const SizedBox(height: 16),
            Text(message, style: const TextStyle(color: Cr8Colors.muted)),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.message, this.icon, this.action});
  final String message;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 40, color: Cr8Colors.muted),
              const SizedBox(height: 12),
            ],
            Text(message, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

void showCr8Snack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: error ? Cr8Colors.accent : Cr8Colors.surface,
    ),
  );
}
