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
  List<Map<String, dynamic>> brands = [];
  List<Map<String, dynamic>> production = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
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
      try {
        final b = await api.marketplaceBrands(q: query.isEmpty ? null : query);
        brands = (b['brands'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      } catch (_) {
        brands = [];
      }
      try {
        final p = await api.marketplaceProduction(q: query.isEmpty ? null : query);
        production = (p['items'] as List? ?? p['production'] as List? ?? p['members'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {
        production = [];
      }
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
        actions: [
          IconButton(
            tooltip: 'Campaign Map',
            onPressed: () => context.push('/campaigns/map'),
            icon: const Icon(Icons.map_outlined),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Influencers'),
            Tab(text: 'Campaigns'),
            Tab(text: 'Brands'),
            Tab(text: 'Hire'),
          ],
        ),
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
                      _creatorList(influencers),
                      _campaignList(campaigns),
                      _brandList(brands),
                      _productionList(production),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _creatorList(List<Map<String, dynamic>> data) {
    if (data.isEmpty) return const EmptyState(message: 'No influencers');
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: data.length,
        itemBuilder: (_, i) {
          final it = data[i];
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: it['avatar'] != null ? NetworkImage('${it['avatar']}') : null,
              child: it['avatar'] == null ? const Icon(Icons.person) : null,
            ),
            title: Text('${it['name'] ?? 'Creator'}'),
            subtitle: Text('${it['handle'] ?? it['city'] ?? ''}'),
            trailing: IconButton(
              icon: Icon((it['wishlisted'] == true) ? Icons.favorite : Icons.favorite_border, color: Cr8Colors.accent),
              onPressed: () async {
                try {
                  await ref.read(cr8ApiProvider).wishlistToggle(targetId: '${it['id']}', targetType: 'influencer');
                  _load();
                } catch (e) {
                  if (mounted) showCr8Snack(context, e.toString(), error: true);
                }
              },
            ),
            onTap: () => context.push('/creators/${it['id']}'),
          );
        },
      ),
    );
  }

  Widget _campaignList(List<Map<String, dynamic>> data) {
    if (data.isEmpty) {
      return EmptyState(
        message: 'No briefs on file',
        action: TextButton(
          onPressed: () => context.push('/campaigns/map'),
          child: const Text('Open map'),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: data.length,
        itemBuilder: (_, i) {
          final it = data[i];
          return ListTile(
            title: Text('${it['title'] ?? 'Campaign'}'),
            subtitle: Text('${it['brand'] ?? ''} · ₹${it['budget'] ?? '—'}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/campaigns/${it['id']}'),
          );
        },
      ),
    );
  }

  Widget _brandList(List<Map<String, dynamic>> data) {
    if (data.isEmpty) return const EmptyState(message: 'No brands found');
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: data.length,
        itemBuilder: (_, i) {
          final it = data[i];
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: it['avatar'] != null ? NetworkImage('${it['avatar']}') : null,
              child: it['avatar'] == null ? Text('${(it['company'] ?? it['name'] ?? 'B').toString()[0]}') : null,
            ),
            title: Text('${it['company'] ?? it['name'] ?? 'Brand'}'),
            subtitle: Text('${it['industry'] ?? ''} · ${it['active_campaigns'] ?? 0} active'),
            onTap: () => context.push('/brands/${it['id']}'),
          );
        },
      ),
    );
  }

  Widget _productionList(List<Map<String, dynamic>> data) {
    if (data.isEmpty) return const EmptyState(message: 'No production partners');
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: data.length,
        itemBuilder: (_, i) {
          final it = data[i];
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: it['avatar'] != null ? NetworkImage('${it['avatar']}') : null,
              child: it['avatar'] == null ? const Icon(Icons.movie_creation_outlined) : null,
            ),
            title: Text('${it['name'] ?? 'Production'}'),
            subtitle: Text('${it['production_category_label'] ?? it['production_category'] ?? ''} · ₹${it['base_rate'] ?? '—'}'),
            onTap: () => context.push('/production/${it['id']}'),
          );
        },
      ),
    );
  }
}
