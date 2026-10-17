using System.Net;
using System.Text;
using System.Text.Json;
using MisarSEO;
using Xunit;

namespace MisarSEO.Tests;

/// <summary>Records each request and serves canned replies — never the real API.</summary>
public sealed class StubHandler : HttpMessageHandler
{
    public sealed record Reply(int Status, string Body, Dictionary<string, string>? Headers = null);
    public sealed record Call(HttpRequestMessage Request, string? Body);

    private readonly Reply[] _replies;
    public List<Call> Calls { get; } = new();

    public StubHandler(params Reply[] replies) =>
        _replies = replies.Length == 0 ? new[] { new Reply(200, "{\"ok\":true}") } : replies;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content == null ? null : await request.Content.ReadAsStringAsync(ct);
        Calls.Add(new Call(request, body));
        var reply = _replies[Math.Min(Calls.Count - 1, _replies.Length - 1)];
        var resp = new HttpResponseMessage((HttpStatusCode)reply.Status) { Content = new StringContent(reply.Body, Encoding.UTF8) };
        foreach (var (k, v) in reply.Headers ?? new()) resp.Headers.TryAddWithoutValidation(k, v);
        return resp;
    }

    public Dictionary<string, string> Query(int i = 0) =>
        (Calls[i].Request.RequestUri!.Query.TrimStart('?')).Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Split('=', 2)).ToDictionary(p => Uri.UnescapeDataString(p[0]), p => Uri.UnescapeDataString(p.Length > 1 ? p[1] : ""));
}

public class MisarSeoClientTests
{
    private static MisarSeoClient Client(StubHandler stub) => new("mseo_test", new MisarSeoClientOptions
    {
        BaseUrl = "https://stub.test/seo",
        RetryBaseDelay = TimeSpan.FromMilliseconds(1),
        MaxRetryDelay = TimeSpan.FromMilliseconds(50),
    }, new HttpClient(stub));

    private static string Header(HttpRequestMessage r, string name) =>
        r.Headers.TryGetValues(name, out var v) ? v.First() : r.Content?.Headers.TryGetValues(name, out var c) == true ? c.First() : "";

