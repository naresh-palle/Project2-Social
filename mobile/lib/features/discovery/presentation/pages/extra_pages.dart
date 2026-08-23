import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';

class SocialAuditPage extends ConsumerStatefulWidget {
  const SocialAuditPage({super.key});
  @override
  ConsumerState<SocialAuditPage> createState() => _SocialAuditPageState();
}

class _SocialAuditPageState extends ConsumerState<SocialAuditPage> {
  Map<String, dynamic>? me;
  List<Map<String, dynamic>> history = [];
  bool loading = true;
  bool running = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      me = await api.socialAuditMe();
      history = await api.socialAuditHistory();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _run() async {
    setState(() => running = true);
    try {
      await ref.read(cr8ApiProvider).runSocialAudit();
      await _load();
      if (mounted) showCr8Snack(context, 'Audit started');
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final issues = (me?['issues'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Social Audit')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text('Latest audit', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text('Status: ${me?['status'] ?? me?['latest']?['status'] ?? '—'}'),
                  Text('Score: ${me?['score'] ?? me?['latest']?['score'] ?? '—'}'),
                  const SizedBox(height: 12),
                  Cr8Button(label: running ? 'Running…' : 'Run audit', loading: running, onPressed: running ? null : _run),
                  const SizedBox(height: 20),
                  const Cr8SectionLabel('Issues'),
                  if (issues.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('No open issues')),
                  ...issues.map((i) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${i['title'] ?? i['category'] ?? 'Issue'}'),
                        subtitle: Text('${i['severity'] ?? ''} · ${i['platform'] ?? ''}'),
                      )),
                  const SizedBox(height: 16),
                  const Cr8SectionLabel('History'),
                  ...history.map((h) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${h['status'] ?? 'audit'} · ${h['created_at'] ?? ''}'),
                        subtitle: Text('Score ${h['score'] ?? '—'}'),
                        onTap: h['id'] == null ? null : () async {
                          try {
                            final detail = await ref.read(cr8ApiProvider).socialAudit('${h['id']}');
                            if (!context.mounted) return;
                            showModalBottomSheet(
                              context: context,
                              backgroundColor: Cr8Colors.surface,
                              builder: (_) => Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text(detail.toString()),
                              ),
                            );
                          } catch (e) {
                            if (context.mounted) showCr8Snack(context, e.toString(), error: true);
                          }
                        },
                      )),
                ],
              ),
            ),
    );
  }
}

class ReferralsPage extends ConsumerStatefulWidget {
  const ReferralsPage({super.key});
  @override
  ConsumerState<ReferralsPage> createState() => _ReferralsPageState();
}

class _ReferralsPageState extends ConsumerState<ReferralsPage> {
  Map<String, dynamic>? code;
  Map<String, dynamic>? status;
  final applyCtrl = TextEditingController();
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    applyCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      code = await api.referralCode();
      status = await api.referralStatus();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final myCode = '${code?['code'] ?? code?['referral_code'] ?? ''}';
    return Scaffold(
      appBar: AppBar(title: const Text('Referrals')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Your code', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                SelectableText(myCode.isEmpty ? '—' : myCode, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: Cr8Colors.accent)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Cr8Button(
                        label: 'Copy',
                        outlined: true,
                        onPressed: myCode.isEmpty
                            ? null
                            : () {
                                Clipboard.setData(ClipboardData(text: myCode));
                                showCr8Snack(context, 'Copied');
                              },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Cr8Button(
                        label: 'Share',
                        onPressed: myCode.isEmpty ? null : () => Share.share('Join flugr with my code $myCode'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text('Status: ${status?['status'] ?? status?['message'] ?? '—'}'),
                Text('Referrals: ${status?['count'] ?? status?['referrals'] ?? status?['total'] ?? '—'}'),
                const SizedBox(height: 24),
                const Cr8SectionLabel('Apply a code'),
                TextField(controller: applyCtrl, decoration: const InputDecoration(hintText: 'Referral code')),
                const SizedBox(height: 8),
                Cr8Button(
                  label: 'Apply',
                  onPressed: () async {
                    try {
                      await ref.read(cr8ApiProvider).applyReferral(applyCtrl.text.trim());
                      applyCtrl.clear();
                      await _load();
                      if (mounted) showCr8Snack(context, 'Referral applied');
                    } catch (e) {
                      if (mounted) showCr8Snack(context, e.toString(), error: true);
                    }
                  },
                ),
              ],
            ),
    );
  }
}

class WishlistPage extends ConsumerStatefulWidget {
  const WishlistPage({super.key});
  @override
  ConsumerState<WishlistPage> createState() => _WishlistPageState();
}

