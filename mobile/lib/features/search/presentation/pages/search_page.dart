import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key, this.initialQuery});
  final String? initialQuery;

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  late final TextEditingController q;
  String kind = 'all';
  Map<String, dynamic>? result;
  List<Map<String, dynamic>> recent = [];
  Map<String, dynamic>? trending;
  bool loading = false;
  Timer? _debounce;

  static const _kinds = [
    ('all', 'All'),
    ('users', 'Users'),
    ('posts', 'Posts'),
    ('hashtags', 'Hashtags'),
    ('campaigns', 'Campaigns'),
    ('location', 'Location'),
  ];

  @override
  void initState() {
    super.initState();
    _meta();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    q.dispose();
    super.dispose();
  }

  Future<void> _meta() async {
    try {
      recent = await ref.read(cr8ApiProvider).recentSearches();
      trending = await ref.read(cr8ApiProvider).trendingSearches();
      setState(() {});
    } catch (_) {}
  }

  void _onQueryChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      if (q.text.trim().isNotEmpty) _search();
    });
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

  void _selectKind(String k) {
    setState(() => kind = k);
    if (q.text.trim().isNotEmpty) _search();
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
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search users, posts, campaigns…',
              suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _search),
            ),
            onChanged: _onQueryChanged,
            onSubmitted: (_) => _search(),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: _kinds.map((entry) {
              final (k, label) = entry;
              return ChoiceChip(
                label: Text(label),
                selected: kind == k,
                onSelected: (_) => _selectKind(k),
              );
            }).toList(),
          ),
          if (loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator(color: Cr8Colors.accent)),
            ),
          if (result == null && !loading) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                const Expanded(child: Cr8SectionLabel('Recent')),
                TextButton(
                  onPressed: () async {
                    await ref.read(cr8ApiProvider).clearRecentSearches();
                    _meta();
                  },
                  child: const Text('Clear'),
                ),
              ],
            ),
            ...recent.take(8).map((r) => ListTile(
                  title: Text('${r['query']}'),
                  onTap: () {
                    q.text = '${r['query']}';
                    _search();
                  },
                )),
            const Cr8SectionLabel('Trending'),
            ...((trending?['hashtags'] as List?) ?? []).take(8).map((h) {
              final tag = h is Map ? h['tag'] : h;
              return ListTile(
                title: Text('#$tag'),
                onTap: () {
                  q.text = '$tag';
                  kind = 'hashtags';
                  _search();
                },
              );
            }),
          ],
          if (result != null) ...[
            if (kind == 'all' || kind == 'users') ...[
              const Cr8SectionLabel('Users'),
              ..._emptyOr(
                (result!['users'] as List?) ?? [],
                (u) {
                  final m = Map<String, dynamic>.from(u as Map);
                  return ListTile(
                    title: Text('${m['name']}'),
                    subtitle: Text('${m['handle']}'),
                    onTap: () => context.push('/u/${m['id']}'),
                  );
                },
              ),
            ],
            if (kind == 'all' || kind == 'campaigns') ...[
              const Cr8SectionLabel('Campaigns'),
              ..._emptyOr(
                (result!['campaigns'] as List?) ?? [],
                (c) {
                  final m = Map<String, dynamic>.from(c as Map);
                  return ListTile(
                    title: Text('${m['title']}'),
                    subtitle: Text('${m['brand']}'),
                    onTap: () => context.push('/campaigns/${m['id']}'),
                  );
                },
              ),
            ],
            if (kind == 'all' || kind == 'posts') ...[
              const Cr8SectionLabel('Posts'),
              ..._emptyOr(
                (result!['posts'] as List?) ?? [],
                (p) {
                  final m = Map<String, dynamic>.from(p as Map);
                  return ListTile(
                    title: Text('${m['title'] ?? m['text'] ?? 'Post'}'),
                    subtitle: Text('${m['likes_count'] ?? 0} likes'),
                  );
                },
              ),
            ],
            if (kind == 'all' || kind == 'hashtags') ...[
              const Cr8SectionLabel('Hashtags'),
              ..._emptyOr(
                (result!['hashtags'] as List?) ?? [],
                (h) {
                  final tag = h is Map ? (h['tag'] ?? h['name'] ?? h) : h;
                  final count = h is Map ? (h['count'] ?? h['posts_count']) : null;
                  return ListTile(
                    title: Text('#$tag'),
                    subtitle: count != null ? Text('$count posts') : null,
                    onTap: () {
                      q.text = '$tag';
                      kind = 'hashtags';
                      _search();
                    },
                  );
                },
              ),
            ],
            if (kind == 'all' || kind == 'location') ...[
              const Cr8SectionLabel('Locations'),
              ..._emptyOr(
                (result!['locations'] as List?) ?? [],
                (loc) {
                  final m = Map<String, dynamic>.from(loc as Map);
                  final place = m['city'] ?? m['state'] ?? m['location'] ?? 'Unknown';
                  return ListTile(
                    title: Text('${m['name'] ?? place}'),
                    subtitle: Text('$place · ${m['handle'] ?? ''}'),
                    onTap: () {
                      if (m['id'] != null) {
                        context.push('/u/${m['id']}');
                      } else {
                        q.text = '$place';
                        kind = 'location';
                        _search();
                      }
                    },
                  );
                },
              ),
            ],
          ],
        ],
      ),
    );
  }

  List<Widget> _emptyOr(List items, Widget Function(dynamic) builder) {
    if (items.isEmpty) {
      return [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text('No results', style: TextStyle(color: Colors.white54)),
        ),
      ];
    }
    return items.map(builder).toList();
  }
}
