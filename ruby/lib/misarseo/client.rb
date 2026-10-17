# frozen_string_literal: true

module MisarSEO
  # MisarSEO API client. Every resource is a method named after it —
  # +client.projects+, +client.rank_tracking+, +client.ai_search+ …
  #
  #   client = MisarSEO::Client.new(api_key: ENV["MISARSEO_API_KEY"])
  #   client.projects.list
  class Client
    Generated::RESOURCES.each do |name, klass|
      define_method(name) { @resources[name] ||= klass.new(@transport) }
    end

    # +api_key+ falls back to MISARSEO_API_KEY. +adapter+ replaces Net::HTTP (tests).
    def initialize(api_key: nil, base_url: Transport::DEFAULT_BASE_URL, timeout: 30, max_retries: 2,
                   retry_base_delay: 0.25, max_retry_delay: 60, adapter: nil)
      key = api_key.to_s.empty? ? ENV["MISARSEO_API_KEY"].to_s : api_key
      if key.empty?
        raise ArgumentError, "A MisarSEO API key (mseo_...) is required: pass api_key: or set " \
                             "MISARSEO_API_KEY; see https://seo.misar.io/ai"
      end

      @transport = Transport.new(api_key: key, base_url: base_url, timeout: timeout, max_retries: max_retries,
                                 retry_base_delay: retry_base_delay, max_retry_delay: max_retry_delay,
                                 adapter: adapter)
      @resources = {}
    end
  end
end
