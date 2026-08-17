import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  const UserEntity({
    required this.id,
    required this.email,
    required this.role,
    this.name,
    this.username,
    this.handle,
    this.avatar,
    this.coverPhoto,
    this.bio,
    this.company,
    this.industry,
    this.website,
    this.city,
    this.state,
    this.mobile,
    this.verified = false,
    this.isPrivate = false,
    this.online,
    this.lastSeen,
    this.onboardingStatus,
    this.agentApproved,
    this.agentType,
    this.twoFaEnabled = false,
    this.wallet,
    this.theme,
    this.highContrast,
    this.fontScale,
    this.raw = const {},
  });

  final String id;
  final String email;
  final String role;
  final String? name;
  final String? username;
  final String? handle;
  final String? avatar;
  final String? coverPhoto;
  final String? bio;
  final String? company;
  final String? industry;
  final String? website;
  final String? city;
  final String? state;
  final String? mobile;
  final bool verified;
  final bool isPrivate;
  final bool? online;
  final String? lastSeen;
  final String? onboardingStatus;
  final bool? agentApproved;
  final String? agentType;
  final bool twoFaEnabled;
  final num? wallet;
  final String? theme;
  final bool? highContrast;
  final double? fontScale;
  final Map<String, dynamic> raw;

  bool get isInfluencer => role == 'influencer' || role == 'creator';
  bool get isCreator => isInfluencer;
  bool get isOwner => role == 'owner';
  bool get isAgent => role == 'agent';
  bool get isAdmin => role == 'admin';

  String get displayName => company ?? name ?? username ?? email;
  String get displayHandle =>
      handle?.startsWith('@') == true ? handle! : '@${handle ?? username ?? 'user'}';

  /// City / state / free-form location for UI headers and cards.
  String get displayLocation {
    final c = (city ?? '').trim();
    final s = (state ?? '').trim();
    final loc = (raw['location']?.toString() ?? '').trim();
    if (c.isNotEmpty && s.isNotEmpty) {
      if (c.toLowerCase() == s.toLowerCase()) return c;
      return '$c, $s';
    }
    if (c.isNotEmpty) return c;
    if (s.isNotEmpty) return s;
    if (loc.isNotEmpty) return loc;
    return '';
  }

  factory UserEntity.fromJson(Map<String, dynamic> json) {
    return UserEntity(
      id: (json['id'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      role: (json['role'] ?? 'influencer').toString(),
      name: json['name']?.toString(),
      username: json['username']?.toString(),
      handle: json['handle']?.toString(),
      avatar: json['avatar']?.toString(),
      coverPhoto: json['cover_photo']?.toString(),
      bio: json['bio']?.toString(),
      company: json['company']?.toString(),
      industry: json['industry']?.toString(),
      website: json['website']?.toString(),
      city: json['city']?.toString(),
      state: json['state']?.toString(),
      mobile: json['mobile']?.toString(),
      verified: json['verified'] == true,
      isPrivate: json['is_private'] == true,
      online: json['online'] is bool ? json['online'] as bool : null,
      lastSeen: json['last_seen']?.toString(),
      onboardingStatus: json['onboarding_status']?.toString(),
      agentApproved: json['agent_approved'] is bool ? json['agent_approved'] as bool : null,
      agentType: json['agent_type']?.toString(),
      twoFaEnabled: json['two_fa_enabled'] == true,
      wallet: json['wallet'] as num?,
      theme: json['theme']?.toString(),
      highContrast: json['high_contrast'] is bool ? json['high_contrast'] as bool : null,
      fontScale: (json['font_scale'] as num?)?.toDouble(),
      raw: Map<String, dynamic>.from(json),
    );
  }

  Map<String, dynamic> toJson() => Map<String, dynamic>.from(raw);

  @override
  List<Object?> get props => [id, email, role, name];
}
