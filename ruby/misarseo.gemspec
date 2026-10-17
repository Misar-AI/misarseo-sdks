# frozen_string_literal: true

require_relative "lib/misarseo/version"

Gem::Specification.new do |spec|
  spec.name          = "misarseo"
  spec.version       = MisarSEO::VERSION
  spec.authors       = ["Misar.AI"]
  spec.email         = ["noreply@misar.io"]
  spec.summary       = "Ruby client for MisarSEO: keyword research, site audits, rank tracking, backlinks and AI search visibility"
  spec.description   = "Ruby client for the MisarSEO API (seo.misar.io): keyword research, site audits, " \
                       "rank tracking, backlinks, AI search visibility, Search Console, GA4 and " \
                       "Business Profile — 221 methods on one client, retries with backoff, typed " \
                       "plan-limit errors carrying the upgrade offer, and SSE crawl progress. " \
                       "No runtime dependencies beyond the stdlib."
  spec.homepage      = "https://seo.misar.io"
  spec.license       = "MIT"
  spec.required_ruby_version = ">= 2.6"

  spec.metadata = {
    "homepage_uri" => spec.homepage,
    "documentation_uri" => "https://docs.misar.io/seo",
    "source_code_uri" => "https://github.com/Misar-AI/misarseo-sdks/tree/main/ruby",
    "changelog_uri" => "https://github.com/Misar-AI/misarseo-sdks/blob/main/ruby/CHANGELOG.md",
    "bug_tracker_uri" => "https://github.com/Misar-AI/misarseo-sdks/issues"
  }

  spec.files = Dir["lib/**/*.rb", "README.md", "LICENSE", "CHANGELOG.md", "manifest.json"]
  spec.require_paths = ["lib"]
  spec.add_development_dependency "rspec", "~> 3.13"
end
