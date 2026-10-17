using System.Text.Json;

namespace MisarSEO;

/// <summary>
/// A non-2xx response, or (status 0) a request that never got one. <see cref="Code"/> is the
/// API's own code — NOT_FOUND, VALIDATION_ERROR, RATE_LIMITED … A plan refusal is the subclass
/// <see cref="MisarSeoPlanLimitException"/>.
/// </summary>
public class MisarSeoException : Exception
{
    public int Status { get; }
    public string Code { get; }
    public JsonElement? Body { get; }
    /// <summary>Seconds from <c>Retry-After</c>, when sent.</summary>
    public int? RetryAfter { get; }

    public MisarSeoException(int status, string code, string message, JsonElement? body = null, int? retryAfter = null)
        : base(status == 0 ? $"misarseo: {message}" : $"misarseo: HTTP {status} ({code}): {message}")
    {
        Status = status;
        Code = code;
        Body = body;
        RetryAfter = retryAfter;
    }

    public bool IsNotFound => Status == 404;
    public bool IsUnauthorized => Status == 401;
    /// <summary>An ordinary throttle — never true for a plan limit.</summary>
    public bool IsRateLimited => Status == 429 && this is not MisarSeoPlanLimitException;
}

/// <summary>
/// The organization's plan does not cover the call: a feature its tier locks (402), a spent
/// day/month quota (429 with <c>Retry-After</c> at the rollover) or a point-in-time cap such as
/// projects (402). Never retried — show <see cref="Offer"/>, or at least <see cref="UpgradeUrl"/>,
/// to the user.
/// </summary>
public sealed class MisarSeoPlanLimitException : MisarSeoException
{
    /// <summary>The <c>code</c> every Misar product sends on a plan-limit rejection.</summary>
    public const string PlanLimitCode = "plan_limit_exceeded";

    /// <summary>The server's <c>upgrade</c> object: plans, prices, URLs — all server-side copy.</summary>
    public JsonElement? Offer { get; }
    /// <summary>Current plan slug (<c>x-misar-plan</c>, else the offer).</summary>
    public string? Plan { get; }
    /// <summary>Where to upgrade (<c>x-misar-upgrade-url</c>, else the offer).</summary>
    public string? UpgradeUrl { get; }
    /// <summary>quota_exhausted, feature_locked …</summary>
    public string? Reason => Text(Offer, "reason");
    /// <summary>Machine key of the limit that was hit.</summary>
    public string? Feature => Text(Offer, "feature");

    public MisarSeoPlanLimitException(int status, string message, JsonElement? body, int? retryAfter, string? planHeader, string? upgradeUrlHeader)
        : base(status, PlanLimitCode, message, body, retryAfter)
    {
        if (body is { ValueKind: JsonValueKind.Object } b && b.TryGetProperty("upgrade", out var upgrade) && upgrade.ValueKind == JsonValueKind.Object)
        {
            Offer = upgrade;
        }
        Plan = planHeader ?? Text(Offer, "current_plan", "slug");
        UpgradeUrl = upgradeUrlHeader ?? Text(Offer, "urls", "pricing");
    }

    private static string? Text(JsonElement? node, params string[] path)
    {
        if (node is not { } cur) return null;
        foreach (var p in path)
        {
            if (cur.ValueKind != JsonValueKind.Object || !cur.TryGetProperty(p, out cur)) return null;
        }
        return cur.ValueKind == JsonValueKind.String ? cur.GetString() : null;
    }
}
