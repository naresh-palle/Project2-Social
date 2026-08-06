import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/storage/offline_cache.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({super.key});
  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  String mode = 'latest';
  List<Map<String, dynamic>> items = [];
  List<Map<String, dynamic>> suggested = [];
  String? cursor;
  bool loading = true;
  bool loadingMore = false;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        loading = true;
        cursor = null;
        items = [];
      });
      final cached = OfflineCache.getJson(OfflineCache.feedBox, mode);
      if (cached is Map && cached['items'] is List) {
        items = (cached['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        setState(() => loading = false);
      }
    } else {
      setState(() => loadingMore = true);
    }
    try {
      final data = await ref.read(cr8ApiProvider).feed(mode: mode, cursor: reset ? null : cursor);
      final next = (data['items'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      suggested = (data['suggested_people'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      setState(() {
        items = reset ? next : [...items, ...next];
        cursor = data['next_cursor']?.toString();
        loading = false;
        loadingMore = false;
      });
      await OfflineCache.putJson(OfflineCache.feedBox, mode, {'items': items});
    } catch (e) {
      setState(() {
        loading = false;
        loadingMore = false;
      });
      if (mounted && items.isEmpty) showCr8Snack(context, e.toString(), error: true);
    }
  }

  Future<void> _createPost() async {
    final text = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Cr8Colors.surface,
        title: const Text('New post'),
        content: TextField(controller: text, maxLines: 4, decoration: const InputDecoration(hintText: 'What\'s happening?')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Post')),
        ],
      ),
    );
    if (ok != true || text.text.trim().isEmpty) return;
    try {
      await ref.read(cr8ApiProvider).createPost({'text': text.text.trim(), 'status': 'published'});
      _load(reset: true);
    } catch (e) {
      // queue offline
      await OfflineCache.enqueue({'type': 'create_post', 'text': text.text.trim()});
      if (mounted) showCr8Snack(context, 'Saved to outbox / $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(authProvider).user?.id;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Feed'),
        actions: [
          PopupMenuButton<String>(
            initialValue: mode,
            onSelected: (v) {
              mode = v;
              _load(reset: true);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'latest', child: Text('Latest')),
              PopupMenuItem(value: 'trending', child: Text('Trending')),
              PopupMenuItem(value: 'personalized', child: Text('For you')),
              PopupMenuItem(value: 'following', child: Text('Following')),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Cr8Colors.accent,
        onPressed: _createPost,
        child: const Icon(Icons.add),
      ),
      body: loading && items.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: ListView.builder(
                itemCount: items.length + (suggested.isNotEmpty ? 1 : 0) + 1,
                itemBuilder: (_, i) {
                  if (suggested.isNotEmpty && i == 0) {
                    return SizedBox(
                      height: 96,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.all(12),
                        children: suggested.map((u) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 10),
                            child: ActionChip(
                              avatar: CircleAvatar(backgroundImage: u['avatar'] != null ? NetworkImage('${u['avatar']}') : null),
                              label: Text('${u['name'] ?? u['handle'] ?? 'User'}'),
                              onPressed: () => context.push('/u/${u['id']}'),
                            ),
                          );
                        }).toList(),
                      ),
                    );
                  }
                  final idx = suggested.isNotEmpty ? i - 1 : i;
                  if (idx >= items.length) {
                    if (cursor == null) return const SizedBox(height: 80);
                    return TextButton(
                      onPressed: loadingMore ? null : () => _load(),
                      child: Text(loadingMore ? 'Loading…' : 'Load more'),
                    );
                  }
                  final post = items[idx];
                  final author = Map<String, dynamic>.from(post['author'] as Map? ?? {});
                  return Card(
                    color: Cr8Colors.surface,
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(backgroundImage: author['avatar'] != null ? NetworkImage('${author['avatar']}') : null),
                            title: Text('${author['name'] ?? 'User'}'),
                            subtitle: Text('${author['handle'] ?? ''}'),
                            onTap: () {
                              if (author['id'] != null) context.push('/u/${author['id']}');
                            },
                          ),
                          if (post['title'] != null) Text('${post['title']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text('${post['text'] ?? ''}'),
                          if ((post['media'] as List?)?.isNotEmpty == true)
                            ...((post['media'] as List).take(1).map((m) {
                              final url = (m is Map ? m['url'] : null)?.toString();
                              if (url == null) return const SizedBox.shrink();
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Image.network(url, fit: BoxFit.cover),
                              );
                            })),
                          Row(
                            children: [
                              IconButton(
                                icon: Icon(post['liked'] == true ? Icons.favorite : Icons.favorite_border, color: Cr8Colors.accent),
                                onPressed: () async {
                                  await ref.read(cr8ApiProvider).likePost(post['id']);
                                  _load(reset: true);
                                },
                              ),
                              Text('${post['likes_count'] ?? 0}'),
                              IconButton(
                                icon: const Icon(Icons.chat_bubble_outline),
                                onPressed: () => _comments(post['id']),
                              ),
                              Text('${post['comments_count'] ?? 0}'),
                              IconButton(
                                icon: Icon(post['saved'] == true ? Icons.bookmark : Icons.bookmark_border),
                                onPressed: () => ref.read(cr8ApiProvider).savePost(post['id']),
                              ),
                              IconButton(
                                icon: const Icon(Icons.repeat),
                                onPressed: () => ref.read(cr8ApiProvider).repost(post['id']),
                              ),
                              if (author['id'] == me)
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Cr8Colors.accent),
                                  onPressed: () async {
                                    await ref.read(cr8ApiProvider).deletePost(post['id']);
                                    _load(reset: true);
                                  },
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }

  Future<void> _comments(String postId) async {
    final api = ref.read(cr8ApiProvider);
    final comments = await api.comments(postId);
    final controller = TextEditingController();
    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Cr8Colors.surface,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: SizedBox(
            height: 420,
            child: Column(
              children: [
                const ListTile(title: Text('Comments')),
                Expanded(
                  child: ListView(
                    children: comments.map((c) => ListTile(
                          title: Text('${c['text']}'),
                          subtitle: Text('${c['author']?['name'] ?? ''}'),
                        )).toList(),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    children: [
                      Expanded(child: TextField(controller: controller, decoration: const InputDecoration(hintText: 'Add a comment'))),
                      IconButton(
                        icon: const Icon(Icons.send, color: Cr8Colors.accent),
                        onPressed: () async {
                          await api.addComment(postId, controller.text.trim());
                          if (ctx.mounted) Navigator.pop(ctx);
                          _load(reset: true);
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
