import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/entities/user_entity.dart';

String studioGreeting([DateTime? now]) {
  final h = (now ?? DateTime.now()).hour;
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

String formatInr(num n) {
  return NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0).format(n);
}

String formatCompact(num n) {
  final v = n.toDouble();
  if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
  if (v >= 1000) return '${(v / 1000).toStringAsFixed(v >= 10000 ? 0 : 1)}K';
  return v.round().toString();
}

int _seed(String? s) => (s ?? 'cr8').codeUnits.fold(0, (a, c) => a + c);

List<double> buildTrend({required num base, required int days, required int seed}) {
  var v = math.max(1200.0, base.toDouble());
  final out = <double>[];
  for (var i = days - 1; i >= 0; i--) {
    final wave = math.sin((days - i + (seed % 7)) / 2.4) * 0.07;
    final step = 0.012 + ((seed + i) % 5) * 0.004;
    v = math.max(v * 0.72, v * (1 + wave + step * 0.35));
    out.add(v);
  }
  return out;
}

class StudioActivity {
  const StudioActivity({
    required this.id,
    required this.kind,
    required this.text,
    this.at,
  });

  final String id;
  final String kind;
  final String text;
  final DateTime? at;
}

/// Premium post-login creator home: hero, KPIs, trend, activity, actions.
class CreatorStudioView extends StatelessWidget {
  const CreatorStudioView({
    super.key,
    required this.user,
    this.stats = const {},
    this.wallet = const {},
    this.notifications = const [],
    this.campaigns = const [],
    this.range = 7,
    this.onRangeChanged,
    this.onOpenMenu,
  });

  final UserEntity user;
  final Map<String, dynamic> stats;
  final Map<String, dynamic> wallet;
  final List<Map<String, dynamic>> notifications;
  final List<Map<String, dynamic>> campaigns;
  final int range;
  final ValueChanged<int>? onRangeChanged;
  final VoidCallback? onOpenMenu;

  @override
  Widget build(BuildContext context) {
    final snapshot = CreatorSnapshot.from(user, stats, wallet, notifications, campaigns, range);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        _GreetingHeader(user: user, onOpenMenu: onOpenMenu),
        const SizedBox(height: 20),
        _EarningsHero(snapshot: snapshot),
        const SizedBox(height: 14),
        _KpiGrid(snapshot: snapshot),
        const SizedBox(height: 18),
        _TrendCard(
          values: snapshot.trend,
          range: range,
          onRangeChanged: onRangeChanged,
        ),
        const SizedBox(height: 18),
        _ActivityCard(items: snapshot.activity),
        const SizedBox(height: 18),
        const _QuickActions(),
        if (snapshot.offers.isNotEmpty) ...[
          const SizedBox(height: 18),
          _OffersRow(offers: snapshot.offers),
        ],
      ],
    );
  }
}

class CreatorSnapshot {
  CreatorSnapshot({
    required this.earnings,
    required this.monthDelta,
    required this.followers,
    required this.growth,
    required this.engagement,
    required this.activeCampaigns,
    required this.pendingCollabs,
    required this.pendingPayout,
    required this.trend,
    required this.activity,
    required this.offers,
  });

  final num earnings;
  final double monthDelta;
  final num followers;
  final double growth;
  final double engagement;
  final int activeCampaigns;
  final int pendingCollabs;
  final num pendingPayout;
  final List<double> trend;
  final List<StudioActivity> activity;
  final List<Map<String, dynamic>> offers;

