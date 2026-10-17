# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

module MisarSEO
  # One Server-Sent Events frame.
  Event = Struct.new(:event, :data)

  # Request plumbing the generated resources are written against.
  #
  # Retry policy, identical in every MisarSEO SDK: 429 is retried for every
  # verb unless the body says plan_limit_exceeded; 502/503/504 and network
  # failures are retried for GET only (a POST may have started a billed
  # crawl); backoff starts at 250 ms with jitter and honours Retry-After up to
  # the configured cap.
  #
  # +adapter+ is anything responding to
  # +call(method, url, headers, body) -> [status, headers, body_string]+;
  # the default is Net::HTTP. Tests inject a recorder.
  class Transport
    DEFAULT_BASE_URL = "https://api.misar.io/seo"

    def self.seg(value)
      URI.encode_www_form_component(value.to_s).gsub("+", "%20")
    end

    # The JSON body of a call. Ruby 3 binds a brace-less trailing hash
    # (+create("name" => "x")+) to keyword arguments, not to the positional
    # +body+, so every body method also takes +**fields+ and they land here.
    # Both spellings, and +create(name: "x")+, therefore send the same body.
    def self.body(body, fields)
      return body if fields.empty?
      unless body.nil? || body.is_a?(Hash)
        raise ArgumentError, "pass the request body as one Hash or as keyword fields, not both"
      end

      (body || {}).transform_keys(&:to_s).merge(fields.transform_keys(&:to_s))
    end

    # Required query parameters first; an explicit key in +query+ wins.
    def self.merge(query, required)
      required.merge((query || {}).transform_keys(&:to_s))
    end

    def initialize(api_key:, base_url: DEFAULT_BASE_URL, timeout: 30, max_retries: 2,
                   retry_base_delay: 0.25, max_retry_delay: 60, adapter: nil)
      @api_key = api_key
      @base_url = base_url.sub(%r{/+\z}, "")
      @timeout = timeout
      @max_retries = max_retries
      @retry_base_delay = retry_base_delay
      @max_retry_delay = max_retry_delay
      @adapter = adapter || method(:net_http)
    end

    def headers(accept = "application/json")
      {
        "Authorization" => "Bearer #{@api_key}",
        "Content-Type" => "application/json",
        "Accept" => accept,
        "User-Agent" => "misarseo-ruby/#{VERSION}"
      }
    end

    def url(path, query)
      q = (query || {}).reject { |_, v| v.nil? }
      return "#{@base_url}#{path}" if q.empty?

      "#{@base_url}#{path}?" + q.map { |k, v| "#{Transport.seg(k)}=#{Transport.seg(v)}" }.join("&")
    end

    def request(method, path, query: nil, body: nil)
      target = url(path, query)
      payload = body.nil? ? nil : JSON.generate(body)
      attempt = 0
      loop do
        begin
          status, resp_headers, raw = @adapter.call(method, target, headers, payload)
        rescue StandardError => e
          raise NetworkError.new(0, "NETWORK_ERROR", "could not reach the MisarSEO API: #{e.message}") \
            unless method == "GET" && attempt < @max_retries

          sleep(backoff(attempt, nil))
          attempt += 1
          next
        end
        return decode(raw) if status.between?(200, 299)

        error = MisarSEO.error_from(status, resp_headers, decode(raw))
        retryable = status == 429 || (method == "GET" && [502, 503, 504].include?(status))
        raise error if error.is_a?(PlanLimitError) || !retryable || attempt >= @max_retries

        wait = backoff(attempt, error.retry_after)
        raise error if wait.nil?

        sleep(wait)
        attempt += 1
      end
    end

    # GET a text/event-stream endpoint, yielding Event frames until a terminal one.
    def stream(path, query: nil, terminal: %w[complete error])
      buffer = +""
      done = false
      @adapter.call("GET", url(path, query), headers("text/event-stream"), nil) do |status, resp_headers, chunk|
        next if done

        unless status.between?(200, 299)
          raise MisarSEO.error_from(status, resp_headers, decode(chunk))
        end

        buffer << chunk.to_s.delete("\r")
        while (idx = buffer.index("\n\n"))
          frame = buffer.slice!(0, idx + 2)
          event = Transport.parse_frame(frame)
          next unless event

          yield event
          if terminal.include?(event.event)
            done = true
            break
          end
        end
      end
      event = Transport.parse_frame(buffer) unless done
      yield event if event
      nil
    end

    # Decode one SSE frame; nil for keep-alive comments and frames without an event line.
    def self.parse_frame(frame)
      name = nil
      data = []
      frame.to_s.split("\n").each do |line|
        next if line.empty? || line.start_with?(":")

        if line.start_with?("event:")
          name = line[6..-1].strip
        elsif line.start_with?("data:")
          data << line[5..-1].sub(/\A +/, "")
        end
      end
      return nil unless name

      text = data.join("\n")
      value = begin
        text.empty? ? text : JSON.parse(text)
      rescue JSON::ParserError
        text
      end
      Event.new(name, value)
    end

    private

    def decode(text)
      return nil if text.nil? || text.strip.empty?

      JSON.parse(text)
    rescue JSON::ParserError
      text
    end

    def backoff(attempt, retry_after)
      return (retry_after > @max_retry_delay ? nil : retry_after) if retry_after

      base = @retry_base_delay * (2**attempt)
      [@max_retry_delay, base / 2.0 + rand * base / 2.0].min
    end

    def net_http(method, target, headers, payload, &block)
      uri = URI(target)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = @timeout
      http.read_timeout = block ? nil : @timeout
      klass = Net::HTTP.const_get(method.capitalize)
      req = klass.new(uri.request_uri, headers)
      req.body = payload if payload
      if block
        http.request(req) do |resp|
          resp.read_body { |chunk| block.call(resp.code.to_i, resp.to_hash, chunk) }
        end
        return
      end
      resp = http.request(req)
      [resp.code.to_i, resp.to_hash, resp.body]
    end
  end
end
