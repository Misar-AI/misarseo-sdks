namespace MisarSEO;

/// <summary>
/// MisarSEO API client. Every resource is a property — <c>client.Projects</c>,
/// <c>client.RankTracking</c>, <c>client.AiSearch</c> … — with <c>…Async</c> methods.
/// </summary>
/// <example><code>
/// var client = new MisarSeoClient(Environment.GetEnvironmentVariable("MISARSEO_API_KEY"));
/// var projects = await client.Projects.ListAsync();
/// </code></example>
public sealed partial class MisarSeoClient
{
    public const string Version = "1.0.0";
    public const string DefaultBaseUrl = "https://api.misar.io/seo";

    /// <param name="apiKey">A <c>mseo_</c> key; null/empty falls back to MISARSEO_API_KEY.</param>
    /// <param name="options">Optional configuration.</param>
    /// <param name="httpClient">Inject an <see cref="HttpClient"/> (handlers, proxies, tests).</param>
    public MisarSeoClient(string? apiKey = null, MisarSeoClientOptions? options = null, HttpClient? httpClient = null)
    {
        var key = string.IsNullOrEmpty(apiKey) ? Environment.GetEnvironmentVariable("MISARSEO_API_KEY") : apiKey;
        if (string.IsNullOrEmpty(key))
        {
            throw new ArgumentException("A MisarSEO API key (mseo_...) is required: pass it or set MISARSEO_API_KEY; see https://seo.misar.io/ai");
        }
        InitResources(new Transport(key, options ?? new MisarSeoClientOptions(), httpClient));
    }
}

/// <summary>Client configuration.</summary>
public sealed class MisarSeoClientOptions
{
    public string BaseUrl { get; set; } = MisarSeoClient.DefaultBaseUrl;
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);
    /// <summary>Extra attempts for retryable failures.</summary>
    public int MaxRetries { get; set; } = 2;
    /// <summary>First backoff step; doubles per attempt, with jitter.</summary>
    public TimeSpan RetryBaseDelay { get; set; } = TimeSpan.FromMilliseconds(250);
    /// <summary>Cap on any single wait, including a server-sent <c>Retry-After</c>.</summary>
    public TimeSpan MaxRetryDelay { get; set; } = TimeSpan.FromSeconds(60);
}

/// <summary>One Server-Sent Events frame: its <c>event:</c> name and JSON-decoded <c>data:</c>.</summary>
public sealed record SseEvent(string Event, System.Text.Json.JsonElement Data);
