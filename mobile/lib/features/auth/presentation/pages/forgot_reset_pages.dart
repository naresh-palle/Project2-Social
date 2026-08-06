import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/widgets/studio_backdrop.dart';
import '../providers/auth_provider.dart';

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final email = TextEditingController();
  bool busy = false;
  String? msg;

  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      busy = true;
      msg = null;
    });
    try {
      await ref.read(authRepositoryProvider).forgotPassword(email.text.trim());
      setState(() => msg = 'If that email exists, a reset link was sent.');
    } catch (e) {
      setState(() => msg = e.toString());
    } finally {
      setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) cr8Back(context, fallback: '/login');
        },
        child: StudioBackdrop(
          dim: 0.4,
          child: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const Cr8BackButton(fallback: '/login'),
                Text('Forgot password', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontStyle: FontStyle.italic)),
                const SizedBox(height: 16),
                TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 16),
                Cr8Button(label: 'Send reset link', onPressed: busy ? null : _submit, loading: busy),
                if (msg != null) ...[const SizedBox(height: 12), Text(msg!)],
              ],
            ),
          ),
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
  final a = TextEditingController();
  final b = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    a.dispose();
    b.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (a.text != b.text) {
      showCr8Snack(context, 'Passwords do not match', error: true);
      return;
    }
    setState(() => busy = true);
    try {
      await ref.read(authRepositoryProvider).resetPassword(token: widget.token, newPassword: a.text);
      if (!mounted) return;
      showCr8Snack(context, 'Password updated');
      context.go('/login');
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reset password'),
        leading: Cr8BackButton(fallback: '/login', color: Theme.of(context).colorScheme.onSurface),
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(controller: a, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
          TextField(controller: b, obscureText: true, decoration: const InputDecoration(labelText: 'Confirm password')),
          const SizedBox(height: 16),
          Cr8Button(label: 'Update password', onPressed: busy ? null : _submit, loading: busy),
        ],
      ),
    );
  }
}
