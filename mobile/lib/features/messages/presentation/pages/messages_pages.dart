import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/cr8_api.dart';
import '../../../../core/storage/offline_cache.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class ConversationsPage extends ConsumerStatefulWidget {
  const ConversationsPage({super.key});
  @override
  ConsumerState<ConversationsPage> createState() => _ConversationsPageState();
}

class _ConversationsPageState extends ConsumerState<ConversationsPage> {
  List<Map<String, dynamic>> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      items = await ref.read(cr8ApiProvider).conversations();
      await OfflineCache.putJson(OfflineCache.convoBox, 'list', items);
    } catch (e) {
      final cached = OfflineCache.getJson(OfflineCache.convoBox, 'list');
      if (cached is List) {
        items = cached.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      if (mounted && items.isEmpty) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : items.isEmpty
              ? const EmptyState(message: 'No conversations yet', icon: Icons.chat_bubble_outline)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: items.length,
                    itemBuilder: (_, i) {
                      final c = items[i];
                      return ListTile(
                        title: Text('${c['other_name'] ?? c['campaign_brand'] ?? 'Chat'}'),
                        subtitle: Text('${c['last_message'] ?? c['campaign_title'] ?? ''}'),
                        onTap: () => context.push('/messages/${c['id']}'),
                      );
                    },
                  ),
                ),
    );
  }
}

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({super.key, required this.conversationId});
  final String conversationId;
  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  final text = TextEditingController();
  List<Map<String, dynamic>> msgs = [];
  Timer? poll;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    poll = Timer.periodic(AppConstants.messagePollInterval, (_) => _load(silent: true));
  }

  @override
  void dispose() {
    poll?.cancel();
    text.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final api = ref.read(cr8ApiProvider);
      final list = await api.messages(widget.conversationId);
      await api.markRead(widget.conversationId);
      if (mounted) {
        setState(() {
          msgs = list;
          loading = false;
        });
      }
      await OfflineCache.putJson(OfflineCache.convoBox, widget.conversationId, list);
    } catch (_) {
      if (!silent && mounted) setState(() => loading = false);
    }
  }

  Future<void> _send({String? mediaUrl, String? mediaType}) async {
    final content = text.text.trim();
    if (content.isEmpty && mediaUrl == null) return;
    text.clear();
    try {
      await ref.read(cr8ApiProvider).sendMessage(
            widget.conversationId,
            content: content,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
          );
      _load(silent: true);
    } catch (e) {
      await OfflineCache.enqueue({
        'type': 'message',
        'conversation_id': widget.conversationId,
        'content': content,
        'media_url': mediaUrl,
      });
      if (mounted) showCr8Snack(context, 'Queued offline: $e');
    }
  }

  Future<void> _attach() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (file == null) return;
    final up = await ref.read(cr8ApiProvider).uploadMedia(file.path, file.name);
    var url = up['url']?.toString() ?? '';
    if (url.startsWith('/')) {
      url = AppConstants.apiBase.replaceAll(RegExp(r'/api$'), '') + url;
    }
    await _send(mediaUrl: url, mediaType: 'image');
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(authProvider).user?.id;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
        actions: [
          IconButton(icon: const Icon(Icons.push_pin_outlined), onPressed: () => ref.read(cr8ApiProvider).pinConvo(widget.conversationId)),
          IconButton(icon: const Icon(Icons.archive_outlined), onPressed: () => ref.read(cr8ApiProvider).archiveConvo(widget.conversationId)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: msgs.length,
                    itemBuilder: (_, i) {
                      final m = msgs[i];
                      if (m['deleted'] == true) {
                        return const Align(child: Text('Message deleted', style: TextStyle(fontStyle: FontStyle.italic, color: Cr8Colors.muted)));
                      }
                      final mine = m['sender_id'] == me;
                      return Align(
                        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: mine ? Cr8Colors.accent.withValues(alpha: 0.25) : Cr8Colors.surface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Cr8Colors.hairline),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (m['media_url'] != null) Image.network('${m['media_url']}', width: 180),
                              Text('${m['content'] ?? ''}'),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            child: Row(
              children: [
                IconButton(icon: const Icon(Icons.attach_file), onPressed: _attach),
                Expanded(
                  child: TextField(
                    controller: text,
                    decoration: const InputDecoration(hintText: 'Message…', contentPadding: EdgeInsets.symmetric(horizontal: 12)),
                    onChanged: (_) => ref.read(cr8ApiProvider).typing(widget.conversationId, true),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                IconButton(icon: const Icon(Icons.send, color: Cr8Colors.accent), onPressed: _send),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
