/**
 * The `misarseo` command line, as a function so it can be tested without a
 * process: `run(argv, io)` returns the exit code.
 *
 *   misarseo <resource> <command> [positional...] [--body JSON|@file]
 *            [--<queryParam> value ...] [--api-key mseo_...] [--base-url URL]
 *   misarseo list                       every resource and command
 *   misarseo help <resource> [command]  arguments for a command
 *
 * Every command comes from the generated table in src/generated, which is
 * emitted from sdks/manifest.json — the CLI covers the same 221 methods as
 * every SDK, plus the crawl SSE stream.
 *
 * Exit codes: 0 success · 1 API or network error · 2 usage error ·
 * 3 plan limit (the upgrade card is printed to stderr).
 */
import { readFileSync } from "node:fs";
import { COMMANDS } from "./generated/index.js";
import {
  ApiError,
  Client,
  DEFAULT_BASE_URL,
  PlanLimitError,
  VERSION,
} from "./http.js";
import type { CommandSpec } from "./spec.js";

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

const kebab = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function findCommand(
  resource: string,
  command: string,
): CommandSpec | undefined {
  const r = kebab(resource);
  const c = kebab(command);
  return COMMANDS.find(
    (spec) => kebab(spec.resource) === r && spec.command === c,
  );
}

function usage(spec: CommandSpec): string {
  const positional = [...spec.pathParams, ...spec.requiredQuery]
    .map((p) => `<${p}>`)
    .join(" ");
  const optional = spec.queryParams.filter(
    (q) => !spec.requiredQuery.includes(q),
  );
  return [
    `misarseo ${kebab(spec.resource)} ${spec.command}${positional ? ` ${positional}` : ""}${spec.hasBody ? " [--body JSON|@file.json]" : ""}`,
    `  ${spec.verb} ${spec.path}${spec.stream ? " (text/event-stream)" : ""}`,
    ...(optional.length
      ? [`  optional: ${optional.map((q) => `--${q} <value>`).join(" ")}`]
      : []),
  ].join("\n");
}

function parseFlags(args: string[]): {
  positional: string[];
  flags: Map<string, string>;
} {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > -1) flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      else flags.set(arg.slice(2), args[++i] ?? "");
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function readBody(raw: string): unknown {
  const source = raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw;
  return JSON.parse(source);
}

/** A string field of an untyped offer object, or "" when absent. */
function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object"
    ? Reflect.get(value, key)
    : undefined;
}

/** The plan-limit card: all copy comes from the server's offer. */
export function renderUpgradeCard(error: PlanLimitError): string {
  const offer: unknown = error.offer;
  const lines = [
    `Plan limit reached: ${text(field(offer, "headline")) || error.message}`,
  ];
  const plans: unknown = field(offer, "plans");
  for (const plan of Array.isArray(plans) ? (plans as unknown[]) : []) {
    if (field(plan, "current") === true) continue;
    const marker = field(plan, "recommended") === true ? "*" : "-";
    const unlocks = text(field(plan, "unlocks"));
    lines.push(
      `  ${marker} ${text(field(plan, "name"))} (${text(field(plan, "price"))})${unlocks ? ` — ${unlocks}` : ""}`,
    );
  }
  if (error.retryAfter !== undefined)
    lines.push(`  Resets in ${error.retryAfter}s.`);
  const cta = text(field(offer, "cta"));
  if (cta) lines.push(cta);
  if (error.upgradeUrl) lines.push(`Upgrade: ${error.upgradeUrl}`);
  return lines.join("\n");
}

export async function run(argv: string[], io: Io): Promise<number> {
  const { positional, flags } = parseFlags(argv);
  const [resource, command, ...rest] = positional;

  if (resource === "version" || flags.has("version")) {
    io.out(VERSION);
    return 0;
  }

  if (!resource || (resource === "help" && !command) || flags.has("help")) {
    io.out(
      `misarseo ${VERSION} — the MisarSEO API from the terminal.\n\nUsage: misarseo <resource> <command> [args] [--body JSON] [--param value]\n       misarseo list\n       misarseo help <resource> [command]\n\nAuth: --api-key mseo_... or MISARSEO_API_KEY.`,
    );
    return resource ? 0 : 2;
  }
  if (resource === "list") {
    const byResource = new Map<string, string[]>();
    for (const spec of COMMANDS) {
      const key = kebab(spec.resource);
      byResource.set(key, [...(byResource.get(key) ?? []), spec.command]);
    }
    for (const [key, commands] of byResource)
      io.out(`${key}: ${commands.join(", ")}`);
    return 0;
  }
  if (resource === "help") {
    const specs = COMMANDS.filter(
      (s) =>
        kebab(s.resource) === kebab(command ?? "") &&
        (!rest[0] || s.command === kebab(rest[0])),
    );
    if (!specs.length) {
      io.err(`Unknown resource or command: ${[command, ...rest].join(" ")}`);
      return 2;
    }
    for (const spec of specs) io.out(usage(spec));
    return 0;
  }

  const spec = command ? findCommand(resource, command) : undefined;
  if (!spec) {
    io.err(
      `Unknown command: ${resource} ${command ?? ""}. Run \`misarseo list\`.`,
    );
    return 2;
  }
  const names = [...spec.pathParams, ...spec.requiredQuery];
  if (rest.length !== names.length) {
    io.err(`Expected ${names.length} argument(s).\n${usage(spec)}`);
    return 2;
  }

  const apiKey = flags.get("api-key") ?? io.env.MISARSEO_API_KEY;
  if (!apiKey) {
    io.err(
      "A MisarSEO API key (mseo_...) is required: pass --api-key or set MISARSEO_API_KEY; see https://seo.misar.io/ai",
    );
    return 2;
  }
  const client = new Client({
    apiKey,
    baseUrl:
      flags.get("base-url") ?? io.env.MISARSEO_API_URL ?? DEFAULT_BASE_URL,
    fetch: io.fetch,
  });

  let path = spec.path;
  spec.pathParams.forEach((param, i) => {
    path = path.replace(`:${param}`, encodeURIComponent(rest[i] ?? ""));
  });
  const query: Record<string, string> = {};
  spec.requiredQuery.forEach((param, j) => {
    query[param] = rest[spec.pathParams.length + j]!;
  });
  for (const [key, value] of flags) {
    if (["api-key", "base-url", "body"].includes(key)) continue;
    query[key] = value;
  }

  try {
    if (spec.stream) {
      for await (const frame of client.stream(
        path,
        query,
        spec.terminalEvents ?? [],
      )) {
        io.out(JSON.stringify(frame));
      }
      return 0;
    }
    let body: unknown;
    if (spec.hasBody && flags.has("body")) {
      try {
        body = readBody(flags.get("body")!);
      } catch (error) {
        io.err(`--body is not valid JSON: ${String(error)}`);
        return 2;
      }
    }
    const result = await client.request(spec.verb, path, query, body);
    io.out(
      typeof result === "string" ? result : JSON.stringify(result, null, 2),
    );
    return 0;
  } catch (error) {
    if (error instanceof PlanLimitError) {
      io.err(renderUpgradeCard(error));
      return 3;
    }
    if (error instanceof ApiError) {
      io.err(
        `Error ${error.status ? `${error.status} ` : ""}(${error.code}): ${error.message}`,
      );
      return 1;
    }
    throw error;
  }
}
