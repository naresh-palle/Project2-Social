import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/widgets/app_widgets.dart';
import '../providers/auth_provider.dart';

class OnboardingPage extends ConsumerStatefulWidget {
  const OnboardingPage({super.key, required this.role});
  final String role;
  @override
  ConsumerState<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends ConsumerState<OnboardingPage> {
  final city = TextEditingController();
  final industry = TextEditingController();
  final website = TextEditingController();
  final bio = TextEditingController();
  String availability = 'available';
  final niches = <String>{};
  bool busy = false;

  static const nicheOptions = [
    'Fashion & Style', 'Beauty & Makeup', 'Food & Cooking', 'Technology & Gadgets',
    'Fitness & Health', 'Lifestyle & Home', 'Travel & Adventure', 'Business & Entrepreneurship',
  ];

  Future<void> _complete() async {
    setState(() => busy = true);
    try {
      final role = widget.role;
      final patch = <String, dynamic>{
        'onboarding_status': role == 'agent' ? 'pending_approval' : 'completed',
        if (city.text.isNotEmpty) 'city': city.text.trim(),
        if (city.text.isNotEmpty) 'location': city.text.trim(),
      };
      if (role == 'influencer' || role == 'creator') {
        patch['category'] = niches.join(', ');
        patch['niches'] = niches.toList();
        patch['availability'] = availability;
      } else if (role == 'owner') {
        patch['industry'] = industry.text.trim();
      } else if (role == 'agent') {
        patch['industry'] = industry.text.trim();
        patch['website'] = website.text.trim();
        patch['bio'] = bio.text.trim();
      }
      await ref.read(authProvider.notifier).updateProfile(patch);
      if (!mounted) return;
      // Force completed if API didn't echo status.
      await ref.read(authProvider.notifier).refresh();
      if (!mounted) return;
      context.go('/dashboard');
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCreator = widget.role == 'influencer' || widget.role == 'creator';
    return Scaffold(
      appBar: AppBar(title: const Text('Onboarding')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Complete your studio profile.', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontStyle: FontStyle.italic)),
          const SizedBox(height: 16),
          TextField(controller: city, decoration: const InputDecoration(labelText: 'City')),
          if (isCreator) ...[
            const SizedBox(height: 12),
            const Cr8SectionLabel('Niches'),
            Wrap(
              spacing: 8,
              children: nicheOptions.map((n) {
                final selected = niches.contains(n);
                return FilterChip(
                  label: Text(n),
                  selected: selected,
                  onSelected: (v) => setState(() => v ? niches.add(n) : niches.remove(n)),
                );
              }).toList(),
            ),
            DropdownButtonFormField<String>(
              value: availability,
              items: const [
                DropdownMenuItem(value: 'available', child: Text('Available')),
                DropdownMenuItem(value: 'limited', child: Text('Limited')),
                DropdownMenuItem(value: 'booked', child: Text('Booked')),
              ],
              onChanged: (v) => setState(() => availability = v ?? availability),
              decoration: const InputDecoration(labelText: 'Availability'),
            ),
          ],
          if (widget.role == 'owner' || widget.role == 'agent')
            TextField(controller: industry, decoration: const InputDecoration(labelText: 'Industry')),
          if (widget.role == 'agent') ...[
            TextField(controller: website, decoration: const InputDecoration(labelText: 'Website')),
            TextField(controller: bio, maxLines: 3, decoration: const InputDecoration(labelText: 'Bio')),
          ],
          const SizedBox(height: 24),
          Cr8Button(label: 'Finish', onPressed: _complete, loading: busy),
        ],
      ),
    );
  }
}
