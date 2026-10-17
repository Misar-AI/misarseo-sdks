# frozen_string_literal: true

module MisarSEO
  # The +code+ every Misar product sends on a plan-limit rejection.
  PLAN_LIMIT_CODE = "plan_limit_exceeded"

  # A non-2xx response, or (status 0) a request that never got one. +code+ is
  # the API's own code — NOT_FOUND, VALIDATION_ERROR, RATE_LIMITED …
  class Error < StandardError
    attr_reader :status, :code, :body, :retry_after

    def initialize(status, code, message, body = nil, retry_after = nil)
      @status = status
      @code = code
      @body = body
      @retry_after = retry_after
      super(status.zero? ? "misarseo: #{message}" : "misarseo: HTTP #{status} (#{code}): #{message}")
    end

    def not_found?
      status == 404
    end

    def unauthorized?
      status == 401
    end

    # An ordinary throttle — never true for a plan limit.
    def rate_limited?
      status == 429 && !is_a?(PlanLimitError)
    end
  end

  class ValidationError < Error; end
  class AuthenticationError < Error; end
  class PaymentRequiredError < Error; end
  class PermissionError < Error; end
  class NotFoundError < Error; end
  class RateLimitError < Error; end
  class UpstreamError < Error; end
  class NetworkError < Error; end

  # The organization's plan does not cover the call: a feature its tier locks
  # (402), a spent day/month quota (429 with Retry-After at the rollover) or a
  # point-in-time cap such as projects (402). Never retried — show +offer+, or
  # at least +upgrade_url+, to the user.
  class PlanLimitError < Error
    # The server's +upgrade+ Hash: plans, prices, URLs — all server-side copy.
    attr_reader :offer
    # Current plan slug (x-misar-plan, else the offer).
    attr_reader :plan
    # Where to upgrade (x-misar-upgrade-url, else the offer).
    attr_reader :upgrade_url

    def initialize(status, message, body, retry_after, plan_header, upgrade_url_header)
      upgrade = body.is_a?(Hash) ? body["upgrade"] : nil
      @offer = upgrade.is_a?(Hash) ? upgrade : nil
      @plan = plan_header || dig(@offer, "current_plan", "slug")
      @upgrade_url = upgrade_url_header || dig(@offer, "urls", "pricing")
      super(status, PLAN_LIMIT_CODE, message, body, retry_after)
    end

    # quota_exhausted, feature_locked …
    def reason
      dig(@offer, "reason")
    end

    # Machine key of the limit that was hit.
    def feature
      dig(@offer, "feature")
    end

    private

    def dig(hash, *path)
      path.reduce(hash) { |cur, key| cur.is_a?(Hash) ? cur[key] : nil }
    end
  end

  STATUS_ERRORS = {
    400 => ValidationError, 401 => AuthenticationError, 402 => PaymentRequiredError,
    403 => PermissionError, 404 => NotFoundError, 429 => RateLimitError,
    502 => UpstreamError, 503 => UpstreamError, 504 => UpstreamError
  }.freeze

  # The error for a non-2xx response. The plan-limit code is checked BEFORE the
  # status: a spent quota is a 429 that otherwise looks like an ordinary throttle.
  def self.error_from(status, headers, body)
    data = body.is_a?(Hash) ? body : {}
    message = (data["error"] || data["message"] || "HTTP #{status}").to_s
    code = (data["code"] || "API_ERROR").to_s
    h = headers.each_with_object({}) { |(k, v), acc| acc[k.to_s.downcase] = v.is_a?(Array) ? v.first : v }
    retry_after = h["retry-after"].to_s.strip =~ /\A\d+\z/ ? h["retry-after"].to_i : nil
    if code == PLAN_LIMIT_CODE
      return PlanLimitError.new(status, message, body, retry_after, h["x-misar-plan"], h["x-misar-upgrade-url"])
    end

    STATUS_ERRORS.fetch(status, Error).new(status, code, message, body, retry_after)
  end
end
