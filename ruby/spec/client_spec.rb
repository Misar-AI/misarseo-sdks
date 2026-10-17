# frozen_string_literal: true

require_relative "spec_helper"

MANIFEST = JSON.parse(File.read(File.expand_path("../manifest.json", __dir__)))

def snake(name)
  name.gsub(/([a-z0-9])([A-Z])/, '\1_\2').downcase
end

RSpec.describe MisarSEO::Client do
  describe "manifest coverage" do
    cases = MANIFEST["resources"].flat_map { |resource, d| d["methods"].map { |m| [resource, m] } }

    it("has the whole surface") { expect(cases.size).to be > 200 }

    cases.each do |resource, method|
      it "#{resource}.#{method['name']} hits its route" do
        rec = Recorder.new
        target = client_with(rec).public_send(snake(resource))
        name = snake(method["name"])
        name = "#{name}_" unless target.respond_to?(name)
        positional = method["pathParams"] + method["requiredQuery"]
        args = positional.each_index.map { |i| "v/#{i}" }
        args << { "x" => 1 } if method["hasBody"]
        expect(target.public_send(name, *args)).to eq("ok" => true)

        call = rec.calls.first
        expect(call.method).to eq(method["verb"])
        want = method["path"].dup
        method["pathParams"].each_with_index { |p, i| want.sub!(":#{p}", "v%2F#{i}") }
        expect(call.url.path).to eq("/seo#{want}")
        method["requiredQuery"].each_with_index do |q, j|
          expect(rec.last_query[q]).to eq("v/#{method['pathParams'].size + j}")
        end
        expect(!call.body.nil?).to eq(method["hasBody"])
        expect(call.headers["Authorization"]).to eq("Bearer mseo_test")
        expect(call.headers["User-Agent"]).to start_with("misarseo-ruby/")
      end
    end
  end

  # Ruby 3 binds a brace-less trailing hash to keywords rather than to the
  # positional body. The README's own examples are written brace-less, so all
  # three spellings must send the same JSON body, with query: still separate.
  it "sends the same body however the hash is spelled" do
    rec = Recorder.new
    keywords = client_with(rec).keywords
    keywords.research("projectId" => "p", "keywords" => ["seo"])
    keywords.research({ "projectId" => "p", "keywords" => ["seo"] })
    keywords.research(projectId: "p", keywords: ["seo"])
    keywords.research({ "projectId" => "p" }, "keywords" => ["seo"], query: { "dry" => "1" })
    bodies = rec.calls.map { |c| JSON.parse(c.body) }
    expect(bodies.uniq).to eq([{ "projectId" => "p", "keywords" => ["seo"] }])
    expect(rec.calls.last.url.query).to eq("dry=1")
  end

  it "retries an ordinary 429, then succeeds" do
    rec = Recorder.new([429, {}, '{"error":"slow","code":"RATE_LIMITED"}'], [200, {}, '{"projects":[]}'])
    expect(client_with(rec).projects.list).to eq("projects" => [])
    expect(rec.calls.size).to eq(2)
  end

  it "does not retry a plan-limit 429 and surfaces the offer" do
    body = { error: "Limit reached.", code: "plan_limit_exceeded",
             upgrade: { reason: "quota_exhausted", feature: "keyword_lookups",
                        current_plan: { slug: "free" }, urls: { pricing: "https://seo.misar.io/subscribe" } } }
    rec = Recorder.new([429, { "retry-after" => ["3600"], "x-misar-plan" => ["free"],
                              "x-misar-upgrade-url" => ["https://seo.misar.io/subscribe?plan=pro"] }, JSON.generate(body)])
    expect { client_with(rec).keywords.research("projectId" => "p") }.to raise_error(MisarSEO::PlanLimitError) { |e|
      expect(e.status).to eq(429)
      expect(e.code).to eq("plan_limit_exceeded")
      expect(e.reason).to eq("quota_exhausted")
      expect(e.feature).to eq("keyword_lookups")
      expect(e.plan).to eq("free")
      expect(e.upgrade_url).to eq("https://seo.misar.io/subscribe?plan=pro")
      expect(e.retry_after).to eq(3600)
      expect(e.offer).to be_a(Hash)
      expect(e.rate_limited?).to be(false)
    }
    expect(rec.calls.size).to eq(1)
  end

  it "falls back to the body for a 402 plan limit" do
    body = { error: "Locked.", code: "plan_limit_exceeded",
             upgrade: { reason: "feature_locked", current_plan: { slug: "free" }, urls: { pricing: "https://seo.misar.io/subscribe" } } }
    rec = Recorder.new([402, {}, JSON.generate(body)])
    expect { client_with(rec).backlinks.overview("p1", "example.com") }.to raise_error(MisarSEO::PlanLimitError) { |e|
      expect(e.plan).to eq("free")
      expect(e.upgrade_url).to eq("https://seo.misar.io/subscribe")
    }
  end

  it "maps 404 to NotFoundError with the API code" do
    rec = Recorder.new([404, {}, '{"error":"Project not found","code":"NOT_FOUND"}'])
    expect { client_with(rec).projects.get("nope") }.to raise_error(MisarSEO::NotFoundError) { |e|
      expect(e.code).to eq("NOT_FOUND")
    }
  end

  it "does not retry a POST 503 but retries a GET 503" do
    rec = Recorder.new([503, {}, '{"error":"down"}'])
    expect { client_with(rec).crawl.start({}) }.to raise_error(MisarSEO::UpstreamError)
    expect(rec.calls.size).to eq(1)
    rec = Recorder.new([503, {}, "{}"], [200, {}, "{}"])
    client_with(rec).projects.list
    expect(rec.calls.size).to eq(2)
  end

  it "paginates offset and cursor pages" do
    pages = { 1 => { "rows" => [1, 2], "hasMore" => true }, 2 => { "rows" => [3], "hasMore" => true },
              3 => { "rows" => [], "hasMore" => true } }
    expect(MisarSEO::Pagination.collect_offset_pages { |p| pages[p] }).to eq([1, 2, 3])
    cursors = { nil => { "rows" => ["a"], "hasMore" => true, "nextCursor" => "c1" },
                "c1" => { "rows" => ["b"], "hasMore" => true, "nextCursor" => "c1" } }
    expect(MisarSEO::Pagination.collect_cursor_pages { |c| cursors[c] }).to eq(%w[a b])
  end

  it "streams crawl events until complete" do
    body = ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n"
    rec = Recorder.new([200, { "content-type" => ["text/event-stream"] }, body])
    names = client_with(rec).crawl.stream_events("a1", "p1").map(&:event)
    expect(names).to eq(%w[progress complete])
    expect(rec.calls.first.headers["Accept"]).to eq("text/event-stream")
    expect(rec.last_query["projectId"]).to eq("p1")
  end

  it "fails fast without a key" do
    old = ENV.delete("MISARSEO_API_KEY")
    expect { described_class.new }.to raise_error(ArgumentError, /seo\.misar\.io/)
    ENV["MISARSEO_API_KEY"] = old if old
  end
end
