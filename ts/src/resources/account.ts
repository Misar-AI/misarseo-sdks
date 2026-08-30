import type { HttpClient, RequestOptions } from "../http.js";
import type {
  AccountExport,
  DeleteAccountInput,
  DeleteAccountResponse,
} from "../types.js";

/**
 * Account resource — Data Subject Rights export and erasure
 * (GDPR Art. 15/17/20, CCPA, DPDPA). Every call is scoped strictly to the
 * authenticated caller's own userId + organizationId.
 */
export class AccountResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Export a complete JSON copy of the authenticated caller's own data
   * across every owned table. Rate-limited to 5 requests/60s.
   *
   * Check `subject.includesOrganizationData` before reading the
   * organization-wide sections: a caller who is neither owner nor admin gets
   * them empty by design, which is not the same as having no data.
   */
  export(options?: RequestOptions): Promise<AccountExport> {
    return this.http.get<AccountExport>("/account/export", undefined, options);
  }

  /**
   * Permanently delete the authenticated caller's account and all owned
   * data. Irreversible. Requires the explicit `{ confirm: "DELETE" }` guard
   * to prevent accidental erasure.
   *
   * The blast radius depends on membership and is REPORTED on the response,
   * not assumed: when teammates remain only the caller's own rows go, and
   * `deletedOrganizationId` comes back `null` with `organizationDeleted:
   * false`. The SDK typed that id as a plain `string`, so the surviving-org
   * case looked identical to a teardown.
   */
  delete(
    input: DeleteAccountInput,
    options?: RequestOptions,
  ): Promise<DeleteAccountResponse> {
    return this.http.delete<DeleteAccountResponse>(
      "/account/delete",
      input,
      options,
    );
  }
}
