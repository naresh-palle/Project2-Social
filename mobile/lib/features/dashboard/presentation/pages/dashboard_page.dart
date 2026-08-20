import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../widgets/creator_studio.dart';

String adminUsernameLabel(Map<String, dynamic> u) {
  final raw = '${u['username'] ?? u['handle'] ?? ''}'.trim();
  if (raw.isEmpty) return '—';
  return raw.startsWith('@') ? raw : '@$raw';
}

String adminMobileLabel(Map<String, dynamic> u) {
  final raw = '${u['mobile'] ?? ''}'.trim();
  if (raw.isEmpty) return '—';
  if (raw.startsWith('+')) return raw;
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.length >= 10) return '+91 ${digits.substring(digits.length - 10)}';
  return raw;
}

String adminStatusLabel(Map<String, dynamic> u) {
  final status = '${u['onboarding_status'] ?? ''}'.trim().toLowerCase();
  if (status == 'pending') return 'Pending';
  if (u['banned'] == true || u['is_banned'] == true) return 'Banned';
  return 'Active';
}

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});
  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  Map<String, dynamic> stats = {};
  Map<String, dynamic> wallet = {};
  List<Map<String, dynamic>> items = [];
  List<Map<String, dynamic>> notifications = [];
  List<Map<String, dynamic>> campaigns = [];
  bool loading = true;
  int range = 7;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = ref.read(authProvider).user;
    if (user == null) return;
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      if (user.isAdmin) {
        stats = await api.adminStats();
        items = await api.adminUsers();
      } else if (user.isOwner) {
        stats = await api.analyticsOwner();
        items = await api.campaigns(mine: true);
        wallet = await api.wallet();
      } else if (user.isAgent) {
        items = await api.influencers();
        stats = {'creators': items.length};
      } else {
        stats = await api.analyticsCreator();
        wallet = await api.wallet();
        final notif = await api.notifications(unreadOnly: true);
        notifications = ((notif['items'] as List?) ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .where((n) {
              final r = n['read'];
              return !(r == true || r == 'true' || r == 1);
            })
            .toList();
        campaigns = await api.matchCampaigns();
      }
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (loading) return const LoadingScaffold(message: 'Opening studio…');

    if (user?.isCreator == true) {
      return Scaffold(
        body: SafeArea(
          child: RefreshIndicator(
            color: Cr8Colors.accent,
            onRefresh: _load,
            child: CreatorStudioView(
              user: user!,
              stats: stats,
              wallet: wallet,
              notifications: notifications,
              campaigns: campaigns,
              range: range,
              onRangeChanged: (v) => setState(() => range = v),
              onOpenMenu: () => ref.read(scaffoldKeyProvider).currentState?.openDrawer(),
            ),
          ),
        ),
      );
    }

    final isAdmin = user?.isAdmin == true;
    return Scaffold(
      appBar: AppBar(
        title: Text(isAdmin ? 'Admin Console' : 'Dashboard'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
          IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => ref.read(scaffoldKeyProvider).currentState?.openDrawer(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Welcome, ${user?.displayName ?? ''}',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 12),
            if (stats.isNotEmpty) _StatsGrid(stats: stats),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (user?.isOwner == true || isAdmin)
                  FilledButton(onPressed: () => context.push('/campaigns/new'), child: const Text('New Campaign')),
                if (isAdmin)
                  OutlinedButton(onPressed: () => context.push('/admin'), child: const Text('Full Admin')),
                OutlinedButton(onPressed: () => context.push('/marketplace'), child: const Text('Marketplace')),
                OutlinedButton(onPressed: () => context.push('/feed'), child: const Text('Feed')),
              ],
            ),
            const SizedBox(height: 16),
            Cr8SectionLabel(
              isAdmin
                  ? 'User Management'
                  : user?.isOwner == true
                      ? 'Your campaigns'
                      : 'Overview',
            ),
            const SizedBox(height: 8),
            if (items.isEmpty)
              const EmptyState(message: 'Nothing here yet.')
            else if (isAdmin)
              ...items.take(40).map((u) => _AdminUserCard(user: u))
            else
              ...items.take(20).map((it) {
                final title = it['title'] ?? it['name'] ?? it['campaign_title'] ?? it['email'] ?? 'Item';
                final subtitle = it['brand'] ?? it['status'] ?? it['role'] ?? '';
                return Card(
                  color: Cr8Colors.surface,
                  child: ListTile(
                    title: Text('$title'),
                    subtitle: Text('$subtitle'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      if (it['id'] != null && (it['brand'] != null || it['budget'] != null)) {
                        context.push('/campaigns/${it['id']}');
                      } else if (it['id'] != null && (it['role'] == 'influencer' || it['handle'] != null)) {
                        context.push('/creators/${it['id']}');
                      }
                    },
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class _AdminUserCard extends StatelessWidget {
  const _AdminUserCard({required this.user});
  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final username = adminUsernameLabel(user);
    final email = '${user['email'] ?? '—'}';
    final mobile = adminMobileLabel(user);
    final role = '${user['role'] ?? '—'}';
    final category = '${user['category'] ?? ''}'.trim();
    final status = adminStatusLabel(user);
    final joinedRaw = user['created_at'];
    String joined = '—';
    if (joinedRaw != null) {
      try {
        joined = DateTime.parse('$joinedRaw').toLocal().toString().split(' ').first;
      } catch (_) {
        joined = '$joinedRaw';
      }
    }
    final pending = status == 'Pending';
    final banned = status == 'Banned';

    return Card(
      color: Cr8Colors.surface,
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    username,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: banned
                          ? Cr8Colors.accent.withValues(alpha: 0.4)
                          : pending
                              ? Colors.orange.withValues(alpha: 0.4)
                              : Cr8Colors.success.withValues(alpha: 0.4),
                    ),
                    color: banned
                        ? Cr8Colors.accent.withValues(alpha: 0.08)
                        : pending
                            ? Colors.orange.withValues(alpha: 0.08)
                            : Cr8Colors.success.withValues(alpha: 0.08),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: TextStyle(
                      fontSize: 9,
                      letterSpacing: 1.2,
                      color: banned
                          ? Cr8Colors.accent
                          : pending
                              ? Colors.orange
                              : Cr8Colors.success,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(email, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 2),
            Text(mobile, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 6),
            Text(
              '${role.toUpperCase()}${category.isNotEmpty ? ' · $category' : ''} · Joined $joined',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Cr8Colors.accent),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});
  final Map<String, dynamic> stats;

  @override
  Widget build(BuildContext context) {
    final entries = stats.entries.where((e) => e.value is num || e.value is String).take(6).toList();
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 1.6,
      children: entries.map((e) {
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: Cr8Colors.hairline),
            color: Cr8Colors.surface,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(e.key.replaceAll('_', ' ').toUpperCase(), style: Theme.of(context).textTheme.labelSmall),
              const Spacer(),
              Text('${e.value}', style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.w800)),
            ],
          ),
        );
      }).toList(),
    );
  }
}
