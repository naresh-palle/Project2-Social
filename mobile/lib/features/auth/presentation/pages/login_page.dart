import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../providers/auth_provider.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _id = TextEditingController();
  final _password = TextEditingController();
  final _totp = TextEditingController();
  final _mobile = TextEditingController();
  final _otp = TextEditingController();
  bool _remember = false;
  bool _obscure = true;
  bool _otpMode = false;
  bool _otpSent = false;
  bool _busy = false;

  @override
  void dispose() {
    _id.dispose();
    _password.dispose();
    _totp.dispose();
    _mobile.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _passwordLogin() async {
    setState(() => _busy = true);
    final ok = await ref.read(authProvider.notifier).login(
          identifier: _id.text.trim(),
          password: _password.text,
          rememberMe: _remember,
          totpCode: _totp.text.trim().isEmpty ? null : _totp.text.trim(),
        );
    if (!mounted) return;
    setState(() => _busy = false);
    final st = ref.read(authProvider);
    if (ok) {
      context.go('/dashboard');
    } else if (!st.requires2fa && st.error != null) {
      showCr8Snack(context, st.error!, error: true);
    }
  }

  Future<void> _google() async {
    try {
      setState(() => _busy = true);
      final google = GoogleSignIn(scopes: ['email', 'profile'], serverClientId: AppConstants.googleClientId);
      final account = await google.signIn();
      final auth = await account?.authentication;
      final idToken = auth?.idToken;
      if (idToken == null) {
        if (mounted) setState(() => _busy = false);
        return;
      }
      final ok = await ref.read(authProvider.notifier).google(idToken);
      if (!mounted) return;
      setState(() => _busy = false);
      if (ok) {
        context.go('/dashboard');
      } else {
        final err = ref.read(authProvider).error ?? '';
        if (err.toLowerCase().contains('no account') || err.contains('404')) {
          context.push('/register', extra: {'email': account?.email, 'fromGoogle': true});
        } else {
          showCr8Snack(context, err, error: true);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showCr8Snack(context, e.toString(), error: true);
      }
    }
  }

  Future<void> _apple() async {
    try {
      setState(() => _busy = true);
      final cred = await SignInWithApple.getAppleIDCredential(scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ]);
      final token = cred.identityToken;
      if (token == null) {
        if (mounted) {
          setState(() => _busy = false);
          showCr8Snack(context, 'Apple did not return a token', error: true);
        }
        return;
      }
      final ok = await ref.read(authProvider.notifier).apple(token, rememberMe: _remember);
      if (!mounted) return;
      setState(() => _busy = false);
      if (ok) {
        context.go('/dashboard');
      } else {
        final err = ref.read(authProvider).error ?? '';
        if (err.toLowerCase().contains('no account') || err.contains('404')) {
          context.push('/register', extra: {
            'email': cred.email,
            'firstName': cred.givenName,
            'lastName': cred.familyName,
            'fromApple': true,
          });
        } else {
          showCr8Snack(context, err, error: true);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showCr8Snack(context, 'Apple Sign In unavailable: $e', error: true);
      }
    }
  }

  Future<void> _sendOtp() async {
    final mobile = _mobile.text.replaceAll(RegExp(r'\D'), '');
    if (mobile.length != 10) {
      showCr8Snack(context, 'Enter a valid 10-digit Indian mobile', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).sendMobileOtp(mobile);
      if (!mounted) return;
      setState(() {
        _otpSent = true;
        _busy = false;
      });
      showCr8Snack(context, 'OTP sent to +91 $mobile');
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showCr8Snack(context, e.toString(), error: true);
      }
    }
  }

  Future<void> _verifyOtp() async {
    setState(() => _busy = true);
    final ok = await ref.read(authProvider.notifier).otpLogin(
          _mobile.text.replaceAll(RegExp(r'\D'), ''),
          _otp.text.trim(),
        );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      context.go('/dashboard');
    } else {
      showCr8Snack(context, ref.read(authProvider).error ?? 'OTP failed', error: true);
    }
  }

  Widget _socialButton({
    required VoidCallback? onTap,
    required Color background,
    required Color foreground,
    required Widget icon,
    required String label,
  }) {
    return Expanded(
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Cr8Colors.hairline),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                icon,
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: foreground, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('CR8')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('Return to the studio.', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontStyle: FontStyle.italic)),
            const SizedBox(height: 8),
            Text('§ STUDIO SIGN IN', style: Theme.of(context).textTheme.labelSmall),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Password'),
                    selected: !_otpMode,
                    onSelected: (_) => setState(() => _otpMode = false),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Mobile OTP'),
                    selected: _otpMode,
                    onSelected: (_) => setState(() => _otpMode = true),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (!_otpMode) ...[
              Row(
                children: [
                  _socialButton(
                    onTap: _busy ? null : _google,
                    background: const Color(0xFF111111),
                    foreground: Colors.white,
                    icon: const Icon(Icons.g_mobiledata, size: 28, color: Colors.white),
                    label: 'Google',
                  ),
                  const SizedBox(width: 12),
                  _socialButton(
                    onTap: _busy ? null : _apple,
                    background: Colors.white,
                    foreground: Colors.black,
                    icon: const Icon(Icons.apple, size: 22, color: Colors.black),
                    label: 'Apple',
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Divider(),
              TextField(controller: _id, decoration: const InputDecoration(labelText: 'Email or Username')),
              TextField(
                controller: _password,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: 'Password',
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
              ),
              Row(
                children: [
                  Checkbox(value: _remember, onChanged: (v) => setState(() => _remember = v ?? false)),
                  const Text('Remember Me'),
                  const Spacer(),
                  TextButton(onPressed: () => context.push('/forgot-password'), child: const Text('Forgot password?')),
                ],
              ),
              if (auth.requires2fa)
                TextField(
                  controller: _totp,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: const InputDecoration(labelText: '2FA Code'),
                ),
              const SizedBox(height: 12),
              Cr8Button(label: 'Sign In to Studio', onPressed: _busy ? null : _passwordLogin, loading: _busy),
            ] else ...[
              TextField(
                controller: _mobile,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                enabled: !_otpSent,
                decoration: const InputDecoration(labelText: 'Mobile (+91)', prefixText: '+91 '),
              ),
              if (_otpSent)
                TextField(
                  controller: _otp,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: const InputDecoration(labelText: '6-digit OTP'),
                ),
              const SizedBox(height: 12),
              Cr8Button(
                label: _otpSent ? 'Verify OTP' : 'Send OTP',
                onPressed: _busy ? null : (_otpSent ? _verifyOtp : _sendOtp),
                loading: _busy,
              ),
            ],
            const SizedBox(height: 24),
            TextButton(
              onPressed: () => context.push('/register'),
              child: const Text('New here? Join Studio →'),
            ),
          ],
        ),
      ),
    );
  }
}
