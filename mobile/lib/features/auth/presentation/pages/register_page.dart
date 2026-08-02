import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/widgets/studio_backdrop.dart';
import '../providers/auth_provider.dart';

class RegisterSplashPage extends StatelessWidget {
  const RegisterSplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) cr8Back(context, fallback: '/');
        },
        child: StudioBackdrop(
          dim: 0.32,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Cr8BackButton(fallback: '/'),
                  Text(
                    'CR8 × STUDIO',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.accent, letterSpacing: 3),
                  ),
                  const SizedBox(height: 12),
                  Text('Choose your door.', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontStyle: FontStyle.italic)),
                  const SizedBox(height: 8),
                  const Text('Pick a role to start onboarding.', style: TextStyle(color: Colors.white70)),
                  const Spacer(),
                  ElevatedButton(onPressed: () => context.push('/register/influencer'), child: const Text('CREATOR')),
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: () => context.push('/register/owner'), child: const Text('BRAND OWNER')),
                  const SizedBox(height: 12),
                  TextButton(onPressed: () => context.push('/register/agent'), child: const Text('Talent Agent')),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key, required this.role});
  final String role;

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _form = GlobalKey<FormState>();
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final email = TextEditingController();
  final username = TextEditingController();
  final password = TextEditingController();
  final mobile = TextEditingController();
  final company = TextEditingController();
  final pincode = TextEditingController();
  final otp = TextEditingController();
  String agentType = 'company_agent';
  bool busy = false;
  bool otpOpen = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final extra = GoRouterState.of(context).extra;
    if (extra is Map) {
      email.text = (extra['email'] ?? '').toString();
      firstName.text = (extra['firstName'] ?? '').toString();
      lastName.text = (extra['lastName'] ?? '').toString();
      if (email.text.contains('@')) {
        username.text = email.text.split('@').first.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '').toLowerCase();
      }
    }
  }

  @override
  void dispose() {
    for (final c in [firstName, lastName, email, username, password, mobile, company, pincode, otp]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    final m = mobile.text.replaceAll(RegExp(r'\D'), '');
    if (m.length != 10) {
      showCr8Snack(context, 'Valid 10-digit mobile required', error: true);
      return;
    }
    setState(() => busy = true);
    try {
      final api = ref.read(cr8ApiProvider);
      await api.sendRegisterOtp(email: email.text.trim(), mobile: m);
      setState(() {
        busy = false;
        otpOpen = true;
      });
    } catch (e) {
      setState(() => busy = false);
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    }
  }

  Future<void> _verify() async {
    setState(() => busy = true);
    final payload = {
      'email': email.text.trim(),
      'username': username.text.trim().toLowerCase(),
      'password': password.text,
      'name': '${firstName.text.trim()} ${lastName.text.trim()}'.trim(),
      'role': widget.role,
      'mobile': mobile.text.replaceAll(RegExp(r'\D'), ''),
      'otp': otp.text.trim(),
      'onboarding_status': 'pending',
      if (widget.role != 'influencer') 'company': company.text.trim(),
      if (widget.role == 'agent') 'agent_type': agentType,
      if (pincode.text.isNotEmpty) 'pincode': pincode.text.trim(),
    };
    final ok = await ref.read(authProvider.notifier).register(payload);
    setState(() => busy = false);
    if (!mounted) return;
    if (ok) {
      context.go('/onboarding/${widget.role}');
    } else {
      showCr8Snack(context, ref.read(authProvider).error ?? 'Register failed', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roleLabel = widget.role == 'owner' ? 'Brand' : widget.role == 'agent' ? 'Agent' : 'Creator';
    return Scaffold(
      appBar: AppBar(
        title: Text('Register as $roleLabel'),
        leading: const Cr8BackButton(fallback: '/register'),
      ),
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) cr8Back(context, fallback: '/register');
        },
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              TextFormField(controller: firstName, decoration: const InputDecoration(labelText: 'First name'), validator: _req),
              TextFormField(controller: lastName, decoration: const InputDecoration(labelText: 'Last name'), validator: _req),
              if (widget.role != 'influencer')
                TextFormField(controller: company, decoration: InputDecoration(labelText: widget.role == 'owner' ? 'Company' : 'Agency'), validator: _req),
              if (widget.role == 'agent')
                DropdownButtonFormField<String>(
                  value: agentType,
                  items: const [
                    DropdownMenuItem(value: 'company_agent', child: Text('Company Agent')),
                    DropdownMenuItem(value: 'influencer_agent', child: Text('Influencer Agent')),
                  ],
                  onChanged: (v) => setState(() => agentType = v ?? agentType),
                  decoration: const InputDecoration(labelText: 'Agent type'),
                ),
              TextFormField(controller: email, decoration: const InputDecoration(labelText: 'Email'), validator: _req),
              TextFormField(controller: username, decoration: const InputDecoration(labelText: 'Username'), validator: _req),
              TextFormField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password'), validator: _req),
              TextFormField(controller: mobile, keyboardType: TextInputType.phone, maxLength: 10, decoration: const InputDecoration(labelText: 'Mobile', prefixText: '+91 '), validator: _req),
              TextFormField(controller: pincode, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(labelText: 'Pincode (optional)')),
              const SizedBox(height: 16),
              Cr8Button(label: 'Continue with OTP', onPressed: _submit, loading: busy && !otpOpen),
              if (otpOpen) ...[
                const SizedBox(height: 16),
                TextField(controller: otp, maxLength: 6, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'SMS OTP')),
                Cr8Button(label: 'Verify & Create Account', onPressed: _verify, loading: busy),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String? _req(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;
}
