import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});
  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  Map<String, dynamic>? settings;
  List<Map<String, dynamic>> sessions = [];
  List<Map<String, dynamic>> history = [];
  List<Map<String, dynamic>> blocks = [];
  List<Map<String, dynamic>> drafts = [];
  Map<String, dynamic>? social;
  bool loading = true;
  final totp = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    totp.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      settings = await api.settings();
      sessions = await api.sessions();
      history = await api.loginHistory();
      blocks = await api.blocks();
      drafts = await api.myPosts(status: 'draft');
      social = await api.analyticsSocial();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _patch(Map<String, dynamic> body) async {
    settings = await ref.read(cr8ApiProvider).patchSettings(body);
    final storage = ref.read(sessionStorageProvider);
    if (body['theme'] != null) await storage.saveTheme('${body['theme']}');
    if (body['high_contrast'] != null) await storage.saveHighContrast(body['high_contrast'] == true);
    if (body['font_scale'] != null) await storage.saveFontScale((body['font_scale'] as num).toDouble());
    setState(() {});
    if (mounted) showCr8Snack(context, 'Saved');
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const LoadingScaffold(message: 'Loading settings…');
    final prefs = Map<String, dynamic>.from(settings?['notification_prefs'] as Map? ?? {});
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const ListTile(title: Cr8SectionLabel('Appearance')),
          ListTile(
            title: const Text('Theme'),
            trailing: DropdownButton<String>(
              value: '${settings?['theme'] ?? 'dark'}',
              items: const [
                DropdownMenuItem(value: 'dark', child: Text('Dark')),
                DropdownMenuItem(value: 'light', child: Text('Light')),
                DropdownMenuItem(value: 'system', child: Text('System')),
              ],
              onChanged: (v) => _patch({'theme': v}),
            ),
          ),
          SwitchListTile(
            title: const Text('High contrast'),
            value: settings?['high_contrast'] == true,
            onChanged: (v) => _patch({'high_contrast': v}),
          ),
          ListTile(
            title: const Text('Font scale'),
            subtitle: Slider(
              value: ((settings?['font_scale'] as num?)?.toDouble() ?? 1).clamp(0.85, 1.5),
              min: 0.85,
              max: 1.5,
              onChanged: (v) => setState(() => settings = {...?settings, 'font_scale': v}),
              onChangeEnd: (v) => _patch({'font_scale': v}),
            ),
          ),
          const ListTile(title: Cr8SectionLabel('Privacy')),
          SwitchListTile(
            title: const Text('Private profile'),
            value: settings?['is_private'] == true,
            onChanged: (v) => _patch({'is_private': v}),
          ),
          SwitchListTile(
            title: const Text('Show online status'),
            value: settings?['show_online_status'] != false,
            onChanged: (v) => _patch({'show_online_status': v}),
          ),
          SwitchListTile(
            title: const Text('Show last seen'),
            value: settings?['show_last_seen'] != false,
            onChanged: (v) => _patch({'show_last_seen': v}),
          ),
          const ListTile(title: Cr8SectionLabel('Notifications')),
          ...['likes', 'comments', 'follows', 'mentions', 'messages', 'email', 'push'].map((k) {
            return SwitchListTile(
              title: Text(k),
              value: prefs[k] != false,
              onChanged: (v) => _patch({'notification_prefs': {k: v}}),
            );
          }),
          const ListTile(title: Cr8SectionLabel('Security')),
          ListTile(
            title: Text(settings?['two_fa_enabled'] == true ? '2FA Enabled' : 'Enable 2FA'),
            trailing: const Icon(Icons.security),
            onTap: () async {
              final api = ref.read(cr8ApiProvider);
              if (settings?['two_fa_enabled'] == true) {
                showCr8Snack(context, 'Disable 2FA from web settings or provide password+code via API');
                return;
              }
              final setup = await api.setup2fa();
              if (!mounted) return;
              await showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: Cr8Colors.surface,
                  title: const Text('Scan / enter secret'),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SelectableText('${setup['secret']}'),
                      TextField(controller: totp, decoration: const InputDecoration(labelText: 'Code')),
                    ],
                  ),
                  actions: [
                    TextButton(
                      onPressed: () async {
                        await api.enable2fa(totp.text.trim());
                        if (ctx.mounted) Navigator.pop(ctx);
                        _load();
                      },
                      child: const Text('Enable'),
                    ),
                  ],
                ),
              );
            },
          ),
          ...sessions.map((s) => ListTile(
                title: Text('${s['device_name']}'),
                subtitle: Text('${s['ip']} · ${s['last_active']}'),
                trailing: IconButton(
                  icon: const Icon(Icons.logout, color: Cr8Colors.accent),
                  onPressed: () async {
                    await ref.read(cr8ApiProvider).revokeSession(s['id']);
                    _load();
                  },
                ),
              )),
          const ListTile(title: Cr8SectionLabel('Login history')),
          ...history.take(8).map((h) => ListTile(
                dense: true,
                title: Text('${h['success'] == true ? '✓' : '✗'} ${h['ip']}'),
                subtitle: Text('${h['created_at']}'),
              )),
          const ListTile(title: Cr8SectionLabel('Blocked')),
          ...blocks.map((b) {
            final u = b['user'] as Map? ?? {};
            final id = u['id'] ?? b['block']?['blocked_id'];
            return ListTile(
              title: Text('${u['name'] ?? id}'),
              trailing: TextButton(onPressed: () async { await ref.read(cr8ApiProvider).unblock('$id'); _load(); }, child: const Text('Unblock')),
            );
          }),
          const ListTile(title: Cr8SectionLabel('Drafts')),
          ...drafts.map((d) => ListTile(
                title: Text('${d['title'] ?? d['text'] ?? 'Draft'}'),
                trailing: TextButton(
                  onPressed: () async {
                    // publish via patch endpoint through raw client would need extra method; recreate via createPost
                    await ref.read(cr8ApiProvider).createPost({
                      'text': d['text'],
                      'title': d['title'],
                      'status': 'published',
                    });
                    _load();
                  },
                  child: const Text('Publish'),
                ),
              )),
          if (social != null) ...[
            const ListTile(title: Cr8SectionLabel('Social analytics')),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final e in ['profile_views', 'post_views', 'likes', 'followers', 'engagement_rate'])
                    Chip(label: Text('$e: ${social![e] ?? 0}')),
                ],
              ),
            ),
          ],
          const ListTile(title: Cr8SectionLabel('Data')),
          ListTile(
            title: const Text('Download my data'),
            leading: const Icon(Icons.download),
            onTap: () async {
              final data = await ref.read(cr8ApiProvider).exportData();
              if (mounted) {
                await showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: Cr8Colors.surface,
                    title: const Text('Export'),
                    content: SingleChildScrollView(child: SelectableText(const JsonEncoder.withIndent('  ').convert(data))),
                    actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
                  ),
                );
              }
            },
          ),
          ListTile(
            title: const Text('Delete account', style: TextStyle(color: Cr8Colors.accent)),
            leading: const Icon(Icons.delete_forever, color: Cr8Colors.accent),
            onTap: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Delete account?'),
                  content: const Text('This cannot be undone.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                    TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
                  ],
                ),
              );
              if (ok == true) {
                await ref.read(cr8ApiProvider).deleteAccount();
                await ref.read(authProvider.notifier).logout();
                if (mounted) context.go('/');
              }
            },
          ),
          ListTile(title: const Text('Legal'), onTap: () => context.push('/legal/terms')),
        ],
      ),
    );
  }
}
