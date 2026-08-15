import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';

class MarketplacePage extends ConsumerStatefulWidget {
  const MarketplacePage({super.key});
  @override
  ConsumerState<MarketplacePage> createState() => _MarketplacePageState();
}

class _MarketplacePageState extends ConsumerState<MarketplacePage> with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final q = TextEditingController();
  List<Map<String, dynamic>> influencers = [];
  List<Map<String, dynamic>> campaigns = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      final query = q.text.trim();
      influencers = await api.influencers(q: query.isEmpty ? null : query);
      campaigns = await api.campaigns(q: query.isEmpty ? null : query);
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Marketplace'),
        bottom: TabBar(controller: _tabs, tabs: const [Tab(text: 'Influencers'), Tab(text: 'Campaigns')]),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: q,
              decoration: InputDecoration(
                hintText: 'Search…',
                suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _load),
              ),
              onSubmitted: (_) => _load(),
            ),
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
                : TabBarView(
                    controller: _tabs,
                    children: [
                      _list(influencers, isCreator: true),
                      _list(campaigns, isCreator: false),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _list(List<Map<String, dynamic>> data, {required bool isCreator}) {
    if (data.isEmpty) return const EmptyState(message: 'No results');
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: data.length,
        itemBuilder: (_, i) {
          final it = data[i];
          return ListTile(
            leading: CircleAvatar(backgroundImage: it['avatar'] != null ? NetworkImage('${it['avatar']}') : null, child: it['avatar'] == null ? const Icon(Icons.person) : null),
            title: Text('${it['name'] ?? it['title'] ?? 'Untitled'}'),
            subtitle: Text('${it['handle'] ?? it['brand'] ?? it['city'] ?? ''}'),
            onTap: () => context.push(isCreator ? '/creators/${it['id']}' : '/campaigns/${it['id']}'),
          );
        },
      ),
    );
  }
}
