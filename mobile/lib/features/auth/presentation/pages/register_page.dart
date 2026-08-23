import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/widgets/studio_backdrop.dart';
import '../../../../core/widgets/brand_logo.dart';
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
                  const BrandLogo(height: 36),
                  const SizedBox(height: 12),
                  Text(
                    'Choose your door.',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontStyle: FontStyle.italic),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Pick a role to start onboarding.',
                    style: GoogleFonts.manrope(color: Colors.white70, fontSize: 14),
                  ),
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
    final roleLabel = widget.role == 'owner' ? 'Brand' : widget.role == 'agent' ? 'Agent' : 'Influencer';
    final metaStyle = GoogleFonts.manrope(
      fontSize: 11,
      fontWeight: FontWeight.w700,
      letterSpacing: 1.8,
      color: Cr8Colors.accent.withValues(alpha: 0.9),
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) cr8Back(context, fallback: '/register');
        },
        child: StudioBackdrop(
          dim: 0.28,
          child: SafeArea(
            child: Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                children: [
                  Row(
                    children: [
                      const Cr8BackButton(fallback: '/register'),
                      const Spacer(),
                      TextButton(
                        onPressed: () => context.go('/register'),
                        child: Text('← CHANGE DOOR', style: metaStyle.copyWith(color: Cr8Colors.muted)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: Cr8Colors.surface.withValues(alpha: 0.92),
                      border: Border.all(color: Cr8Colors.hairline),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const StudioAccentBar(),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('§ APPLY FOR ACCESS', style: metaStyle),
                              const SizedBox(height: 10),
                              Text.rich(
                                TextSpan(
                                  style: GoogleFonts.playfairDisplay(
                                    fontSize: 34,
                                    height: 1.15,
                                    color: Cr8Colors.text,
                                  ),
                                  children: [
                                    const TextSpan(text: 'Register as '),
                                    TextSpan(
                                      text: '$roleLabel.',
                                      style: const TextStyle(
                                        fontStyle: FontStyle.italic,
                                        color: Cr8Colors.accent,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 22),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Cr8LabeledField(
                                      label: 'First name',
                                      controller: firstName,
                                      validator: _req,
                                      textInputAction: TextInputAction.next,
                                      autofocus: true,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Cr8LabeledField(
                                      label: 'Last name',
                                      controller: lastName,
                                      validator: _req,
                                      textInputAction: TextInputAction.next,
                                    ),
                                  ),
                                ],
                              ),
                              if (widget.role != 'influencer')
                                Cr8LabeledField(
                                  label: widget.role == 'owner' ? 'Company' : 'Agency',
                                  controller: company,
                                  validator: _req,
                                  textInputAction: TextInputAction.next,
                                ),
                              if (widget.role == 'agent') ...[
                                Text(
                                  'AGENT TYPE',
                                  style: GoogleFonts.manrope(
                                    color: Cr8Colors.muted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 1.4,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                DropdownButtonFormField<String>(
                                  value: agentType,
                                  items: const [
                                    DropdownMenuItem(value: 'company_agent', child: Text('Company Agent')),
                                    DropdownMenuItem(value: 'influencer_agent', child: Text('Influencer Agent')),
                                  ],
                                  onChanged: (v) => setState(() => agentType = v ?? agentType),
                                  decoration: const InputDecoration(
                                    isDense: true,
                                    contentPadding: EdgeInsets.only(bottom: 8),
                                  ),
                                  style: GoogleFonts.manrope(color: Cr8Colors.text, fontSize: 16),
                                ),
                                const SizedBox(height: 14),
                              ],
                              Cr8LabeledField(
                                label: 'Email',
                                controller: email,
                                keyboardType: TextInputType.emailAddress,
                                validator: _req,
                                textInputAction: TextInputAction.next,
                              ),
                              Cr8LabeledField(
                                label: 'Username',
                                controller: username,
                                validator: _req,
                                textInputAction: TextInputAction.next,
                              ),
                              Cr8LabeledField(
                                label: 'Mobile',
                                controller: mobile,
                                keyboardType: TextInputType.phone,
                                maxLength: 10,
                                prefixText: '+91 ',
                                validator: _req,
                                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                textInputAction: TextInputAction.next,
                              ),
                              Cr8LabeledField(
                                label: 'Pincode (optional)',
                                controller: pincode,
                                keyboardType: TextInputType.number,
                                maxLength: 6,
                                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                textInputAction: TextInputAction.next,
                              ),
                              Cr8LabeledField(
                                label: 'Password',
                                controller: password,
                                obscureText: true,
                                validator: _req,
                                textInputAction: TextInputAction.done,
                              ),
                              const SizedBox(height: 8),
                              Cr8Button(
                                label: 'Continue with OTP',
                                onPressed: _submit,
                                loading: busy && !otpOpen,
                              ),
                              if (otpOpen) ...[
                                const SizedBox(height: 18),
                                Cr8LabeledField(
                                  label: 'SMS OTP',
                                  controller: otp,
                                  maxLength: 6,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  validator: _req,
                                ),
                                Cr8Button(
                                  label: 'Verify & Create Account',
                                  onPressed: _verify,
                                  loading: busy,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String? _req(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;
}
