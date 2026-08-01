import 'package:flutter/material.dart';

class LegalPage extends StatelessWidget {
  const LegalPage({super.key, required this.doc});
  final String doc;

  @override
  Widget build(BuildContext context) {
    final titles = {
      'terms': 'Terms of Service',
      'privacy': 'Privacy Policy',
      'cookies': 'Cookie Policy',
      'ftc': 'FTC Guidelines',
    };
    final bodies = {
      'terms': 'By using CR8 Studio you agree to marketplace collaboration rules, escrow workflows, and acceptable use. Content you upload remains yours; you grant CR8 a license to display it for campaigns.',
      'privacy': 'We process account, profile, messaging, and campaign data to operate the marketplace. You may export or delete your account from Settings. Contact hello@cr8.studio for privacy requests (GDPR/CCPA).',
      'cookies': 'The web app uses essential cookies/local storage for auth (cr8_token). Mobile uses secure storage instead of cookies.',
      'ftc': 'Creators and brands must disclose paid partnerships clearly (#ad / paid partnership) in published content.',
    };
    return Scaffold(
      appBar: AppBar(title: Text(titles[doc] ?? 'Legal')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(bodies[doc] ?? 'Document not found.', style: Theme.of(context).textTheme.bodyLarge),
      ),
    );
  }
}
