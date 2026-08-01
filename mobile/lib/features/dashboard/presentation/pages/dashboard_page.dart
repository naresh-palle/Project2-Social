import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});
  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  Map<String, dynamic>? stats;
  List<Map<String, dynamic>> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = ref.read(authProvider).user;
    if (user == null) return;
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      if (user.isAdmin) {
        stats = await api.adminStats();
        items = await api.adminUsers();
      } else if (user.isOwner) {
        stats = await api.analyticsOwner();
        items = await api.campaigns(mine: true);
      } else if (user.isAgent) {
        items = await api.creators();
        stats = {'creators': items.length};
      } else {
        stats = await api.analyticsCreator();
        items = await api.myApplications();
      }
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (loading) return const LoadingScaffold(message: 'Loading dashboard…');
    return Scaffold(
      appBar: AppBar(
        title: Text(user?.isAdmin == true ? 'Admin Console' : 'Dashboard'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
          IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => ref.read(scaffoldKeyProvider).currentState?.openDrawer(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Welcome, ${user?.displayName ?? ''}', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontStyle: FontStyle.italic)),
            const SizedBox(height: 12),
            if (stats != null) _StatsGrid(stats: stats!),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (user?.isOwner == true || user?.isAdmin == true)
                  FilledButton(onPressed: () => context.push('/campaigns/new'), child: const Text('New Campaign')),
                OutlinedButton(onPressed: () => context.push('/marketplace'), child: const Text('Marketplace')),
                OutlinedButton(onPressed: () => context.push('/feed'), child: const Text('Feed')),
              ],
            ),
            const SizedBox(height: 16),
            Cr8SectionLabel(user?.isOwner == true ? 'Your campaigns' : user?.isCreator == true ? 'Your applications' : 'Overview'),
            const SizedBox(height: 8),
            if (items.isEmpty)
              const EmptyState(message: 'Nothing here yet.')
            else
              ...items.take(20).map((it) {
                final title = it['title'] ?? it['name'] ?? it['campaign_title'] ?? it['email'] ?? 'Item';
                final subtitle = it['brand'] ?? it['status'] ?? it['role'] ?? '';
                return Card(
                  color: Cr8Colors.surface,
                  child: ListTile(
                    title: Text('$title'),
                    subtitle: Text('$subtitle'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      if (it['id'] != null && (it['brand'] != null || it['budget'] != null)) {
                        context.push('/campaigns/${it['id']}');
                      } else if (it['id'] != null && (it['role'] == 'influencer' || it['handle'] != null)) {
                        context.push('/creators/${it['id']}');
                      }
                    },
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});
  final Map<String, dynamic> stats;

  @override
  Widget build(BuildContext context) {
    final entries = stats.entries.where((e) => e.value is num || e.value is String).take(6).toList();
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 1.6,
      children: entries.map((e) {
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: Cr8Colors.hairline), color: Cr8Colors.surface),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(e.key.replaceAll('_', ' ').toUpperCase(), style: Theme.of(context).textTheme.labelSmall),
              const Spacer(),
              Text('${e.value}', style: Theme.of(context).textTheme.headlineSmall),
            ],
          ),
        );
      }).toList(),
    );
  }
}
