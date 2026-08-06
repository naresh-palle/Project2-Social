import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';

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
      final data = await ref.read(cr8ApiProvider).notifications();
      items = (data['items'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      unread = (data['unread'] as num?)?.toInt() ?? 0;
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
        title: Text(unread > 0 ? 'Notifications ($unread)' : 'Notifications'),
        actions: [
          TextButton(onPressed: () async { await ref.read(cr8ApiProvider).readAllNotifications(); _load(); }, child: const Text('Mark all read')),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : items.isEmpty
              ? const EmptyState(message: 'No notifications')
              : ListView.builder(
                  itemCount: items.length,
                  itemBuilder: (_, i) {
                    final n = items[i];
                    final meta = Map<String, dynamic>.from(n['meta'] as Map? ?? {});
                    return ListTile(
                      leading: Icon(n['read'] == true ? Icons.notifications_none : Icons.notifications_active, color: Cr8Colors.accent),
                      title: Text('${n['text']}'),
                      subtitle: Text('${n['kind']} · ${n['created_at']}'.substring(0, 40)),
                      onTap: () {
                        if (meta['campaign_id'] != null) {
                          context.push('/campaigns/${meta['campaign_id']}');
                        } else if (n['kind'] == 'invitation') {
                          context.push('/invitations');
                        } else if (meta['conversation_id'] != null) {
                          context.push('/messages/${meta['conversation_id']}');
                        }
                      },
                    );
                  },
                ),
    );
  }
}
