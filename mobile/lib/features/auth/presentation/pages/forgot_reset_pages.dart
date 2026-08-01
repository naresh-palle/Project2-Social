import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/widgets/app_widgets.dart';
import '../providers/auth_provider.dart';

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final email = TextEditingController();
  bool busy = false;
  bool sent = false;

  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() => busy = true);
    try {
      await ref.read(authRepositoryProvider).forgotPassword(email.text.trim());
      setState(() {
        busy = false;
        sent = true;
      });
    } catch (e) {
      setState(() => busy = false);
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Forgot Password')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            if (sent)
              const Text('If that email exists, a reset link was sent.')
            else ...[
              TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: 16),
              Cr8Button(label: 'Send reset link', onPressed: _send, loading: busy),
            ],
          ],
        ),
      ),
    );
  }
}

class ResetPasswordPage extends ConsumerStatefulWidget {
  const ResetPasswordPage({super.key, required this.token});
  final String token;
  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final pass = TextEditingController();
  final confirm = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    pass.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> _reset() async {
    if (pass.text != confirm.text) {
      showCr8Snack(context, 'Passwords do not match', error: true);
      return;
    }
    setState(() => busy = true);
    try {
      await ref.read(authRepositoryProvider).resetPassword(token: widget.token, newPassword: pass.text);
      setState(() => busy = false);
      if (!mounted) return;
      showCr8Snack(context, 'Password updated');
      context.go('/login');
    } catch (e) {
      setState(() => busy = false);
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset Password')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            TextField(controller: pass, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
            TextField(controller: confirm, obscureText: true, decoration: const InputDecoration(labelText: 'Confirm password')),
            const SizedBox(height: 16),
            Cr8Button(label: 'Update password', onPressed: _reset, loading: busy),
          ],
        ),
      ),
    );
  }
}
