# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)
require "misarseo"
require "json"
require "uri"

# Stands in for Net::HTTP: records each request and serves canned replies.
class Recorder
  Call = Struct.new(:method, :url, :headers, :body)
  attr_reader :calls

  def initialize(*replies)
    @replies = replies.empty? ? [[200, {}, '{"ok":true}']] : replies
    @calls = []
  end

  def call(method, url, headers, body)
    @calls << Call.new(method, URI(url), headers, body)
    status, headers_out, raw = @replies[[@calls.size - 1, @replies.size - 1].min]
    return [status, headers_out, raw] unless block_given?

    yield status, headers_out, raw
  end

  def last_query
    URI.decode_www_form(@calls.first.url.query.to_s).to_h
  end
end

def client_with(recorder)
  MisarSEO::Client.new(api_key: "mseo_test", adapter: recorder, retry_base_delay: 0.001, max_retry_delay: 0.05)
end
