import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/widgets/studio_backdrop.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Invoice list for creators and brands (issued / received).
class BillingPage extends ConsumerStatefulWidget {
  const BillingPage({super.key});

  @override
  ConsumerState<BillingPage> createState() => _BillingPageState();
}

class _BillingPageState extends ConsumerState<BillingPage> {
  String box = 'issued';
  Map<String, dynamic>? summary;
  List<Map<String, dynamic>> rows = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    final role = ref.read(authProvider).user?.role;
    if (role == 'owner' || role == 'agent') box = 'received';
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final api = ref.read(cr8ApiProvider);
      final s = await api.invoicesSummary(box: box);
      final list = await api.invoices(box: box);
      if (!mounted) return;
      setState(() {
        summary = s;
        rows = list;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => loading = false);
      showCr8Snack(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = Map<String, dynamic>.from(summary?['cards'] as Map? ?? {});
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) cr8Back(context, fallback: '/dashboard');
        },
        child: StudioBackdrop(
          dim: 0.45,
          child: SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 4, 16, 0),
                  child: Row(
                    children: [
                      const Cr8BackButton(fallback: '/dashboard'),
                      const SizedBox(width: 4),
                      Text('Billing', style: Theme.of(context).textTheme.headlineSmall),
                      const Spacer(),
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'issued', label: Text('Issued')),
                          ButtonSegment(value: 'received', label: Text('Received')),
                        ],
                        selected: {box},
                        onSelectionChanged: (s) {
                          setState(() => box = s.first);
                          _load();
                        },
                      ),
                    ],
                  ),
                ),
                if (loading)
                  const Expanded(child: Center(child: CircularProgressIndicator(color: Cr8Colors.accent)))
                else
                  Expanded(
                    child: RefreshIndicator(
                      color: Cr8Colors.accent,
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                        children: [
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _chip('Invoiced', cards['total']),
                              _chip('Paid', cards['paid']),
                              _chip('Outstanding', cards['outstanding']),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text('Invoices', style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15)),
                          const SizedBox(height: 8),
                          if (rows.isEmpty)
                            const EmptyState(message: 'No invoices yet')
                          else
                            ...rows.map((r) {
                              final status = '${r['status'] ?? 'draft'}';
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ListTile(
                                  title: Text(
                                    '${r['invoice_number'] ?? 'DRAFT'}',
                                    style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
                                  ),
                                  subtitle: Text(
                                    '${r['buyer_name'] ?? r['supplier_name'] ?? ''}\n$status',
                                    maxLines: 2,
                                  ),
                                  isThreeLine: true,
                                  trailing: Text(
                                    '₹${r['grand_total'] ?? r['total'] ?? '—'}',
                                    style: GoogleFonts.manrope(
                                      color: Cr8Colors.accent,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, dynamic value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Cr8Colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Cr8Colors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.manrope(fontSize: 10, color: Cr8Colors.muted, letterSpacing: 0.6)),
          const SizedBox(height: 2),
          Text(
            value == null ? '—' : '₹$value',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 14),
          ),
        ],
      ),
    );
  }
}
