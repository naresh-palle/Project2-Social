import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});
  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final q = TextEditingController();
  String kind = 'all';
  Map<String, dynamic>? result;
  List<Map<String, dynamic>> recent = [];
  Map<String, dynamic>? trending;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    _meta();
  }

  Future<void> _meta() async {
    try {
      recent = await ref.read(cr8ApiProvider).recentSearches();
      trending = await ref.read(cr8ApiProvider).trendingSearches();
      setState(() {});
    } catch (_) {}
  }

  Future<void> _search() async {
    if (q.text.trim().isEmpty) return;
    setState(() => loading = true);
    try {
      result = await ref.read(cr8ApiProvider).search(q.text.trim(), kind: kind);
      _meta();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: q,
            decoration: InputDecoration(
              hintText: 'Search users, posts, campaigns…',
              suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _search),
            ),
            onSubmitted: (_) => _search(),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: ['all', 'users', 'posts', 'hashtags', 'campaigns', 'location'].map((k) {
              return ChoiceChip(label: Text(k), selected: kind == k, onSelected: (_) => setState(() => kind = k));
            }).toList(),
          ),
          if (loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: Cr8Colors.accent))),
          if (result == null && !loading) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                const Expanded(child: Cr8SectionLabel('Recent')),
                TextButton(onPressed: () async { await ref.read(cr8ApiProvider).clearRecentSearches(); _meta(); }, child: const Text('Clear')),
              ],
            ),
            ...recent.take(8).map((r) => ListTile(
                  title: Text('${r['query']}'),
                  onTap: () { q.text = '${r['query']}'; _search(); },
                )),
            const Cr8SectionLabel('Trending'),
            ...((trending?['hashtags'] as List?) ?? []).take(8).map((h) {
              final tag = h is Map ? h['tag'] : h;
              return ListTile(title: Text('#$tag'), onTap: () { q.text = '$tag'; kind = 'hashtags'; _search(); });
            }),
          ],
          if (result != null) ...[
            const Cr8SectionLabel('Users'),
            ...((result!['users'] as List?) ?? []).map((u) {
              final m = Map<String, dynamic>.from(u as Map);
              return ListTile(title: Text('${m['name']}'), subtitle: Text('${m['handle']}'), onTap: () => context.push('/u/${m['id']}'));
            }),
            const Cr8SectionLabel('Campaigns'),
            ...((result!['campaigns'] as List?) ?? []).map((c) {
              final m = Map<String, dynamic>.from(c as Map);
              return ListTile(title: Text('${m['title']}'), subtitle: Text('${m['brand']}'), onTap: () => context.push('/campaigns/${m['id']}'));
            }),
            const Cr8SectionLabel('Posts'),
            ...((result!['posts'] as List?) ?? []).map((p) {
              final m = Map<String, dynamic>.from(p as Map);
              return ListTile(title: Text('${m['title'] ?? m['text'] ?? 'Post'}'), subtitle: Text('${m['likes_count'] ?? 0} likes'));
            }),
          ],
        ],
      ),
    );
  }
}