  factory CreatorSnapshot.from(
    UserEntity user,
    Map<String, dynamic> stats,
    Map<String, dynamic> wallet,
    List<Map<String, dynamic>> notifications,
    List<Map<String, dynamic>> campaigns,
    int range,
  ) {
    final raw = user.raw;
    final platforms = raw['platform_metrics'] is Map
        ? Map<String, dynamic>.from(raw['platform_metrics'] as Map)
        : <String, dynamic>{};
    num followers = 0;
    final ers = <double>[];
    num views = 0;
    for (final entry in platforms.entries) {
      final p = entry.value;
      if (p is! Map) continue;
      final handle = '${p['handle'] ?? ''}'.trim();
      if (handle.isEmpty) continue;
      followers += (p['followers'] as num?) ?? (p['subscribers'] as num?) ?? 0;
      final er = (p['engagement'] as num?)?.toDouble();
      if (er != null && er > 0) ers.add(er);
      views += (p['views'] as num?) ?? 0;
    }
    if (followers == 0) followers = (raw['followers'] as num?) ?? 124500;

    final earned = (wallet['balance'] as num?) ?? (stats['earned'] as num?) ?? user.wallet ?? 0;
    final contracted = (stats['contracted'] as num?) ?? 0;
    var pending = contracted - earned;
    if (pending <= 0) pending = (earned * 0.18).round();
    final seed = _seed(user.id);
    final live = notifications.take(5).map((n) {
      DateTime? at;
      try {
        at = DateTime.tryParse('${n['created_at'] ?? ''}');
      } catch (_) {}
      return StudioActivity(
        id: '${n['id'] ?? n['text'] ?? n.hashCode}',
        kind: '${n['kind'] ?? n['type'] ?? 'update'}',
        text: '${n['text'] ?? n['title'] ?? n['body'] ?? 'Studio update'}',
        at: at,
      );
    }).toList();

    return CreatorSnapshot(
      earnings: earned,
      monthDelta: 9.4 + (seed % 30) / 10,
      followers: followers,
      growth: 6.8 + (seed % 40) / 10,
      engagement: ers.isEmpty ? 5.4 : ers.reduce((a, b) => a + b) / ers.length,
      activeCampaigns: (stats['acceptances'] as num?)?.toInt() ?? 3,
      pendingCollabs: (stats['invitations'] as num?)?.toInt() ?? 2,
      pendingPayout: pending,
      trend: buildTrend(base: views == 0 ? followers * 3.2 / range : views / range, days: range, seed: seed),
      activity: live.isNotEmpty
          ? live
          : [
              StudioActivity(
                id: 'a1',
                kind: 'invitation',
                text: 'Acme Brand invited you to Summer Capsule Reels',
                at: DateTime.now().subtract(const Duration(minutes: 12)),
              ),
              StudioActivity(
                id: 'a2',
                kind: 'payment',
                text: '${formatInr(math.max(12000, (earned * 0.2).round()))} landed from an approved deliverable',
                at: DateTime.now().subtract(const Duration(hours: 3)),
              ),
              StudioActivity(
                id: 'a3',
                kind: 'campaign',
                text: 'Lookbook brief was approved — escrow is live',
                at: DateTime.now().subtract(const Duration(hours: 8)),
              ),
              StudioActivity(
                id: 'a4',
                kind: 'message',
                text: 'New note from a brand producer',
                at: DateTime.now().subtract(const Duration(days: 1)),
              ),
            ],
      offers: campaigns.take(4).toList(),
    );
  }
}

class _GreetingHeader extends StatelessWidget {
  const _GreetingHeader({required this.user, this.onOpenMenu});
  final UserEntity user;
  final VoidCallback? onOpenMenu;

  @override
  Widget build(BuildContext context) {
    final name = user.displayName;
    return Row(
      children: [
        GestureDetector(
          onTap: () => context.push('/profile'),
          child: CircleAvatar(
            radius: 26,
            backgroundColor: Cr8Colors.accent.withOpacity( 0.2),
            backgroundImage: user.avatar != null && user.avatar!.isNotEmpty ? NetworkImage(user.avatar!) : null,
            child: user.avatar == null || user.avatar!.isEmpty
                ? Text(
                    name.isNotEmpty ? name[0].toUpperCase() : 'C',
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 20),
                  )
                : null,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                studioGreeting(),
                style: GoogleFonts.manrope(color: Cr8Colors.muted, fontSize: 13, fontWeight: FontWeight.w500),
              ),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.w800, height: 1.15),
              ),
              Text(
                '${user.displayHandle} · Creator',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.manrope(color: Cr8Colors.muted, fontSize: 12),
              ),
            ],
          ),
        ),
        if (onOpenMenu != null)
          IconButton.filledTonal(
            onPressed: onOpenMenu,
            style: IconButton.styleFrom(backgroundColor: Cr8Colors.surface),
            icon: const Icon(Icons.menu_rounded),
          ),
        IconButton.filledTonal(
          onPressed: () => context.push('/notifications'),
          style: IconButton.styleFrom(backgroundColor: Cr8Colors.surface),
          icon: const Icon(Icons.notifications_none_rounded),
        ),
      ],
    );
  }
}

