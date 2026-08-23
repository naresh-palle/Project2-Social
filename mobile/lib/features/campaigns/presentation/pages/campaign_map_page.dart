import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/network/cr8_api.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// OYO-style campaign discovery map for creators.
class CampaignMapPage extends ConsumerStatefulWidget {
  const CampaignMapPage({super.key, this.embedded = false});
  final bool embedded;

  @override
  ConsumerState<CampaignMapPage> createState() => _CampaignMapPageState();
}

class _CampaignMapPageState extends ConsumerState<CampaignMapPage> {
  final _map = MapController();
  final _search = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _campaigns = [];
  Map<String, dynamic>? _selected;
  bool _loading = true;
  bool _listMode = false;
  bool _filtersOpen = false;
  String _sort = 'recommended';
  double? _radius = 50;
  String? _platform;
  String? _category;
  String? _deadline;
  int? _budgetMin;
  int? _budgetMax;
  LatLng _center = const LatLng(20.5937, 78.9629);
  int _total = 0;

  static const _cities = {
    'mumbai': LatLng(19.076, 72.8777),
    'delhi': LatLng(28.6139, 77.209),
    'bangalore': LatLng(12.9716, 77.5946),
    'bengaluru': LatLng(12.9716, 77.5946),
    'hyderabad': LatLng(17.385, 78.4867),
    'chennai': LatLng(13.0827, 80.2707),
    'kolkata': LatLng(22.5726, 88.3639),
    'pune': LatLng(18.5204, 73.8567),
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _resolveOrigin();
      _fetch();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _map.dispose();
    super.dispose();
  }

  void _resolveOrigin() {
    final user = ref.read(authProvider).user;
    final city = (user?.city ?? user?.displayLocation ?? '').toLowerCase().trim();
    if (city.isNotEmpty && _cities.containsKey(city)) {
      _center = _cities[city]!;
    } else {
      for (final e in _cities.entries) {
        if (city.contains(e.key)) {
          _center = e.value;
          break;
        }
      }
    }
    setState(() {});
  }