class _WishlistPageState extends ConsumerState<WishlistPage> {
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
      items = await ref.read(cr8ApiProvider).wishlist();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : items.isEmpty
              ? const EmptyState(message: 'Nothing saved yet')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: items.length,
                    itemBuilder: (_, i) {
                      final it = items[i];
                      final type = '${it['target_type'] ?? it['type'] ?? ''}';
                      final id = '${it['id'] ?? it['target_id'] ?? ''}';
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundImage: it['avatar'] != null ? NetworkImage('${it['avatar']}') : null,
                          child: it['avatar'] == null ? const Icon(Icons.favorite_border) : null,
                        ),
                        title: Text('${it['name'] ?? it['company'] ?? it['title'] ?? 'Saved'}'),
                        subtitle: Text(type),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () async {
                            try {
                              await ref.read(cr8ApiProvider).wishlistToggle(
                                    targetId: id,
                                    targetType: type.isEmpty ? 'influencer' : type,
                                    action: 'remove',
                                  );
                              _load();
                            } catch (e) {
                              if (mounted) showCr8Snack(context, e.toString(), error: true);
                            }
                          },
                        ),
                        onTap: () {
                          if (type.contains('brand')) {
                            context.push('/brands/$id');
                          } else if (type.contains('production')) {
                            context.push('/production/$id');
                          } else {
                            context.push('/creators/$id');
                          }
                        },
                      );
                    },
                  ),
                ),
    );
  }
}

class LeaderboardPage extends ConsumerStatefulWidget {
  const LeaderboardPage({super.key});
  @override
  ConsumerState<LeaderboardPage> createState() => _LeaderboardPageState();
}

