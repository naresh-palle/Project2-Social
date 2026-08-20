import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';

bool _isUnread(Map<String, dynamic> n) {
  final r = n['read'];
  return !(r == true || r == 'true' || r == 1);
}

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});
  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  List<Map<String, dynamic>> items = [];
  int unread = 0;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final data = await ref.read(cr8ApiProvider).notifications(unreadOnly: true);
      final list = (data['items'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .where(_isUnread)
          .toList();
      items = list;
      unread = (data['unread'] as num?)?.toInt() ?? list.length;
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _openNotification(Map<String, dynamic> n) async {
    final id = n['id']?.toString();
    final meta = Map<String, dynamic>.from(n['meta'] as Map? ?? {});

    if (id != null && id.isNotEmpty) {
      setState(() {
        items = items.where((x) => x['id'] != id).toList();
        unread = unread > 0 ? unread - 1 : 0;
      });
      try {
        final res = await ref.read(cr8ApiProvider).readNotification(id);
        final next = (res['unread'] as num?)?.toInt();
        if (next != null && mounted) setState(() => unread = next);
      } catch (_) {
        /* navigation still proceeds */
      }
    }

    if (!mounted) return;
    if (meta['link'] != null) {
      context.push('${meta['link']}');
    } else if (meta['campaign_id'] != null) {
      context.push('/campaigns/${meta['campaign_id']}');
    } else if (n['kind'] == 'invitation') {
      context.push('/invitations');
    } else if (meta['conversation_id'] != null) {
      context.push('/messages/${meta['conversation_id']}');
    } else if (meta['ticket_id'] != null || n['kind'] == 'support') {
      context.push('/support');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(unread > 0 ? 'Notifications ($unread)' : 'Notifications'),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: () async {
                await ref.read(cr8ApiProvider).readAllNotifications();
                if (mounted) setState(() { items = []; unread = 0; });
              },
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : items.isEmpty
              ? const EmptyState(message: 'No unread notifications')
              : ListView.builder(
                  itemCount: items.length,
                  itemBuilder: (_, i) {
                    final n = items[i];
                    return ListTile(
                      leading: const Icon(Icons.notifications_active, color: Cr8Colors.accent),
                      title: Text('${n['text']}'),
                      subtitle: Text(
                        '${n['kind']} · ${n['created_at']}'.length > 40
                            ? '${n['kind']} · ${n['created_at']}'.substring(0, 40)
                            : '${n['kind']} · ${n['created_at']}',
                      ),
                      onTap: () => _openNotification(n),
                    );
                  },
                ),
    );
  }
}