  Future<void> _fetch({LatLngBounds? bounds}) async {
    setState(() => _loading = true);
    try {
      final data = await ref.read(cr8ApiProvider).creatorCampaignsMap(
            latitude: _center.latitude,
            longitude: _center.longitude,
            radius: bounds == null ? _radius : null,
            minBudget: _budgetMin?.toDouble(),
            maxBudget: _budgetMax?.toDouble(),
            category: _category,
            platform: _platform,
            deadline: _deadline,
            search: _search.text.trim().isEmpty ? null : _search.text.trim(),
            sort: _sort,
            north: bounds?.north,
            south: bounds?.south,
            east: bounds?.east,
            west: bounds?.west,
          );
      final list = (data['campaigns'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      if (!mounted) return;
      setState(() {
        _campaigns = list;
        _total = (data['total'] as num?)?.toInt() ?? list.length;
        final o = data['origin'];
        if (o is Map && o['latitude'] != null && o['longitude'] != null) {
          _center = LatLng((o['latitude'] as num).toDouble(), (o['longitude'] as num).toDouble());
        }
      });
    } catch (e) {
      if (mounted) showCr8Snack(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onMapEvent(MapEvent event) {
    if (event is MapEventMoveEnd || event is MapEventFlingAnimationEnd) {
      _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 400), () {
        _fetch(bounds: _map.camera.visibleBounds);
      });
    }
  }

  List<_MapNode> get _nodes {
    final zoom = _map.camera.zoom;
    final cell = zoom >= 12
        ? 0.02
        : zoom >= 10
            ? 0.05
            : zoom >= 8
                ? 0.12
                : 0.35;
    final buckets = <String, List<Map<String, dynamic>>>{};
    for (final c in _campaigns) {
      final lat = (c['latitude'] as num?)?.toDouble();
      final lng = (c['longitude'] as num?)?.toDouble();
      if (lat == null || lng == null) continue;
      final key = '${(lat / cell).round()}_${(lng / cell).round()}';
      buckets.putIfAbsent(key, () => []).add(c);
    }
    return buckets.values.map((items) {
      if (items.length == 1) return _MapNode.pin(items.first);
      final lat = items.map((e) => (e['latitude'] as num).toDouble()).reduce((a, b) => a + b) / items.length;
      final lng = items.map((e) => (e['longitude'] as num).toDouble()).reduce((a, b) => a + b) / items.length;
      return _MapNode.cluster(lat, lng, items);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final mapBody = Stack(
      children: [
          if (!_listMode)
            FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: _center,
                initialZoom: 11,
                onMapEvent: _onMapEvent,
                onTap: (_, __) => setState(() => _selected = null),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'studio.cr8.mobile',
                ),
                MarkerLayer(
                  markers: _nodes.map((n) {
                    if (n.isCluster) {
                      return Marker(
                        point: LatLng(n.lat, n.lng),
                        width: 110,
                        height: 36,
                        child: GestureDetector(
                          onTap: () {
                            _map.move(LatLng(n.lat, n.lng), math.min(_map.camera.zoom + 2, 15));
                            setState(() {});
                          },
                          child: _Bubble(label: '${n.count} Campaigns', cluster: true),
                        ),
                      );
                    }
                    final c = n.campaign!;
                    final selected = _selected?['id'] == c['id'];
                    final label = '${c['budget_display'] ?? 'View'}';
                    return Marker(
                      point: LatLng(n.lat, n.lng),
                      width: math.max(52, label.length * 9.0),
                      height: 34,
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _selected = c);
                          _map.move(LatLng(n.lat, n.lng), _map.camera.zoom);
                        },
                        child: _Bubble(label: label, selected: selected),
                      ),
                    );
                  }).toList(),
                ),
              ],
            )
          else
            _ListPane(
              campaigns: _campaigns,
              sort: _sort,
              onSort: (v) {
                setState(() => _sort = v);
                _fetch();
              },
              onTap: (c) => context.push('/campaigns/${c['id']}'),
            ),
          Positioned(
            top: 8,
            left: 12,
            right: 12,
            child: Material(
              color: Cr8Colors.surface,
              elevation: 4,
              borderRadius: BorderRadius.circular(28),
              child: TextField(
                controller: _search,
                decoration: InputDecoration(
                  hintText: 'Search campaigns, brands or categories',
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.near_me_outlined),
                    onPressed: () {
                      _map.move(_center, 12);
                      _fetch();
                    },
                  ),
                ),
                onChanged: (_) {
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 350), _fetch);
                },
              ),
            ),
          ),
          if (_loading)
            const Positioned(
              top: 64,
              left: 0,
              right: 0,
              child: Center(child: CircularProgressIndicator(color: Cr8Colors.accent)),
            ),
          if (_selected != null && !_listMode)
            Positioned(
              left: 12,
              right: 12,
              bottom: 16,
              child: _CampaignSheet(
                c: _selected!,
                onClose: () => setState(() => _selected = null),
                onView: () => context.push('/campaigns/${_selected!['id']}'),
              ),
            ),
          if (!_loading && _campaigns.isEmpty)
            Center(
              child: Container(
                margin: const EdgeInsets.all(24),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Cr8Colors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Cr8Colors.hairline),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('No campaigns found', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    const Text('Try a wider radius or clear filters.', textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    Cr8Button(
                      label: 'Clear filters',
                      onPressed: () {
                        setState(() {
                          _radius = 50;
                          _platform = null;
                          _category = null;
                          _deadline = null;
                          _budgetMin = null;
                          _budgetMax = null;
                          _search.clear();
                        });
                        _fetch();
                      },
                    ),
                  ],
                ),
              ),
            ),
          if (_filtersOpen)
            _FiltersSheet(
              radius: _radius,
              platform: _platform,
              category: _category,
              deadline: _deadline,
              budgetMin: _budgetMin,
              budgetMax: _budgetMax,
              total: _total,
              onClose: () => setState(() => _filtersOpen = false),
              onApply: (r, p, c, d, minB, maxB) {
                setState(() {
                  _radius = r;
                  _platform = p;
                  _category = c;
                  _deadline = d;
                  _budgetMin = minB;
                  _budgetMax = maxB;
                  _filtersOpen = false;
                });
                _fetch();
              },
            ),
        ],
      );

    if (widget.embedded) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        floatingActionButton: FloatingActionButton.small(
          onPressed: () => setState(() => _filtersOpen = true),
          backgroundColor: Cr8Colors.surface,
          child: const Icon(Icons.tune_rounded),
        ),
        body: mapBody,
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Campaigns · Map'),
        actions: [
          IconButton(
            tooltip: _listMode ? 'Map' : 'List',
            onPressed: () => setState(() => _listMode = !_listMode),
            icon: Icon(_listMode ? Icons.map_outlined : Icons.list_alt_rounded),
          ),
          IconButton(
            tooltip: 'Filters',
            onPressed: () => setState(() => _filtersOpen = true),
            icon: const Icon(Icons.tune_rounded),
          ),
        ],
      ),
      body: mapBody,
    );
  }
}

