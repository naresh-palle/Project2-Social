import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

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

/// Kept for unit tests / sparkline utilities (Performance chart removed from Home).
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

/// Premium post-login creator home (annotated layout):
/// Brand offers → earnings + pitches/campaigns → overall social KPIs → shortcuts.
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
    final snapshot = CreatorSnapshot.from(user, stats, wallet, campaigns);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        _GreetingHeader(
          user: user,
          onOpenMenu: onOpenMenu,
          unreadCount: notifications.length,
        ),
        const SizedBox(height: 18),
        _EarningsHero(snapshot: snapshot),
        const SizedBox(height: 14),
        _OverallAnalytics(snapshot: snapshot),
        const SizedBox(height: 18),
        const _Shortcuts(),
      ],
    );
  }
}

class CreatorSnapshot {
  CreatorSnapshot({
    required this.earnings,
    required this.followers,
    required this.engagement,
    required this.views,
    required this.activeCampaigns,
    required this.pendingCollabs,
    required this.pitches,
    required this.openBriefs,
    required this.connectedCount,
    required this.offers,
  });

  final num earnings;
  final num followers;
  final double engagement;
  final num views;
  final int activeCampaigns;
  final int pendingCollabs;
  final int pitches;
  final int openBriefs;
  final int connectedCount;
  final List<Map<String, dynamic>> offers;

  factory CreatorSnapshot.from(
    UserEntity user,
    Map<String, dynamic> stats,
    Map<String, dynamic> wallet,
    List<Map<String, dynamic>> campaigns,
  ) {
    final raw = user.raw;
    final platforms = raw['platform_metrics'] is Map
        ? Map<String, dynamic>.from(raw['platform_metrics'] as Map)
        : <String, dynamic>{};
    num followers = 0;
    final ers = <double>[];
    num views = 0;
    var connected = 0;
    for (final entry in platforms.entries) {
      final p = entry.value;
      if (p is! Map) continue;
      final handle = '${p['handle'] ?? ''}'.trim();
      if (handle.isEmpty) continue;
      connected += 1;
      followers += (p['followers'] as num?) ?? (p['subscribers'] as num?) ?? 0;
      final er = (p['engagement'] as num?)?.toDouble() ?? (p['er'] as num?)?.toDouble();
      if (er != null && er > 0) ers.add(er);
      views += (p['views'] as num?) ?? 0;
    }
    if (followers == 0) {
      followers = (stats['followers'] as num?) ?? (raw['followers'] as num?) ?? 0;
    }
    if (views == 0) {
      views = (stats['views'] as num?) ?? 0;
    }

    final earned = (wallet['balance'] as num?) ?? (stats['earned'] as num?) ?? user.wallet ?? 0;
    final openBriefs = campaigns.length;

    return CreatorSnapshot(
      earnings: earned,
      followers: followers,
      engagement: ers.isEmpty
          ? ((stats['avg_engagement'] as num?)?.toDouble() ?? 0)
          : ers.reduce((a, b) => a + b) / ers.length,
      views: views,
      activeCampaigns: (stats['acceptances'] as num?)?.toInt() ?? 0,
      pendingCollabs: (stats['invitations'] as num?)?.toInt() ?? 0,
      pitches: (stats['applications'] as num?)?.toInt() ?? 0,
      openBriefs: openBriefs,
      connectedCount: connected,
      offers: campaigns.take(4).toList(),
    );
  }
}

class _GreetingHeader extends StatelessWidget {
  const _GreetingHeader({
    required this.user,
    this.onOpenMenu,
    this.unreadCount = 0,
  });
  final UserEntity user;
  final VoidCallback? onOpenMenu;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    final name = user.displayName;
    return Row(
      children: [
        GestureDetector(
          onTap: () => context.push('/profile'),
          child: CircleAvatar(
            radius: 26,
            backgroundColor: Cr8Colors.accent.withValues(alpha: 0.2),
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
                [
                  user.displayHandle,
                  'Creator',
                  if (user.displayLocation.isNotEmpty) user.displayLocation,
                ].join(' · '),
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
          icon: Badge(
            isLabelVisible: unreadCount > 0,
            label: Text(
              unreadCount > 9 ? '9+' : '$unreadCount',
              style: const TextStyle(fontSize: 10),
            ),
            child: const Icon(Icons.notifications_none_rounded),
          ),
        ),
      ],
    );
  }
}

