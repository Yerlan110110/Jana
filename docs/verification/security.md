# Repository secret scan checkpoint

18 October 2026. This is an owner audit of public Git history. It is not independent security acceptance or a claim that every possible secret pattern is detectable.

Gitleaks 8.30.1 was downloaded from its [official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). The archive matches the release's published SHA-256. The binary, license and owner record are under `.artifacts/tools/gitleaks-8.30.1/`. It is not globally installed and no hooks are changed. Its maintainer describes the tool as feature complete with security patches continuing. The existing Git scan command fits this bounded audit; no custom secret detector is created.

The scan at `.artifacts/security/history-a219c3b-20261018/run.json` covers all local Git refs and history at `a219c3b`. Ignored private environment and runtime files are outside that scope. Console output is fully redacted. The original report remains protected at mode 0600 and the audit directory at mode 0700. The exposed metadata report omits matched text and secret values.

The raw scanner exits 1 with six findings. That result is retained. All six concern artifact digests in source-lock metadata or historical OpenAPI review reports. Five are verified against the exact bytes of retained Git artifacts. One is explicitly labelled as the SHA-256 of an old PostgreSQL-generated OpenAPI file. Its generated preimage is not in the tracked contract history. The current reference occurs only in that review document. Its classification relies on that documented provenance and context, not a fabricated byte match. It does not verify the historical generated schema.

The six dispositions and evidence identities are in `classification.json` beside the scan. No detection rule, file or historical finding was removed to produce a clean result. A known synthetic Sidekiq example from the official documentation is also detected through stdin with exit 1. It is not a real account and is never committed. Its redacted control result is retained in the same directory.

The current contract checks and matching-port GitHub verification are separate evidence from the historical review hashes. Current deployment secrets, cookie and proxy settings, the final frozen commit, dependency and license review, and the independent reviewer remain separate release checks. Re-scan the final candidate after subsequent source commits.
