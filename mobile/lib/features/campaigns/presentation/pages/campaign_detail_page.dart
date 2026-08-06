import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class CampaignDetailPage extends ConsumerStatefulWidget {
  const CampaignDetailPage({super.key, required this.id});
  final String id;
  @override
  ConsumerState<CampaignDetailPage> createState() => _CampaignDetailPageState();
}

class _CampaignDetailPageState extends ConsumerState<CampaignDetailPage> {
  Map<String, dynamic>? camp;
  List<Map<String, dynamic>> apps = [];
  List<Map<String, dynamic>> delivs = [];
  bool loading = true;
  final pitch = TextEditingController();
  final rate = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    pitch.dispose();
    rate.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      camp = await api.campaign(widget.id);
      final user = ref.read(authProvider).user;
      if (user?.isOwner == true || user?.isAdmin == true) {
        apps = await api.applications(widget.id);
      }
      delivs = await api.deliverables(widget.id);
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _apply() async {
    try {
      await ref.read(cr8ApiProvider).apply(widget.id, pitch: pitch.text.trim(), rate: int.tryParse(rate.text) ?? 0);
      if (mounted) showCr8Snack(context, 'Application sent');
      _load();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (loading || camp == null) return const LoadingScaffold();
    final c = camp!;
    final isOwner = user?.id == c['owner_id'] || user?.isAdmin == true;
    return Scaffold(
      appBar: AppBar(title: Text('${c['title']}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('${c['brand']}', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.accent)),
          Text('${c['title']}', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text('Budget: ₹${c['budget']} · ${c['status']}'),
          const SizedBox(height: 12),
          Text('${c['description']}'),
          const SizedBox(height: 8),
          Text('Deliverables: ${c['deliverables']}'),
          const SizedBox(height: 16),
          if (user?.isInfluencer == true && !isOwner) ...[
            const Cr8SectionLabel('Apply'),
            TextField(controller: pitch, maxLines: 3, decoration: const InputDecoration(labelText: 'Pitch')),
            TextField(controller: rate, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Your rate (INR)')),
            Cr8Button(label: 'Submit application', onPressed: _apply),
          ],
          if (isOwner) ...[
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: () async { await ref.read(cr8ApiProvider).fundEscrow(widget.id); _load(); }, child: const Text('Fund escrow'))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: () async { await ref.read(cr8ApiProvider).releaseEscrow(widget.id); _load(); }, child: const Text('Release'))),
            ]),
            const SizedBox(height: 12),
            const Cr8SectionLabel('Applications'),
            ...apps.map((a) => ListTile(
                  title: Text('${a['influencer_name'] ?? a['influencer_id']}'),
                  subtitle: Text('${a['pitch']}\n₹${a['rate']} · ${a['status']}'),
                  isThreeLine: true,
                  trailing: a['status'] == 'pending'
                      ? IconButton(icon: const Icon(Icons.check, color: Cr8Colors.success), onPressed: () async {
                          await ref.read(cr8ApiProvider).acceptApplication(a['id']);
                          _load();
                        })
                      : null,
                  onTap: () async {
                    final convo = await ref.read(cr8ApiProvider).openConversation(campaignId: widget.id, creatorId: a['influencer_id']);
                    if (context.mounted) context.push('/messages/${convo['id']}');
                  },
                )),
          ],
          const SizedBox(height: 12),
          const Cr8SectionLabel('Deliverables'),
          if (delivs.isEmpty) const Text('No deliverables yet', style: TextStyle(color: Cr8Colors.muted)),
          ...delivs.map((d) => ListTile(title: Text('${d['kind']}'), subtitle: Text('${d['url']}\n${d['status']}'), isThreeLine: true)),
        ],
      ),
    );
  }
}

class NewCampaignPage extends ConsumerStatefulWidget {
  const NewCampaignPage({super.key});
  @override
  ConsumerState<NewCampaignPage> createState() => _NewCampaignPageState();
}

class _NewCampaignPageState extends ConsumerState<NewCampaignPage> {
  final title = TextEditingController();
  final brand = TextEditingController();
  final description = TextEditingController();
  final budget = TextEditingController();
  final deliverables = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    title.dispose(); brand.dispose(); description.dispose(); budget.dispose(); deliverables.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    setState(() => busy = true);
    try {
      final camp = await ref.read(cr8ApiProvider).createCampaign({
        'title': title.text.trim(),
        'brand': brand.text.trim(),
        'description': description.text.trim(),
        'budget': int.tryParse(budget.text) ?? 0,
        'deliverables': deliverables.text.trim(),
        'niches': <String>[],
        'platforms': <String>['instagram'],
      });
      if (!mounted) return;
      context.go('/campaigns/${camp['id']}');
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Campaign')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
          TextField(controller: brand, decoration: const InputDecoration(labelText: 'Brand')),
          TextField(controller: description, maxLines: 4, decoration: const InputDecoration(labelText: 'Description')),
          TextField(controller: budget, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Budget (INR)')),
          TextField(controller: deliverables, decoration: const InputDecoration(labelText: 'Deliverables')),
          const SizedBox(height: 16),
          Cr8Button(label: 'Create', onPressed: _create, loading: busy),
        ],
      ),
    );
  }
}