    public static IEnumerable<object[]> ManifestMethods()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "../../../../manifest.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        foreach (var resource in doc.RootElement.GetProperty("resources").EnumerateObject())
            foreach (var method in resource.Value.GetProperty("methods").EnumerateArray())
                yield return new object[] { resource.Name, method.GetRawText() };
    }

    [Fact]
    public void ManifestIsComplete() => Assert.True(ManifestMethods().Count() > 200);

    [Theory]
    [MemberData(nameof(ManifestMethods))]
    public async Task EveryManifestMethodHitsItsRoute(string resource, string methodJson)
    {
        var method = JsonDocument.Parse(methodJson).RootElement;
        var name = method.GetProperty("name").GetString()!;
        var pathParams = method.GetProperty("pathParams").EnumerateArray().Select(e => e.GetString()!).ToList();
        var required = method.GetProperty("requiredQuery").EnumerateArray().Select(e => e.GetString()!).ToList();
        var hasBody = method.GetProperty("hasBody").GetBoolean();
        var stub = new StubHandler();
        Assert.True(GeneratedDispatch.Table.TryGetValue($"{resource}.{name}", out var entry), $"{resource}.{name} not dispatchable");
        var args = Enumerable.Range(0, pathParams.Count + required.Count).Select(i => $"v/{i}").ToArray();
        Assert.Equal(args.Length, entry.Arity);
        var result = await entry.Call(Client(stub), args, hasBody ? new { x = 1 } : null);
        Assert.True(result.GetProperty("ok").GetBoolean());

        var call = stub.Calls[0];
        Assert.Equal(method.GetProperty("verb").GetString(), call.Request.Method.Method);
        var want = method.GetProperty("path").GetString()!;
        for (var i = 0; i < pathParams.Count; i++) want = want.Replace($":{pathParams[i]}", $"v%2F{i}");
        Assert.Equal("/seo" + want, call.Request.RequestUri!.AbsolutePath);
        var query = stub.Query();
        for (var j = 0; j < required.Count; j++) Assert.Equal($"v/{pathParams.Count + j}", query[required[j]]);
        Assert.Equal(hasBody, call.Body != null);
        Assert.Equal("Bearer mseo_test", Header(call.Request, "Authorization"));
        Assert.StartsWith("misarseo-csharp/", Header(call.Request, "User-Agent"));
    }

    [Fact]
    public async Task RateLimitRetriedThenSucceeds()
    {
        var stub = new StubHandler(new StubHandler.Reply(429, "{\"error\":\"slow\",\"code\":\"RATE_LIMITED\"}"), new StubHandler.Reply(200, "{\"projects\":[]}"));
        var result = await Client(stub).Projects.ListAsync();
        Assert.Equal(JsonValueKind.Array, result.GetProperty("projects").ValueKind);
        Assert.Equal(2, stub.Calls.Count);
    }

    [Fact]
    public async Task PlanLimitIsNotRetriedAndCarriesTheOffer()
    {
        var stub = new StubHandler(new StubHandler.Reply(429,
            "{\"error\":\"Limit reached.\",\"code\":\"plan_limit_exceeded\",\"upgrade\":{\"reason\":\"quota_exhausted\",\"feature\":\"keyword_lookups\",\"current_plan\":{\"slug\":\"free\"},\"urls\":{\"pricing\":\"https://seo.misar.io/subscribe\"}}}",
            new() { ["Retry-After"] = "3600", ["X-Misar-Plan"] = "free", ["X-Misar-Upgrade-Url"] = "https://seo.misar.io/subscribe?plan=pro" }));
        var e = await Assert.ThrowsAsync<MisarSeoPlanLimitException>(() => Client(stub).Keywords.ResearchAsync(new { projectId = "p" }));
        Assert.Single(stub.Calls);
        Assert.Equal(429, e.Status);
        Assert.Equal("plan_limit_exceeded", e.Code);
        Assert.Equal("quota_exhausted", e.Reason);
        Assert.Equal("keyword_lookups", e.Feature);
        Assert.Equal("free", e.Plan);
        Assert.Equal("https://seo.misar.io/subscribe?plan=pro", e.UpgradeUrl);
        Assert.Equal(3600, e.RetryAfter);
        Assert.NotNull(e.Offer);
        Assert.False(e.IsRateLimited);
    }

    [Fact]
    public async Task PlanLimit402FallsBackToTheBody()
    {
        var stub = new StubHandler(new StubHandler.Reply(402, "{\"error\":\"Locked.\",\"code\":\"plan_limit_exceeded\",\"upgrade\":{\"reason\":\"feature_locked\",\"current_plan\":{\"slug\":\"free\"},\"urls\":{\"pricing\":\"https://seo.misar.io/subscribe\"}}}"));
        var e = await Assert.ThrowsAsync<MisarSeoPlanLimitException>(() => Client(stub).Backlinks.OverviewAsync("p1", "example.com"));
        Assert.Equal("free", e.Plan);
        Assert.Equal("https://seo.misar.io/subscribe", e.UpgradeUrl);
    }

    [Fact]
    public async Task NotFoundKeepsTheCode()
    {
        var stub = new StubHandler(new StubHandler.Reply(404, "{\"error\":\"Project not found\",\"code\":\"NOT_FOUND\"}"));
        var e = await Assert.ThrowsAsync<MisarSeoException>(() => Client(stub).Projects.GetAsync("nope"));
        Assert.True(e.IsNotFound);
        Assert.Equal("NOT_FOUND", e.Code);
    }

    [Fact]
    public async Task Post503NotRetriedGet503Retried()
    {
        var stub = new StubHandler(new StubHandler.Reply(503, "{\"error\":\"down\"}"));
        await Assert.ThrowsAsync<MisarSeoException>(() => Client(stub).Crawl.StartAsync(new { }));
        Assert.Single(stub.Calls);
        stub = new StubHandler(new StubHandler.Reply(503, "{}"), new StubHandler.Reply(200, "{}"));
        await Client(stub).Projects.ListAsync();
        Assert.Equal(2, stub.Calls.Count);
    }

    [Fact]
    public async Task Pagination_()
    {
        JsonElement J(string s) => JsonDocument.Parse(s).RootElement;
        var pages = new Dictionary<int, string> { [1] = "{\"rows\":[1,2],\"hasMore\":true}", [2] = "{\"rows\":[3],\"hasMore\":true}", [3] = "{\"rows\":[],\"hasMore\":true}" };
        var rows = new List<JsonElement>();
        await foreach (var r in MisarSEO.Pagination.OffsetRowsAsync(p => Task.FromResult(J(pages[p])))) rows.Add(r);
        Assert.Equal(3, rows.Count);
        var cursors = new Dictionary<string, string> { [""] = "{\"rows\":[\"a\"],\"hasMore\":true,\"nextCursor\":\"c1\"}", ["c1"] = "{\"rows\":[\"b\"],\"hasMore\":true,\"nextCursor\":\"c1\"}" };
        rows.Clear();
        await foreach (var r in MisarSEO.Pagination.CursorRowsAsync(c => Task.FromResult(J(cursors[c ?? ""])))) rows.Add(r);
        Assert.Equal(2, rows.Count);
    }

    [Fact]
    public async Task CrawlStreamReadsUntilComplete()
    {
        var body = ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n";
        var stub = new StubHandler(new StubHandler.Reply(200, body));
        var names = new List<string>();
        await foreach (var ev in Client(stub).Crawl.StreamEventsAsync("a1", "p1")) names.Add(ev.Event);
        Assert.Equal(new[] { "progress", "complete" }, names);
        Assert.Equal("text/event-stream", Header(stub.Calls[0].Request, "Accept"));
        Assert.Equal("p1", stub.Query()["projectId"]);
    }

    [Fact]
    public void MissingKeyFailsFast()
    {
        var old = Environment.GetEnvironmentVariable("MISARSEO_API_KEY");
        Environment.SetEnvironmentVariable("MISARSEO_API_KEY", null);
        try
        {
            var e = Assert.Throws<ArgumentException>(() => new MisarSeoClient(""));
            Assert.Contains("seo.misar.io", e.Message);
        }
        finally
        {
            Environment.SetEnvironmentVariable("MISARSEO_API_KEY", old);
        }
    }
}