class _LeaderboardPageState extends ConsumerState<LeaderboardPage> {
  String period = 'weekly';
  List<Map<String, dynamic>> rows = [];
  Map<String, dynamic>? myRank;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      final data = await api.leaderboard(period: period);
      rows = (data['items'] as List? ?? data['leaderboard'] as List? ?? data['ranks'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      if (rows.isEmpty && data['users'] is List) {
        rows = (data['users'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      myRank = await api.myLeaderboardRank(period: period);
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
        title: const Text('Leaderboard'),
        actions: [
          PopupMenuButton<String>(
            initialValue: period,
            onSelected: (v) {
              period = v;
              _load();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'weekly', child: Text('Weekly')),
              PopupMenuItem(value: 'monthly', child: Text('Monthly')),
            ],
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : Column(
              children: [
                if (myRank != null)
                  ListTile(
                    title: Text('Your rank: ${myRank!['rank'] ?? myRank!['position'] ?? '—'}'),
                    subtitle: Text('Score ${myRank!['score'] ?? '—'} · $period'),
                  ),
                Expanded(
                  child: rows.isEmpty
                      ? const EmptyState(message: 'No rankings yet')
                      : ListView.builder(
                          itemCount: rows.length,
                          itemBuilder: (_, i) {
                            final r = rows[i];
                            return ListTile(
                              leading: CircleAvatar(child: Text('${r['rank'] ?? i + 1}')),
                              title: Text('${r['name'] ?? r['handle'] ?? 'Creator'}'),
                              trailing: Text('${r['score'] ?? r['points'] ?? ''}'),
                              onTap: r['id'] != null ? () => context.push('/creators/${r['id']}') : null,
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}

class BrandDetailPage extends ConsumerStatefulWidget {
  const BrandDetailPage({super.key, required this.id});
  final String id;
  @override
  ConsumerState<BrandDetailPage> createState() => _BrandDetailPageState();
}

class _BrandDetailPageState extends ConsumerState<BrandDetailPage> {
  Map<String, dynamic>? brand;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      brand = await ref.read(cr8ApiProvider).marketplaceBrand(widget.id);
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
        title: Text('${brand?['company'] ?? brand?['name'] ?? 'Brand'}'),
        actions: [
          IconButton(
            icon: Icon((brand?['wishlisted'] == true) ? Icons.favorite : Icons.favorite_border),
            onPressed: () async {
              try {
                await ref.read(cr8ApiProvider).wishlistToggle(targetId: widget.id, targetType: 'brand');
                _load();
              } catch (e) {
                if (mounted) showCr8Snack(context, e.toString(), error: true);
              }
            },
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('${brand?['industry'] ?? brand?['category'] ?? ''}'),
                Text('${brand?['city'] ?? ''} ${brand?['state'] ?? ''}'),
                const SizedBox(height: 8),
                Text('${brand?['bio'] ?? brand?['description'] ?? ''}'),
                const SizedBox(height: 12),
                Text('Active campaigns: ${brand?['active_campaigns'] ?? 0}'),
                Text('Creators hired: ${brand?['creators_hired'] ?? 0}'),
              ],
            ),
    );
  }
}

class ProductionDetailPage extends ConsumerStatefulWidget {
  const ProductionDetailPage({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ProductionDetailPage> createState() => _ProductionDetailPageState();
}

class _ProductionDetailPageState extends ConsumerState<ProductionDetailPage> {
  Map<String, dynamic>? member;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      member = await ref.read(cr8ApiProvider).marketplaceProductionMember(widget.id);
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${member?['name'] ?? 'Production'}')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('${member?['production_category_label'] ?? member?['production_category'] ?? ''}'),
                Text('${member?['city'] ?? ''}'),
                Text('Rate: ₹${member?['base_rate'] ?? '—'}'),
                const SizedBox(height: 8),
                Text('${member?['bio'] ?? ''}'),
                const SizedBox(height: 16),
                Cr8Button(
                  label: 'Request hire',
                  onPressed: () async {
                    try {
                      await ref.read(cr8ApiProvider).createHireRequest({
                        'production_id': widget.id,
                        'message': 'Hire request from flugr app',
                      });
                      if (mounted) showCr8Snack(context, 'Hire request sent');
                    } catch (e) {
                      if (mounted) showCr8Snack(context, e.toString(), error: true);
                    }
                  },
                ),
              ],
            ),
    );
  }
}

class HireRequestsPage extends ConsumerStatefulWidget {
  const HireRequestsPage({super.key});
  @override
  ConsumerState<HireRequestsPage> createState() => _HireRequestsPageState();
}

class _HireRequestsPageState extends ConsumerState<HireRequestsPage> {
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
      items = await ref.read(cr8ApiProvider).hireRequests();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hire Requests')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : items.isEmpty
              ? const EmptyState(message: 'No hire requests')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: items.length,
                    itemBuilder: (_, i) {
                      final it = items[i];
                      return ListTile(
                        title: Text('${it['production_name'] ?? it['title'] ?? 'Request'}'),
                        subtitle: Text('${it['status'] ?? ''} · ${it['created_at'] ?? ''}'),
                        trailing: PopupMenuButton<String>(
                          onSelected: (a) async {
                            try {
                              await ref.read(cr8ApiProvider).hireRequestAction('${it['id']}', a);
                              _load();
                            } catch (e) {
                              if (mounted) showCr8Snack(context, e.toString(), error: true);
                            }
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'accepted', child: Text('Accept')),
                            PopupMenuItem(value: 'rejected', child: Text('Decline')),
                            PopupMenuItem(value: 'completed', child: Text('Complete')),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

class SupportPage extends ConsumerStatefulWidget {
  const SupportPage({super.key});
  @override
  ConsumerState<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends ConsumerState<SupportPage> {
  List<Map<String, dynamic>> tickets = [];
  List<Map<String, dynamic>> faqs = [];
  final subject = TextEditingController();
  final body = TextEditingController();
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    subject.dispose();
    body.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      tickets = await api.supportTickets();
      final f = await api.supportFaqs();
      faqs = (f['items'] as List? ?? f['faqs'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: Cr8Colors.accent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Cr8SectionLabel('New ticket'),
                TextField(controller: subject, decoration: const InputDecoration(labelText: 'Subject')),
                TextField(controller: body, decoration: const InputDecoration(labelText: 'Message'), maxLines: 3),
                const SizedBox(height: 8),
                Cr8Button(
                  label: 'Submit',
                  onPressed: () async {
                    try {
                      await ref.read(cr8ApiProvider).createSupportTicket({
                        'subject': subject.text.trim(),
                        'body': body.text.trim(),
                        'message': body.text.trim(),
                      });
                      subject.clear();
                      body.clear();
                      await _load();
                      if (mounted) showCr8Snack(context, 'Ticket created');
                    } catch (e) {
                      if (mounted) showCr8Snack(context, e.toString(), error: true);
                    }
                  },
                ),
                const SizedBox(height: 20),
                const Cr8SectionLabel('Your tickets'),
                ...tickets.map((t) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${t['subject'] ?? t['number'] ?? 'Ticket'}'),
                      subtitle: Text('${t['status'] ?? ''}'),
                    )),
                const SizedBox(height: 16),
                const Cr8SectionLabel('FAQs'),
                ...faqs.map((f) => ExpansionTile(
                      title: Text('${f['question'] ?? f['title'] ?? 'FAQ'}'),
                      children: [Padding(padding: const EdgeInsets.all(12), child: Text('${f['answer'] ?? f['body'] ?? ''}'))],
                    )),
              ],
            ),
    );
  }
}
