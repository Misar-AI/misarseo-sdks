/** One CLI command, generated from a manifest method (see src/generated). */
export interface CommandSpec {
  /** Manifest resource key, e.g. `rankTracking`. */
  resource: string;
  /** Kebab-case command name, e.g. `add-keywords`. */
  command: string;
  /** Manifest method name, e.g. `addKeywords`. */
  method: string;
  /** HTTP verb: GET, POST, PATCH or DELETE. */
  verb: string;
  path: string;
  pathParams: string[];
  requiredQuery: string[];
  queryParams: string[];
  hasBody: boolean;
  /** text/event-stream endpoint, printed frame by frame. */
  stream?: boolean;
  terminalEvents?: string[];
}