class _OffersSection extends StatelessWidget {
  const _OffersSection({required this.offers});
  final List<Map<String, dynamic>> offers;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Brand offers', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
            const Spacer(),
            TextButton(
              onPressed: () => context.push('/marketplace'),
              child: Text(offers.isEmpty ? 'Browse all' : '${offers.length} live'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (offers.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
            decoration: BoxDecoration(
              color: Cr8Colors.surface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: Cr8Colors.hairline),
            ),
            child: Column(
              children: [
                Text(
                  'No live brand offers right now.',
                  style: GoogleFonts.manrope(color: Cr8Colors.muted, fontSize: 13),
                ),
                TextButton(
                  onPressed: () => context.push('/marketplace'),
                  child: const Text('Open campaigns'),
                ),
              ],
            ),
          )
        else
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

class _EarningsHero extends StatelessWidget {
  const _EarningsHero({required this.snapshot});
  final CreatorSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final campaignCount = snapshot.openBriefs > 0 ? snapshot.openBriefs : snapshot.activeCampaigns;
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
            color: Cr8Colors.accent.withValues(alpha: 0.35),
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
          Text(
            '${snapshot.pendingCollabs} collabs pending · ${snapshot.activeCampaigns} active',
            style: GoogleFonts.manrope(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _HeroStat(
                  label: 'Pitches',
                  value: '${snapshot.pitches}',
                  hint: 'applications',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HeroStat(
                  label: 'Campaigns',
                  value: '$campaignCount',
                  hint: snapshot.openBriefs > 0 ? 'open briefs' : 'accepted',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.label, required this.value, required this.hint});
  final String label;
  final String value;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.manrope(
              color: Colors.white70,
              fontSize: 10,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.manrope(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
          ),
          Text(hint, style: GoogleFonts.manrope(color: Colors.white60, fontSize: 11)),
        ],
      ),
    );
  }
}

class _OverallAnalytics extends StatelessWidget {
  const _OverallAnalytics({required this.snapshot});
  final CreatorSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Overall analytics', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(
          'Total social media presence / strength · followers, engagement & views',
          style: GoogleFonts.manrope(fontSize: 12, color: Cr8Colors.muted),
        ),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 1,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          childAspectRatio: 3.4,
          children: [
            _KpiCard(
              label: 'Total followers',
              value: snapshot.followers > 0 ? formatCompact(snapshot.followers) : '—',
              hint: snapshot.connectedCount > 0 ? '${snapshot.connectedCount} connected' : 'Connect socials',
              tone: snapshot.followers > 0 ? Cr8Colors.success : Cr8Colors.muted,
            ),
            _KpiCard(
              label: 'Engagement',
              value: snapshot.engagement > 0 ? '${snapshot.engagement.toStringAsFixed(1)}%' : '—',
              hint: snapshot.engagement > 0 ? 'avg. rate' : 'Sync to refresh',
              tone: snapshot.engagement > 0 ? Cr8Colors.success : Cr8Colors.muted,
            ),
            _KpiCard(
              label: 'Total views',
              value: snapshot.views > 0 ? formatCompact(snapshot.views) : '—',
              hint: snapshot.views > 0 ? 'platform total' : 'No views yet',
              tone: snapshot.views > 0 ? Cr8Colors.success : Cr8Colors.muted,
            ),
          ],
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
          BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 16, offset: const Offset(0, 8)),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
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
                const SizedBox(height: 4),
                Text(
                  value,
                  style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.w800, height: 1.1),
                ),
              ],
            ),
          ),
          Text(hint, style: GoogleFonts.manrope(fontSize: 12, fontWeight: FontWeight.w600, color: tone)),
        ],
      ),
    );
  }
}

class _Shortcuts extends StatelessWidget {
  const _Shortcuts();

  @override
  Widget build(BuildContext context) {
    // Do not duplicate Feed / Wallet — those live in the drawer / bottom nav.
    const actions = [
      (Icons.grid_view_rounded, 'Campaigns', '/marketplace'),
      (Icons.favorite_border, 'Wishlist', '/wishlist'),
      (Icons.verified_user_outlined, 'Social audit', '/social-audit'),
      (Icons.account_balance_wallet_outlined, 'Wallet', '/wallet'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Shortcuts', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
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

/// Retained for tests / optional charts elsewhere.
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
          colors: [color.withValues(alpha: 0.35), color.withValues(alpha: 0)],
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
