package io.misar.seo;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * The organization's plan does not cover the call: a feature its tier locks
 * (402), a spent day/month quota (429 with {@code Retry-After} at the
 * rollover) or a point-in-time cap such as projects (402).
 *
 * <p>Raised whenever the body carries {@code code: "plan_limit_exceeded"},
 * whatever the status, and never retried. Show {@link #getOffer()} — or at
 * least {@link #getUpgradeUrl()} — to the user.
 */
public class MisarSeoPlanLimitException extends MisarSeoException {
    /** The {@code code} every Misar product sends on a plan-limit rejection. */
    public static final String PLAN_LIMIT_CODE = "plan_limit_exceeded";

    private final JsonNode offer;
    private final String plan;
    private final String upgradeUrl;

    public MisarSeoPlanLimitException(int status, String message, JsonNode body, Integer retryAfter,
                                      String planHeader, String upgradeUrlHeader) {
        super(status, PLAN_LIMIT_CODE, message, body, retryAfter);
        JsonNode upgrade = body == null ? null : body.get("upgrade");
        this.offer = upgrade != null && upgrade.isObject() ? upgrade : null;
        this.plan = planHeader != null ? planHeader : text(offer, "current_plan", "slug");
        this.upgradeUrl = upgradeUrlHeader != null ? upgradeUrlHeader : text(offer, "urls", "pricing");
    }

    private static String text(JsonNode node, String... path) {
        JsonNode cur = node;
        for (String p : path) {
            if (cur == null) return null;
            cur = cur.get(p);
        }
        return cur == null || cur.isNull() ? null : cur.asText();
    }

    /** The server's {@code upgrade} object: plans, prices, URLs — all server-side copy. */
    public JsonNode getOffer() { return offer; }

    /** {@code quota_exhausted}, {@code feature_locked} … */
    public String getReason() { return text(offer, "reason"); }

    /** Machine key of the limit that was hit. */
    public String getFeature() { return text(offer, "feature"); }

    /** Current plan slug ({@code x-misar-plan}, else the offer). */
    public String getPlan() { return plan; }

    /** Where to upgrade ({@code x-misar-upgrade-url}, else the offer). */
    public String getUpgradeUrl() { return upgradeUrl; }
}