class _MapNode {
  _MapNode.pin(this.campaign)
      : lat = (campaign!['latitude'] as num).toDouble(),
        lng = (campaign['longitude'] as num).toDouble(),
        count = 1,
        isCluster = false;
  _MapNode.cluster(this.lat, this.lng, List<Map<String, dynamic>> items)
      : campaign = null,
        count = items.length,
        isCluster = true;
  final Map<String, dynamic>? campaign;
  final double lat;
  final double lng;
  final int count;
  final bool isCluster;
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.label, this.selected = false, this.cluster = false});
  final String label;
  final bool selected;
  final bool cluster;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: selected
            ? Cr8Colors.accent
            : cluster
                ? const Color(0xFF1C1C22)
                : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: selected ? Colors.white : Colors.black12, width: selected ? 2 : 1),
        boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Text(
        label,
        style: TextStyle(
          color: selected || cluster ? Colors.white : Colors.black,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _CampaignSheet extends StatelessWidget {
  const _CampaignSheet({required this.c, required this.onClose, required this.onView});
  final Map<String, dynamic> c;
  final VoidCallback onClose;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Cr8Colors.surface,
      elevation: 12,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${c['brand'] ?? ''}', style: const TextStyle(color: Cr8Colors.accent, fontSize: 11, fontWeight: FontWeight.w700)),
                      Text('${c['name'] ?? 'Campaign'}', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
                if (c['match_score'] != null)
                  Text('${c['match_score']}% Match', style: const TextStyle(color: Color(0xFF34C759), fontWeight: FontWeight.w800, fontSize: 12)),
                IconButton(onPressed: onClose, icon: const Icon(Icons.close)),
              ],
            ),
            Text('${c['location'] ?? ''}${c['distance_km'] != null ? ' · ${c['distance_km']} km' : ''} · ${c['category'] ?? ''}'),
            const SizedBox(height: 6),
            Text('${c['budget_label'] ?? c['budget_display'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            Text('${(c['platforms'] as List? ?? []).join(' · ')} · ${c['deliverables'] ?? ''}'),
            if (c['deadline'] != null) Text('Apply before ${c['deadline']}'),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: Cr8Button(label: 'View Campaign', onPressed: onView)),
                const SizedBox(width: 8),
                Expanded(child: Cr8Button(label: 'Apply Now', outlined: true, onPressed: onView)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ListPane extends StatelessWidget {
  const _ListPane({required this.campaigns, required this.sort, required this.onSort, required this.onTap});
  final List<Map<String, dynamic>> campaigns;
  final String sort;
  final ValueChanged<String> onSort;
  final ValueChanged<Map<String, dynamic>> onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 64),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              Text('${campaigns.length} campaigns'),
              const Spacer(),
              DropdownButton<String>(
                value: sort,
                underline: const SizedBox.shrink(),
                items: const [
                  DropdownMenuItem(value: 'recommended', child: Text('Recommended')),
                  DropdownMenuItem(value: 'highest_match', child: Text('Highest Match')),
                  DropdownMenuItem(value: 'highest_budget', child: Text('Highest Budget')),
                  DropdownMenuItem(value: 'nearest', child: Text('Nearest')),
                  DropdownMenuItem(value: 'ending_soon', child: Text('Ending Soon')),
                ],
                onChanged: (v) => v != null ? onSort(v) : null,
              ),
            ],
          ),
        ),
        Expanded(
          child: campaigns.isEmpty
              ? const EmptyState(message: 'No campaigns')
              : ListView.builder(
                  itemCount: campaigns.length,
                  itemBuilder: (_, i) {
                    final c = campaigns[i];
                    return ListTile(
                      title: Text('${c['name']}'),
                      subtitle: Text('${c['brand']} · ${c['location']} · ${c['budget_display']}'),
                      trailing: c['match_score'] != null ? Text('${c['match_score']}%') : null,
                      onTap: () => onTap(c),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _FiltersSheet extends StatelessWidget {
  const _FiltersSheet({
    required this.radius,
    required this.platform,
    required this.category,
    required this.deadline,
    required this.budgetMin,
    required this.budgetMax,
    required this.total,
    required this.onClose,
    required this.onApply,
  });

  final double? radius;
  final String? platform;
  final String? category;
  final String? deadline;
  final int? budgetMin;
  final int? budgetMax;
  final int total;
  final VoidCallback onClose;
  final void Function(double? r, String? p, String? c, String? d, int? minB, int? maxB) onApply;

  @override
  Widget build(BuildContext context) {
    double? r = radius;
    String? p = platform;
    String? c = category;
    String? d = deadline;
    int? minB = budgetMin;
    int? maxB = budgetMax;

    return Positioned.fill(
      child: Material(
        color: Colors.black54,
        child: Align(
          alignment: Alignment.bottomCenter,
          child: StatefulBuilder(
            builder: (context, setLocal) {
              Widget pills(List<(String?, String)> opts, String? value, ValueChanged<String?> onPick) {
                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: opts
                      .map(
                        (o) => ChoiceChip(
                          label: Text(o.$2),
                          selected: value == o.$1,
                          onSelected: (_) => setLocal(() => onPick(value == o.$1 ? null : o.$1)),
                        ),
                      )
                      .toList(),
                );
              }

              return Container(
                constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.78),
                decoration: const BoxDecoration(
                  color: Cr8Colors.surface,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Column(
                  children: [
                    ListTile(
                      title: const Text('Filters', style: TextStyle(fontWeight: FontWeight.w800)),
                      trailing: IconButton(onPressed: onClose, icon: const Icon(Icons.close)),
                    ),
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        children: [
                          const Cr8SectionLabel('Radius'),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final opt in [(5.0, '5 km'), (10.0, '10 km'), (25.0, '25 km'), (50.0, '50 km'), (100.0, '100 km')])
                                ChoiceChip(
                                  label: Text(opt.$2),
                                  selected: r == opt.$1,
                                  onSelected: (_) => setLocal(() => r = r == opt.$1 ? null : opt.$1),
                                ),
                              ChoiceChip(
                                label: const Text('Anywhere'),
                                selected: r == null,
                                onSelected: (_) => setLocal(() => r = null),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Cr8SectionLabel('Budget'),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final b in [
                                (1000, 5000, '₹1K–₹5K'),
                                (5000, 10000, '₹5K–₹10K'),
                                (10000, 25000, '₹10K–₹25K'),
                                (25000, 50000, '₹25K–₹50K'),
                                (50000, 100000, '₹50K–₹1L'),
                                (100000, null, '₹1L+'),
                              ])
                                ChoiceChip(
                                  label: Text(b.$3),
                                  selected: minB == b.$1 && maxB == b.$2,
                                  onSelected: (_) => setLocal(() {
                                    if (minB == b.$1 && maxB == b.$2) {
                                      minB = null;
                                      maxB = null;
                                    } else {
                                      minB = b.$1;
                                      maxB = b.$2;
                                    }
                                  }),
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Cr8SectionLabel('Platform'),
                          pills(
                            const [
                              ('instagram', 'Instagram'),
                              ('youtube', 'YouTube'),
                              ('facebook', 'Facebook'),
                              ('tiktok', 'TikTok'),
                              ('x', 'X'),
                            ],
                            p,
                            (v) => p = v,
                          ),
                          const SizedBox(height: 12),
                          const Cr8SectionLabel('Category'),
                          pills(
                            const [
                              ('fashion', 'Fashion'),
                              ('beauty', 'Beauty'),
                              ('food', 'Food'),
                              ('travel', 'Travel'),
                              ('fitness', 'Fitness'),
                              ('technology', 'Technology'),
                              ('lifestyle', 'Lifestyle'),
                            ],
                            c,
                            (v) => c = v,
                          ),
                          const SizedBox(height: 12),
                          const Cr8SectionLabel('Deadline'),
                          pills(
                            const [
                              ('today', 'Ending Today'),
                              ('3d', 'Next 3 Days'),
                              ('7d', 'Next 7 Days'),
                              ('30d', 'Next 30 Days'),
                            ],
                            d,
                            (v) => d = v,
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Cr8Button(
                        label: 'Show results ($total)',
                        onPressed: () => onApply(r, p, c, d, minB, maxB),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
