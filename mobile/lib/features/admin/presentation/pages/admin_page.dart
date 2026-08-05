import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../dashboard/presentation/pages/dashboard_page.dart';

class AdminPage extends ConsumerStatefulWidget {
  const AdminPage({super.key});
  @override
  ConsumerState<AdminPage> createState() => _AdminPageState();
}

class _AdminPageState extends ConsumerState<AdminPage> with SingleTickerProviderStateMixin {
  late final TabController tabs;
  Map<String, dynamic>? stats;
  List<Map<String, dynamic>> users = [];
  List<Map<String, dynamic>> reports = [];
  final broadcast = TextEditingController();
  bool loading = true;

  @override
  void initState() {
    super.initState();
    // Default to Users tab — matches web User Management username list.
    tabs = TabController(length: 3, vsync: this, initialIndex: 1);
    _load();
  }

  @override
  void dispose() {
    tabs.dispose();
    broadcast.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      stats = await api.adminStats();
      users = await api.adminUsers();
      reports = await api.adminReports();
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
        title: const Text('Admin'),
        bottom: TabBar(controller: tabs, tabs: const [Tab(text: 'Overview'), Tab(text: 'Users'), Tab(text: 'Reports')]),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : TabBarView(
              controller: tabs,
              children: [
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text('Platform', style: Theme.of(context).textTheme.headlineSmall),
                    Text('${stats?['platform'] ?? stats}'),
                    const SizedBox(height: 16),
                    TextField(controller: broadcast, maxLines: 3, decoration: const InputDecoration(labelText: 'Broadcast message')),
                    Cr8Button(
                      label: 'Send broadcast',
                      onPressed: () async {
                        await ref.read(cr8ApiProvider).broadcast(text: broadcast.text.trim());
                        if (mounted) showCr8Snack(context, 'Sent');
                      },
                    ),
                  ],
                ),
                ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                  itemCount: users.length,
                  itemBuilder: (_, i) {
                    final u = users[i];
                    final username = adminUsernameLabel(u);
                    final email = '${u['email'] ?? '—'}';
                    final mobile = adminMobileLabel(u);
                    final role = '${u['role'] ?? '—'}';
                    final category = '${u['category'] ?? ''}'.trim();
                    final status = adminStatusLabel(u);
                    return Card(
                      color: Cr8Colors.surface,
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        contentPadding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
                        title: Text(username, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                          '$email\n$mobile\n${role.toUpperCase()}${category.isNotEmpty ? ' · $category' : ''} · $status',
                        ),
                        isThreeLine: true,
                        trailing: u['role'] == 'admin'
                            ? const Text('Protected', style: TextStyle(fontSize: 10, color: Colors.white38))
                            : Wrap(children: [
                                if (u['role'] == 'agent' && u['agent_approved'] != true)
                                  IconButton(icon: const Icon(Icons.verified, color: Cr8Colors.success), onPressed: () async {
                                    await ref.read(cr8ApiProvider).approveAgent(u['id']);
                                    _load();
                                  }),
                                IconButton(icon: const Icon(Icons.verified_user), onPressed: () async {
                                  await ref.read(cr8ApiProvider).verifyUser(u['id']);
                                  showCr8Snack(context, 'Verified');
                                }),
                                IconButton(icon: const Icon(Icons.block, color: Cr8Colors.accent), onPressed: () async {
                                  await ref.read(cr8ApiProvider).banUser(u['id'], reason: 'Policy');
                                  _load();
                                }),
                              ]),
                      ),
                    );
                  },
                ),
                ListView.builder(
                  itemCount: reports.length,
                  itemBuilder: (_, i) {
                    final r = reports[i];
                    return ListTile(
                      title: Text('${r['reason']}'),
                      subtitle: Text('${r['target_type']} ${r['target_id']} · ${r['status']}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.check),
                        onPressed: () async {
                          await ref.read(cr8ApiProvider).resolveReport(r['id'], 'resolved');
                          _load();
                        },
                      ),
                    );
                  },
                ),
              ],
            ),
    );
  }
}
