import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../campaigns/presentation/pages/campaign_map_page.dart';

class MarketplacePage extends ConsumerStatefulWidget {
  const MarketplacePage({super.key});
  @override
  ConsumerState<MarketplacePage> createState() => _MarketplacePageState();
}

class _MarketplacePageState extends ConsumerState<MarketplacePage> with SingleTickerProviderStateMixin {
  TabController? _tabs;
  final q = TextEditingController();
  List<Map<String, dynamic>> influencers = [];
  List<Map<String, dynamic>> campaigns = [];
  List<Map<String, dynamic>> brands = [];
  List<Map<String, dynamic>> production = [];
  bool loading = true;
  bool campaignMapView = false;

  bool get _isCreator => ref.read(authProvider).user?.isInfluencer == true;

  List<String> get _tabLabels {
    if (_isCreator) return const ['Campaigns', 'Brands', 'Hire'];
    return const ['Influencers', 'Campaigns', 'Brands', 'Hire'];
  }

  int get _campaignsTabIndex => _isCreator ? 0 : 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final labels = _tabLabels;
      _tabs = TabController(
        length: labels.length,
        vsync: this,
        initialIndex: _campaignsTabIndex.clamp(0, labels.length - 1),
      );
      _tabs!.addListener(() {
        if (mounted) setState(() {});
      });
      setState(() {});
      _load();
    });
  }

  @override
  void dispose() {
    _tabs?.dispose();
    q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      final query = q.text.trim();
      if (!_isCreator) {
        influencers = await api.influencers(q: query.isEmpty ? null : query);
      } else {
        influencers = [];
      }
      campaigns = await api.campaigns(q: query.isEmpty ? null : query);
      try {
        final b = await api.marketplaceBrands(q: query.isEmpty ? null : query);
        brands = (b['brands'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      } catch (_) {
        brands = [];
      }
      try {
        final p = await api.marketplaceProduction(q: query.isEmpty ? null : query);
        production = (p['members'] as List? ?? p['items'] as List? ?? [])
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
    final tabs = _tabs;
    if (tabs == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: Cr8Colors.accent)));
    }
    final onCampaigns = tabs.index == _campaignsTabIndex;
    final labels = _tabLabels;
    final children = <Widget>[
      if (!_isCreator) _creatorList(influencers),
      campaignMapView ? const CampaignMapPage(embedded: true) : _campaignList(campaigns),
      _brandList(brands),
      _productionList(production),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(_isCreator ? 'Campaigns' : 'Marketplace'),
        actions: [
          if (onCampaigns) ...[
            IconButton(
              tooltip: 'Grid view',
              onPressed: () => setState(() => campaignMapView = false),
              icon: Icon(Icons.grid_view_rounded, color: !campaignMapView ? Cr8Colors.accent : null),
            ),
            IconButton(
              tooltip: 'Map view',
              onPressed: () => setState(() => campaignMapView = true),
              icon: Icon(Icons.map_outlined, color: campaignMapView ? Cr8Colors.accent : null),
            ),
          ],
        ],
        bottom: TabBar(
          controller: tabs,
          isScrollable: labels.length > 3,
          tabs: labels.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: Column(
        children: [
          if (!(onCampaigns && campaignMapView))
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
            child: loading && !(onCampaigns && campaignMapView)
                ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
                : TabBarView(controller: tabs, children: children),
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
          onPressed: () => setState(() => campaignMapView = true),
          child: const Text('Open map'),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: GridView.builder(
        padding: const EdgeInsets.all(12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.85,
        ),
        itemCount: data.length,
        itemBuilder: (_, i) {
          final it = data[i];
          return InkWell(
            onTap: () => context.push('/campaigns/${it['id']}'),
            borderRadius: BorderRadius.circular(16),
            child: Ink(
              decoration: BoxDecoration(
                color: Cr8Colors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Cr8Colors.hairline),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${it['brand'] ?? 'Brand'}', style: const TextStyle(color: Cr8Colors.accent, fontSize: 10, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('${it['title'] ?? 'Campaign'}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                  const Spacer(),
                  Text('₹${it['budget'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  Text('${(it['niches'] as List? ?? []).take(2).join(' · ')}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Colors.white54)),
                ],
              ),
            ),
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
