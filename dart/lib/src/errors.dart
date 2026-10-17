/// The `code` every Misar product sends on a plan-limit rejection.
const planLimitCode = 'plan_limit_exceeded';

/// A non-2xx response, or (status 0) a request that never got one. [code] is
/// the API's own code — NOT_FOUND, VALIDATION_ERROR, RATE_LIMITED …
class MisarSeoException implements Exception {
  final int status;
  final String code;
  final String message;
  final Object? body;

  /// Seconds from `Retry-After`, when sent.
  final int? retryAfter;

  MisarSeoException(this.status, this.code, this.message, {this.body, this.retryAfter});

  bool get isNotFound => status == 404;
  bool get isUnauthorized => status == 401;

  /// An ordinary throttle — never true for a plan limit.
  bool get isRateLimited => status == 429 && this is! MisarSeoPlanLimitException;

  @override
  String toString() => status == 0 ? 'misarseo: $message' : 'misarseo: HTTP $status ($code): $message';
}

/// The organization's plan does not cover the call: a feature its tier locks
/// (402), a spent day/month quota (429 with `Retry-After` at the rollover) or a
/// point-in-time cap such as projects (402). Never retried — show [offer], or
/// at least [upgradeUrl], to the user.
class MisarSeoPlanLimitException extends MisarSeoException {
  /// The server's `upgrade` object: plans, prices, URLs — all server-side copy.
  final Map<String, dynamic>? offer;

  /// Current plan slug (`x-misar-plan`, else the offer).
  final String? plan;

  /// Where to upgrade (`x-misar-upgrade-url`, else the offer).
  final String? upgradeUrl;

  MisarSeoPlanLimitException._(int status, String message, Object? body, int? retryAfter, this.offer, this.plan,
      this.upgradeUrl)
      : super(status, planLimitCode, message, body: body, retryAfter: retryAfter);

  factory MisarSeoPlanLimitException(
      int status, String message, Object? body, int? retryAfter, String? planHeader, String? upgradeUrlHeader) {
    final upgrade = body is Map && body['upgrade'] is Map ? Map<String, dynamic>.from(body['upgrade'] as Map) : null;
    String? dig(List<String> path) {
      Object? cur = upgrade;
      for (final p in path) {
        cur = cur is Map ? cur[p] : null;
      }
      return cur is String ? cur : null;
    }

    return MisarSeoPlanLimitException._(status, message, body, retryAfter, upgrade,
        planHeader ?? dig(['current_plan', 'slug']), upgradeUrlHeader ?? dig(['urls', 'pricing']));
  }

  /// quota_exhausted, feature_locked …
  String? get reason => offer?['reason'] as String?;

  /// Machine key of the limit that was hit.
  String? get feature => offer?['feature'] as String?;
}
