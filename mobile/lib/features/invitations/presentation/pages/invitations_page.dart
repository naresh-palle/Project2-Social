import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class InvitationsPage extends ConsumerStatefulWidget {
  const InvitationsPage({super.key});
  @override
  ConsumerState<InvitationsPage> createState() => _InvitationsPageState();
}

class _InvitationsPageState extends ConsumerState<InvitationsPage> {
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
      items = await ref.read(cr8ApiProvider).myInvitations();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isInfluencer = ref.watch(authProvider).user?.isInfluencer == true;
    return Scaffold(
      appBar: AppBar(title: const Text('Invitations')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : items.isEmpty
              ? const EmptyState(message: 'No invitations')
              : ListView.builder(
                  itemCount: items.length,
                  itemBuilder: (_, i) {
                    final it = items[i];
                    return Card(
                      color: Cr8Colors.surface,
                      child: ListTile(
                        title: Text('${it['campaign_title'] ?? 'Campaign'}'),
                        subtitle: Text('Offer ₹${it['offer']} · ${it['status']}\n${it['message'] ?? ''}'),
                        isThreeLine: true,
                        trailing: isInfluencer && it['status'] == 'pending'
                            ? Wrap(children: [
                                IconButton(icon: const Icon(Icons.check, color: Cr8Colors.success), onPressed: () async {
                                  await ref.read(cr8ApiProvider).invitationAction(it['id'], 'accept');
                                  _load();
                                }),
                                IconButton(icon: const Icon(Icons.close, color: Cr8Colors.accent), onPressed: () async {
                                  await ref.read(cr8ApiProvider).invitationAction(it['id'], 'reject');
                                  _load();
                                }),
                              ])
                            : null,
                      ),
                    );
                  },
                ),
    );
  }
}
