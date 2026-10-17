using System.Net;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace MisarSEO;

/// <summary>
/// Request plumbing the generated resources are written against.
/// Retry policy, identical in every MisarSEO SDK: 429 is retried for every verb unless the body
/// says <c>plan_limit_exceeded</c>; 502/503/504 and network failures are retried for GET only (a
/// POST may have started a billed crawl); backoff starts at 250 ms with jitter and honours
/// <c>Retry-After</c> up to the configured cap.
/// </summary>
public sealed class Transport
{
    private readonly string _apiKey;
    private readonly string _baseUrl;
    private readonly MisarSeoClientOptions _options;
    private readonly HttpClient _http;

    internal Transport(string apiKey, MisarSeoClientOptions options, HttpClient? http)
    {
        _apiKey = apiKey;
        _options = options;
        _baseUrl = options.BaseUrl.TrimEnd('/');
        _http = http ?? new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
    }

    /// <summary>Encode one path segment.</summary>
    public static string Seg(string value) => Uri.EscapeDataString(value);

    /// <summary>Required query parameters first; an explicit key in <paramref name="query"/> wins.</summary>
    public static IDictionary<string, string> Merge(IDictionary<string, string>? query, params (string Key, string Value)[] required)
    {
        var merged = new Dictionary<string, string>();
        foreach (var (k, v) in required) merged[k] = v;
        if (query != null) foreach (var kv in query) merged[kv.Key] = kv.Value;
        return merged;
    }

    private string Url(string path, IDictionary<string, string>? query)
    {
        if (query == null || query.Count == 0) return _baseUrl + path;
        return _baseUrl + path + "?" + string.Join("&", query.Select(kv => $"{Seg(kv.Key)}={Seg(kv.Value)}"));
    }

    private HttpRequestMessage Build(string method, string url, string? payload, string accept)
    {
        var req = new HttpRequestMessage(new HttpMethod(method), url);
        req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_apiKey}");
        req.Headers.TryAddWithoutValidation("Accept", accept);
        req.Headers.TryAddWithoutValidation("User-Agent", $"misarseo-csharp/{MisarSeoClient.Version}");
        if (payload != null) req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        return req;
    }

    private TimeSpan? Backoff(int attempt, int? retryAfter)
    {
        if (retryAfter is { } s)
        {
            var wait = TimeSpan.FromSeconds(s);
            return wait > _options.MaxRetryDelay ? null : wait;
        }
        var baseMs = _options.RetryBaseDelay.TotalMilliseconds * Math.Pow(2, attempt);
        var ms = baseMs / 2 + Random.Shared.NextDouble() * baseMs / 2;
        return TimeSpan.FromMilliseconds(Math.Min(ms, _options.MaxRetryDelay.TotalMilliseconds));
    }

    private static JsonElement Decode(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return default;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            return JsonSerializer.SerializeToElement(raw);
        }
    }

    private static string? Header(HttpResponseMessage resp, string name) =>
        resp.Headers.TryGetValues(name, out var v) ? v.FirstOrDefault()
        : resp.Content.Headers.TryGetValues(name, out var c) ? c.FirstOrDefault() : null;

    /// <summary>The exception for a non-2xx response; the plan-limit code is checked BEFORE the status.</summary>
    internal static MisarSeoException ErrorFrom(HttpResponseMessage resp, string raw)
    {
        var status = (int)resp.StatusCode;
        var body = Decode(raw);
        string? Prop(string n) => body.ValueKind == JsonValueKind.Object && body.TryGetProperty(n, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
        var message = Prop("error") ?? Prop("message") ?? $"HTTP {status}";
        var code = Prop("code") ?? "API_ERROR";
        int? retryAfter = int.TryParse(Header(resp, "Retry-After")?.Trim(), out var s) ? s : null;
        JsonElement? b = body.ValueKind == JsonValueKind.Undefined ? null : body;
        if (code == MisarSeoPlanLimitException.PlanLimitCode)
        {
            return new MisarSeoPlanLimitException(status, message, b, retryAfter, Header(resp, "x-misar-plan"), Header(resp, "x-misar-upgrade-url"));
        }
        return new MisarSeoException(status, code, message, b, retryAfter);
    }

    /// <summary>One request with the shared retry policy; the decoded JSON body (<c>default</c> when empty).</summary>
    public async Task<JsonElement> RequestAsync(string method, string path, IDictionary<string, string>? query, object? body, CancellationToken ct)
    {
        var url = Url(path, query);
        var payload = body == null ? null : JsonSerializer.Serialize(body);
        for (var attempt = 0; ; attempt++)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(_options.Timeout);
            HttpResponseMessage resp;
            try
            {
                resp = await _http.SendAsync(Build(method, url, payload, "application/json"), cts.Token).ConfigureAwait(false);
            }
            catch (Exception e) when (e is HttpRequestException || (e is TaskCanceledException && !ct.IsCancellationRequested))
            {
                if (method == "GET" && attempt < _options.MaxRetries)
                {
                    await Task.Delay(Backoff(attempt, null) ?? TimeSpan.Zero, ct).ConfigureAwait(false);
                    continue;
                }
                throw new MisarSeoException(0, "NETWORK_ERROR", $"could not reach the MisarSEO API: {e.Message}");
            }
            using (resp)
            {
                var raw = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                var status = (int)resp.StatusCode;
                if (status is >= 200 and < 300) return Decode(raw);
                var error = ErrorFrom(resp, raw);
                var retryable = status == 429 || (method == "GET" && status is 502 or 503 or 504);
                if (error is MisarSeoPlanLimitException || !retryable || attempt >= _options.MaxRetries) throw error;
                var wait = Backoff(attempt, error.RetryAfter) ?? throw error;
                await Task.Delay(wait, ct).ConfigureAwait(false);
            }
        }
    }

    /// <summary>Decode one SSE frame; null for keep-alive comments and frames without an event line.</summary>
    public static SseEvent? ParseFrame(string frame)
    {
        string? name = null;
        var data = new List<string>();
        foreach (var line in frame.Replace("\r\n", "\n").Split('\n'))
        {
            if (line.Length == 0 || line.StartsWith(':')) continue;
            if (line.StartsWith("event:")) name = line[6..].Trim();
            else if (line.StartsWith("data:")) data.Add(line[5..].TrimStart(' '));
        }
        if (name == null) return null;
        var raw = string.Join("\n", data);
        return new SseEvent(name, raw.Length == 0 ? JsonSerializer.SerializeToElement("") : Decode(raw));
    }

    /// <summary>GET a text/event-stream endpoint, yielding frames until a terminal event.</summary>
    public async IAsyncEnumerable<SseEvent> StreamAsync(string path, IDictionary<string, string>? query, string[] terminal,
        [EnumeratorCancellation] CancellationToken ct)
    {
        using var resp = await _http.SendAsync(Build("GET", Url(path, query), null, "text/event-stream"),
            HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
        if (!resp.IsSuccessStatusCode)
        {
            throw ErrorFrom(resp, await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false));
        }
        using var reader = new StreamReader(await resp.Content.ReadAsStreamAsync(ct).ConfigureAwait(false));
        var frame = new StringBuilder();
        while (await reader.ReadLineAsync(ct).ConfigureAwait(false) is { } line)
        {
            if (line.Length > 0)
            {
                frame.Append(line).Append('\n');
                continue;
            }
            var ev = ParseFrame(frame.ToString());
            frame.Clear();
            if (ev == null) continue;
            yield return ev;
            if (terminal.Contains(ev.Event)) yield break;
        }
        if (ParseFrame(frame.ToString()) is { } last) yield return last;
    }
}
