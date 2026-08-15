import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';

/// Shared remote API facade used by feature repositories.
class Cr8Api {
  Cr8Api(this._client);
  final ApiClient _client;

  // ---- Marketplace ----
  Future<List<Map<String, dynamic>>> influencers({String? niche, String? q}) async {
    final res = await _client.get('/creators', query: {
      if (niche != null && niche.isNotEmpty) 'niche': niche,
      if (q != null && q.isNotEmpty) 'q': q,
    });
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> creators({String? niche, String? q}) =>
      influencers(niche: niche, q: q);

  Future<Map<String, dynamic>> creator(String id) async {
    final res = await _client.get('/creators/$id');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<Map<String, dynamic>>> campaigns({String? niche, String? q, bool mine = false}) async {
    final res = await _client.get('/campaigns', query: {
      if (niche != null && niche.isNotEmpty) 'niche': niche,
      if (q != null && q.isNotEmpty) 'q': q,
      if (mine) 'mine': 'true',
    });
    return _list(res.data);
  }

  Future<Map<String, dynamic>> campaign(String id) async {
    final res = await _client.get('/campaigns/$id');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> createCampaign(Map<String, dynamic> body) async {
    final res = await _client.post('/campaigns', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> apply(String campaignId, {required String pitch, required int rate}) async {
    await _client.post('/campaigns/$campaignId/apply', data: {'pitch': pitch, 'rate': rate});
  }

  Future<List<Map<String, dynamic>>> applications(String campaignId) async {
    final res = await _client.get('/campaigns/$campaignId/applications');
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> myApplications() async {
    final res = await _client.get('/applications/mine');
    return _list(res.data);
  }

  Future<void> acceptApplication(String id) async {
    await _client.post('/applications/$id/accept');
  }

  Future<void> fundEscrow(String campaignId) async {
    await _client.post('/campaigns/$campaignId/fund');
  }

  Future<void> releaseEscrow(String campaignId) async {
    await _client.post('/campaigns/$campaignId/release');
  }

  Future<Map<String, dynamic>> openConversation({
    required String campaignId,
    required String creatorId,
  }) async {
    final res = await _client.post(
      '/conversations/open',
      query: {'campaign_id': campaignId, 'creator_id': creatorId},
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> openDm(String userId) async {
    final res = await _client.post('/conversations/dm', data: {'user_id': userId});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<Map<String, dynamic>>> deliverables(String campaignId) async {
    final res = await _client.get('/campaigns/$campaignId/deliverables');
    return _list(res.data);
  }

  Future<void> submitDeliverable(Map<String, dynamic> body) async {
    await _client.post('/deliverables', data: body);
  }

  Future<void> reviewDeliverable(String id, {required String status, String? notes}) async {
    await _client.post('/deliverables/$id/review', data: {'status': status, 'notes': notes});
  }

  Future<void> invite(Map<String, dynamic> body) async {
    await _client.post('/invitations', data: body);
  }

  Future<List<Map<String, dynamic>>> myInvitations() async {
    final res = await _client.get('/invitations/mine');
    return _list(res.data);
  }

  Future<void> invitationAction(String id, String action, {int? counterOffer, String? note}) async {
    await _client.post('/invitations/$id/action/$action', data: {
      if (counterOffer != null) 'counter_offer': counterOffer,
      if (note != null) 'note': note,
    });
  }

  // ---- Analytics ----
  Future<Map<String, dynamic>> analyticsOwner() async {
    final res = await _client.get('/analytics/owner');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> analyticsCreator() async {
    final res = await _client.get('/analytics/creator');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> analyticsSocial() async {
    final res = await _client.get('/analytics/social');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> analyticsPlatform() async {
    final res = await _client.get('/analytics/platform');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<Map<String, dynamic>>> matchCreators() async {
    final res = await _client.get('/creators/match');
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> matchCampaigns() async {
    final res = await _client.get('/campaigns/match');
    return _list(res.data);
  }

  // ---- Feed / Social ----
  Future<Map<String, dynamic>> feed({String mode = 'latest', String? cursor, int limit = 20}) async {
    final res = await _client.get('/feed', query: {
      'mode': mode,
      'limit': limit,
      if (cursor != null) 'cursor': cursor,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> createPost(Map<String, dynamic> body) async {
    final res = await _client.post('/posts', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> likePost(String id) async => _client.post('/posts/$id/like');
  Future<void> savePost(String id) async => _client.post('/posts/$id/save');
  Future<void> bookmarkPost(String id) async => _client.post('/posts/$id/bookmark');
  Future<void> sharePost(String id) async => _client.post('/posts/$id/share');
  Future<void> repost(String id) async => _client.post('/posts/$id/repost');
  Future<void> quotePost(String id, String text) async =>
      _client.post('/posts/$id/quote', data: {'text': text});
  Future<void> pinPost(String id) async => _client.post('/posts/$id/pin');
  Future<void> deletePost(String id) async => _client.delete('/posts/$id');

  Future<List<Map<String, dynamic>>> comments(String postId) async {
    final res = await _client.get('/posts/$postId/comments');
    return _list(res.data);
  }

  Future<Map<String, dynamic>> addComment(String postId, String text, {String? parentId}) async {
    final res = await _client.post('/posts/$postId/comments', data: {
      'text': text,
      if (parentId != null) 'parent_id': parentId,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> deleteComment(String id) async => _client.delete('/comments/$id');

  Future<List<Map<String, dynamic>>> myPosts({String? status}) async {
    final res = await _client.get('/posts/mine', query: {
      if (status != null) 'status': status,
    });
    return _list(res.data);
  }

  Future<void> follow(String userId) async =>
      _client.post('/follow', data: {'user_id': userId});
  Future<void> unfollow(String userId) async =>
      _client.post('/unfollow', data: {'user_id': userId});

  Future<Map<String, dynamic>> publicProfile(String userId) async {
    final res = await _client.get('/users/$userId/public');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<Map<String, dynamic>>> followers(String userId) async {
    final res = await _client.get('/users/$userId/followers');
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> following(String userId) async {
    final res = await _client.get('/users/$userId/following');
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> suggestedUsers() async {
    final res = await _client.get('/users/suggested');
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> followRequests() async {
    final res = await _client.get('/follow/requests');
    return _list(res.data);
  }

  Future<void> acceptFollow(String followerId) async =>
      _client.post('/follow/requests/$followerId/accept');
  Future<void> rejectFollow(String followerId) async =>
      _client.post('/follow/requests/$followerId/reject');

  Future<void> block(String userId) async =>
      _client.post('/privacy/block', data: {'user_id': userId});
  Future<void> report({
    required String targetType,
    required String targetId,
    required String reason,
  }) async {
    await _client.post('/reports', data: {
      'target_type': targetType,
      'target_id': targetId,
      'reason': reason,
    });
  }

  // ---- Search ----
  Future<Map<String, dynamic>> search(String q, {String kind = 'all'}) async {
    final res = await _client.get('/search', query: {'q': q, 'kind': kind});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<Map<String, dynamic>>> recentSearches() async {
    final res = await _client.get('/search/recent');
    return _list(res.data);
  }

  Future<Map<String, dynamic>> trendingSearches() async {
    final res = await _client.get('/search/trending');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> clearRecentSearches() async => _client.delete('/search/recent');

  // ---- Messages ----
  Future<List<Map<String, dynamic>>> conversations() async {
    final res = await _client.get('/conversations');
    return _list(res.data);
  }

  Future<List<Map<String, dynamic>>> messages(String convoId) async {
    final res = await _client.get('/conversations/$convoId/messages');
    return _list(res.data);
  }

  Future<Map<String, dynamic>> sendMessage(
    String convoId, {
    String content = '',
    String? mediaUrl,
    String? mediaType,
  }) async {
    final res = await _client.post('/conversations/$convoId/messages', data: {
      'content': content,
      if (mediaUrl != null) 'media_url': mediaUrl,
      if (mediaType != null) 'media_type': mediaType,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> markRead(String convoId) async =>
      _client.post('/conversations/$convoId/read');
  Future<void> typing(String convoId, bool typing) async =>
      _client.post('/conversations/$convoId/typing', data: {'typing': typing});
  Future<void> pinConvo(String id) async => _client.post('/conversations/$id/pin');
  Future<void> archiveConvo(String id) async => _client.post('/conversations/$id/archive');

  Future<List<Map<String, dynamic>>> searchMessages(String q) async {
    final res = await _client.get('/messages/search', query: {'q': q});
    return _list(res.data);
  }

  // ---- Notifications ----
  Future<Map<String, dynamic>> notifications() async {
    final res = await _client.get('/notifications');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> readAllNotifications() async => _client.post('/notifications/read');

  // ---- Wallet ----
  Future<Map<String, dynamic>> wallet() async {
    final res = await _client.get('/wallet');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> deposit(int amount) async =>
      _client.post('/wallet/deposit', data: {'amount': amount});
  Future<void> withdraw(int amount) async =>
      _client.post('/wallet/withdraw', data: {'amount': amount});

  // ---- Settings / privacy ----
  Future<Map<String, dynamic>> settings() async {
    final res = await _client.get('/settings');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> patchSettings(Map<String, dynamic> body) async {
    final res = await _client.patch('/settings', data: body);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<Map<String, dynamic>>> sessions() async {
    final res = await _client.get('/auth/sessions');
    return _list(res.data);
  }

  Future<void> revokeSession(String id) async =>
      _client.post('/auth/sessions/revoke', data: {'session_id': id});

  Future<List<Map<String, dynamic>>> loginHistory() async {
    final res = await _client.get('/auth/login-history');
    return _list(res.data);
  }

  Future<Map<String, dynamic>> setup2fa() async {
    final res = await _client.post('/auth/2fa/setup');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> enable2fa(String code) async =>
      _client.post('/auth/2fa/enable', data: {'code': code});

  Future<void> disable2fa({required String password, required String code}) async =>
      _client.post('/auth/2fa/disable', data: {'password': password, 'code': code});

  Future<List<Map<String, dynamic>>> blocks() async {
    final res = await _client.get('/privacy/blocks');
    return _list(res.data);
  }

  Future<void> unblock(String userId) async =>
      _client.post('/privacy/unblock', data: {'user_id': userId});

  Future<Map<String, dynamic>> exportData() async {
    final res = await _client.get('/auth/export-data');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> deleteAccount() async => _client.post('/auth/delete-account');

  // ---- Admin ----
  Future<Map<String, dynamic>> adminStats() async {
    final res = await _client.get('/admin/dashboard-stats');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<Map<String, dynamic>>> adminUsers({String? q, String? role}) async {
    final res = await _client.get('/admin/users', query: {
      if (q != null) 'q': q,
      if (role != null) 'role': role,
    });
    return _list(res.data);
  }

  Future<void> banUser(String id, {String? reason}) async =>
      _client.post('/admin/users/$id/ban', data: {'reason': reason});

  Future<void> verifyUser(String id) async => _client.post('/admin/users/$id/verify');

  Future<List<Map<String, dynamic>>> adminReports() async {
    final res = await _client.get('/admin/reports');
    return _list(res.data);
  }

  Future<void> resolveReport(String id, String status) async =>
      _client.post('/admin/reports/$id', data: {'status': status});

  Future<void> broadcast({required String text, String? role}) async =>
      _client.post('/admin/notifications/broadcast', data: {
        'text': text,
        if (role != null && role.isNotEmpty) 'role': role,
      });

  Future<void> approveAgent(String id) async =>
      _client.post('/admin/approve-agent/$id');
  Future<void> declineAgent(String id, {String? reason}) async =>
      _client.post('/admin/decline-agent/$id', data: {'reason': reason});

  // ---- Media / AI / location ----
  Future<Map<String, dynamic>> uploadMedia(String filePath, String filename) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: filename),
    });
    final res = await _client.upload('/media/upload', form);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> pincode(String pin) async {
    final res = await _client.get('/location/pincode/$pin');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> checkAvailability({String? email, String? mobile, String? username}) async {
    final res = await _client.post('/auth/check', data: {
      if (email != null) 'email': email,
      if (mobile != null) 'mobile': mobile,
      if (username != null) 'username': username,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> sendRegisterOtp({required String email, required String mobile}) async {
    await _client.post('/auth/register/send-otp', data: {'email': email, 'mobile': mobile});
  }

  Future<Map<String, dynamic>> aiCaption(String context) async {
    final res = await _client.post('/ai/caption', data: {'context': context});
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> aiHashtags(String text) async {
    final res = await _client.post('/ai/hashtags', data: {'text': text});
    return Map<String, dynamic>.from(res.data as Map);
  }

  List<Map<String, dynamic>> _list(dynamic data) {
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }
}

final cr8ApiProvider = Provider<Cr8Api>((ref) {
  return Cr8Api(ref.watch(apiClientProvider));
});