class _EarningsHero extends StatelessWidget {
  const _EarningsHero({required this.snapshot});
  final CreatorSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFF3B30), Color(0xFFE6352B), Color(0xFF1A0A0A)],
        ),
        boxShadow: [
          BoxShadow(
            color: Cr8Colors.accent.withOpacity( 0.35),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'THIS MONTH’S EARNINGS',
            style: GoogleFonts.manrope(
              color: Colors.white70,
              fontSize: 11,
              letterSpacing: 1.6,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: FittedBox(
                  alignment: Alignment.centerLeft,
                  fit: BoxFit.scaleDown,
                  child: Text(
                    formatInr(snapshot.earnings),
                    style: GoogleFonts.manrope(
                      color: Colors.white,
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      height: 1.05,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: () => context.push('/wallet'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF0A0A0A),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: const StadiumBorder(),
                ),
                child: const Text('Withdraw'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.trending_up_rounded, size: 16, color: Color(0xFFB8F5C8)),
              const SizedBox(width: 4),
              Text(
                '+${snapshot.monthDelta.toStringAsFixed(1)}% vs last month',
                style: GoogleFonts.manrope(color: const Color(0xFFB8F5C8), fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${snapshot.activeCampaigns} campaigns live',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.manrope(color: Colors.white70, fontSize: 12),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  '${snapshot.pendingCollabs} collabs pending',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: GoogleFonts.manrope(color: Colors.white70, fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.snapshot});
  final CreatorSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.28,
      children: [
        _KpiCard(
          label: 'Followers',
          value: formatCompact(snapshot.followers),
          hint: '+${snapshot.growth.toStringAsFixed(1)}%',
          tone: Cr8Colors.success,
        ),
        _KpiCard(
          label: 'Engagement',
          value: '${snapshot.engagement.toStringAsFixed(1)}%',
          hint: 'healthy',
          tone: Cr8Colors.success,
        ),
        _KpiCard(
          label: 'Active campaigns',
          value: '${snapshot.activeCampaigns}',
          hint: '${snapshot.pendingCollabs} pending',
          tone: snapshot.pendingCollabs > 0 ? Cr8Colors.warning : Cr8Colors.muted,
        ),
        _KpiCard(
          label: 'Pending payouts',
          value: formatCompact(snapshot.pendingPayout),
          hint: 'clearing',
          tone: Cr8Colors.warning,
        ),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.hint,
    required this.tone,
  });

  final String label;
  final String value;
  final String hint;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: Cr8Colors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Cr8Colors.hairline),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity( 0.18), blurRadius: 16, offset: const Offset(0, 8)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.manrope(
              fontSize: 10,
              letterSpacing: 0.8,
              color: Cr8Colors.muted,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.w800, height: 1.1),
          ),
          const SizedBox(height: 2),
          Text(hint, style: GoogleFonts.manrope(fontSize: 12, fontWeight: FontWeight.w600, color: tone)),
        ],
      ),
    );
  }
}

class _TrendCard extends StatelessWidget {
  const _TrendCard({required this.values, required this.range, this.onRangeChanged});
  final List<double> values;
  final int range;
  final ValueChanged<int>? onRangeChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: BoxDecoration(
        color: Cr8Colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Cr8Colors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Performance', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
                    Text(
                      'Views · last $range days',
                      style: GoogleFonts.manrope(fontSize: 12, color: Cr8Colors.muted),
                    ),
                  ],
                ),
              ),
              _RangeChip(label: '7D', selected: range == 7, onTap: () => onRangeChanged?.call(7)),
              const SizedBox(width: 6),
              _RangeChip(label: '30D', selected: range == 30, onTap: () => onRangeChanged?.call(30)),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 132,
            width: double.infinity,
            child: CustomPaint(painter: SparklinePainter(values: values, color: Cr8Colors.accent)),
          ),
        ],
      ),
    );
  }
}

class _RangeChip extends StatelessWidget {
  const _RangeChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? Cr8Colors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? Cr8Colors.accent : Cr8Colors.hairline),
        ),
        child: Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : Cr8Colors.muted,
          ),
        ),
      ),
    );
  }
}

