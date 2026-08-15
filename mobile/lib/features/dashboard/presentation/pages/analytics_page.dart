import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../widgets/creator_studio.dart';

/// Dedicated analytics tab: trend + audience snapshot without the rest of Home.
class AnalyticsPage extends ConsumerWidget {
  const AnalyticsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final seed = (user?.id ?? 'cr8').codeUnits.fold(0, (a, c) => a + c);
    final trend7 = buildTrend(base: 18000, days: 7, seed: seed);
    final trend30 = buildTrend(base: 14000, days: 30, seed: seed + 3);
    final raw = user?.raw ?? {};
    final platforms = raw['platform_metrics'] is Map
        ? Map<String, dynamic>.from(raw['platform_metrics'] as Map)
        : <String, dynamic>{};

    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          Text('Audience & reach', style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
            'Scan views, engagement, and platform mix in a few seconds.',
            style: GoogleFonts.manrope(color: Cr8Colors.muted, fontSize: 13),
          ),
          const SizedBox(height: 16),
          _ChartBlock(title: 'Views · 7 days', values: trend7),
          const SizedBox(height: 12),
          _ChartBlock(title: 'Reach · 30 days', values: trend30),
          const SizedBox(height: 18),
          Text('Audience insights', style: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          if (platforms.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Cr8Colors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Cr8Colors.hairline),
              ),
              child: Text(
                'Connect social accounts to see platform-level audience mix.',
                style: GoogleFonts.manrope(color: Cr8Colors.muted),
              ),
            )
          else
            ...platforms.entries.map((e) {
              final p = e.value is Map ? Map<String, dynamic>.from(e.value as Map) : <String, dynamic>{};
              final followers = p['followers'] ?? p['subscribers'] ?? 0;
              final er = p['engagement'];
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  tileColor: Cr8Colors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                    side: const BorderSide(color: Cr8Colors.hairline),
                  ),
                  title: Text(e.key.toUpperCase()),
                  subtitle: Text('${p['handle'] ?? '—'}'),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(formatCompact(followers is num ? followers : 0), style: GoogleFonts.manrope(fontWeight: FontWeight.w800)),
                      if (er is num)
                        Text('${er.toStringAsFixed(1)}% ER', style: GoogleFonts.manrope(color: Cr8Colors.success, fontSize: 12)),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _ChartBlock extends StatelessWidget {
  const _ChartBlock({required this.title, required this.values});
  final String title;
  final List<double> values;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      decoration: BoxDecoration(
        color: Cr8Colors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Cr8Colors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          SizedBox(
            height: 120,
            width: double.infinity,
            child: CustomPaint(painter: SparklinePainter(values: values, color: Cr8Colors.accent)),
          ),
        ],
      ),
    );
  }
}
