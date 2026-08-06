import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

/// Lightweight offline cache for feed / profile / conversations.
class OfflineCache {
  static const feedBox = 'cr8_feed_cache';
  static const profileBox = 'cr8_profile_cache';
  static const convoBox = 'cr8_convo_cache';
  static const queueBox = 'cr8_outbox';

  static Future<void> init() async {
    await Hive.initFlutter();
    await Future.wait([
      Hive.openBox(feedBox),
      Hive.openBox(profileBox),
      Hive.openBox(convoBox),
      Hive.openBox(queueBox),
    ]);
  }

  static Future<void> putJson(String box, String key, Object value) async {
    await Hive.box(box).put(key, jsonEncode(value));
  }

  static dynamic getJson(String box, String key) {
    final raw = Hive.box(box).get(key);
    if (raw is! String) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  static Future<void> enqueue(Map<String, dynamic> action) async {
    final list = List<Map<String, dynamic>>.from(
      (getJson(queueBox, 'pending') as List?)?.map((e) => Map<String, dynamic>.from(e as Map)) ?? [],
    );
    list.add(action);
    await putJson(queueBox, 'pending', list);
  }

  static List<Map<String, dynamic>> pending() {
    final raw = getJson(queueBox, 'pending');
    if (raw is! List) return [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  static Future<void> clearPending() async => putJson(queueBox, 'pending', []);
}