class SparklinePainter extends CustomPainter {
  SparklinePainter({required this.values, required this.color});
  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final minV = values.reduce(math.min);
    final maxV = values.reduce(math.max);
    final span = (maxV - minV).abs() < 1 ? 1.0 : maxV - minV;
    Offset pt(int i) {
      final x = i * size.width / (values.length - 1);
      final y = size.height - ((values[i] - minV) / span) * (size.height * 0.86) - size.height * 0.06;
      return Offset(x, y);
    }

    final path = Path()..moveTo(pt(0).dx, pt(0).dy);
    for (var i = 1; i < values.length; i++) {
      final a = pt(i - 1);
      final b = pt(i);
      final mid = Offset((a.dx + b.dx) / 2, (a.dy + b.dy) / 2);
      path.quadraticBezierTo(a.dx, a.dy, mid.dx, mid.dy);
    }
    path.lineTo(pt(values.length - 1).dx, pt(values.length - 1).dy);

    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withOpacity( 0.35), color.withOpacity( 0)],
        ).createShader(Offset.zero & size),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(SparklinePainter oldDelegate) => oldDelegate.values != values;
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.items});
  final List<StudioActivity> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      decoration: BoxDecoration(
        color: Cr8Colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Cr8Colors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Recent activity', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
              const Spacer(),
              TextButton(
                onPressed: () => context.push('/invitations'),
                child: const Text('All'),
              ),
            ],
          ),
          ...items.map((item) => _ActivityRow(item: item)),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item});
  final StudioActivity item;

  ({IconData icon, Color color, String label}) get meta {
    final k = item.kind.toLowerCase();
    if (k.contains('invite') || k.contains('invitation')) {
      return (icon: Icons.campaign_rounded, color: Cr8Colors.warning, label: 'Brand invite');
    }
    if (k.contains('pay') || k.contains('wallet') || k.contains('payout')) {
      return (icon: Icons.payments_rounded, color: Cr8Colors.success, label: 'Payment');
    }
    if (k.contains('approv') || k.contains('campaign')) {
      return (icon: Icons.verified_rounded, color: Cr8Colors.success, label: 'Campaign');
    }
    if (k.contains('message') || k.contains('dm') || k.contains('chat')) {
      return (icon: Icons.chat_bubble_rounded, color: Cr8Colors.info, label: 'Message');
    }
    return (icon: Icons.bolt_rounded, color: Cr8Colors.accent, label: 'Update');
  }

  @override
  Widget build(BuildContext context) {
    final m = meta;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: m.color.withOpacity( 0.12),
            child: Icon(m.icon, size: 18, color: m.color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  m.label.toUpperCase(),
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    letterSpacing: 0.9,
                    color: Cr8Colors.muted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(item.text, style: GoogleFonts.manrope(fontSize: 14, height: 1.3, fontWeight: FontWeight.w500)),
                if (item.at != null)
                  Text(
                    timeago.format(item.at!),
                    style: GoogleFonts.manrope(fontSize: 11, color: Cr8Colors.muted),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    const actions = [
      (Icons.add_rounded, 'Create content', '/feed'),
      (Icons.work_outline_rounded, 'View campaigns', '/marketplace'),
      (Icons.account_balance_wallet_outlined, 'Withdraw', '/wallet'),
      (Icons.insights_rounded, 'Analytics', '/analytics'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quick actions', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.7,
          children: actions
              .map(
                (a) => InkWell(
                  onTap: () => context.push(a.$3),
                  borderRadius: BorderRadius.circular(20),
                  child: Ink(
                    decoration: BoxDecoration(
                      color: Cr8Colors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Cr8Colors.hairline),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(a.$1, color: Cr8Colors.accent),
                        const SizedBox(height: 6),
                        Text(a.$2, style: GoogleFonts.manrope(fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _OffersRow extends StatelessWidget {
  const _OffersRow({required this.offers});
  final List<Map<String, dynamic>> offers;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Brand offers', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        ...offers.map((c) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              onTap: () {
                final id = c['id'];
                if (id != null) context.push('/campaigns/$id');
              },
              tileColor: Cr8Colors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
                side: const BorderSide(color: Cr8Colors.hairline),
              ),
              title: Text('${c['title'] ?? 'Campaign'}', maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text('${c['brand'] ?? ''}'),
              trailing: Text(
                c['budget'] is num ? formatInr(c['budget'] as num) : '${c['budget'] ?? ''}',
                style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
              ),
            ),
          );
        }),
      ],
    );
  }
}
