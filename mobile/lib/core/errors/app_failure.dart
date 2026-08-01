class AppFailure implements Exception {
  AppFailure(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

String formatApiError(dynamic detail) {
  if (detail == null) return 'Something went wrong';
  if (detail is String) return detail;
  if (detail is List) {
    return detail.map((e) {
      if (e is Map && e['msg'] != null) return e['msg'].toString();
      return e.toString();
    }).join('\n');
  }
  if (detail is Map && detail['detail'] != null) {
    return formatApiError(detail['detail']);
  }
  return detail.toString();
}
