import 'package:flutter/material.dart';

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
