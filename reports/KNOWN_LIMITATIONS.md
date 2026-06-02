# Hermes Doctor — Known Limitations

**Generated:** 2026-06-01  
**Purpose:** Document detection gaps — failure modes that exist in the real world but are not currently detected by Hermes Doctor. Each entry includes what the limitation is, why it exists, and whether it's in scope for future work.

---

## Resolved in v0.1.1

The following 7 Hermes config schema mismatches were discovered during production testing against Hermes v0.15.2 and resolved in v0.1.1. All were fixed by aligning Doctor's config read paths with the actual Hermes schema.

---

### ✅ Resolved: Custom Providers Not Detected

**Assertion:** (e2e validation finding)  
**Area:** Providers  
**Severity:** Critical — providers were completely invisible to Doctor  

**Description:** Doctor read `model.providers` key instead of `config.providers` array (the `custom_providers` field). This caused all custom providers to be undetected, producing a misleading "No providers configured" result even when providers were fully defined.

**Root cause:** The config reader used an incorrect key path that did not match the Hermes config schema.

**Fix in v0.1.1:** Updated config reader to read the `custom_providers` array from the correct location in the config structure.

---

### ✅ Resolved: Default Model Not Detected

**Assertion:** (e2e validation finding)  
**Area:** Providers  
**Severity:** High — default model setting was invisible  

**Description:** Doctor read `model.default` as a string, expecting the entire field to contain the model ID. The actual Hermes schema stores the default model at `model.default.model` (a nested field within the `default` object).

**Root cause:** The config reader dereferenced the `default` field directly instead of accessing its `model` subfield.

**Fix in v0.1.1:** Updated config reader to extract `model.default.model` when reading the default model identifier.

---

### ✅ Resolved: Dashboard Binding Not Detected

**Assertion:** (e2e validation finding)  
**Area:** Dashboard  
**Severity:** High — dashboard binding was invisible  

**Description:** Doctor read `dashboard.enabled` + `dashboard.port` to detect dashboard configuration. The actual Hermes schema stores the binding at `display.platforms.api_server` (a top-level `display` key with nested platform configs, not a `dashboard` section).

**Root cause:** The config reader used an incorrect top-level key (`dashboard`) that does not exist in the Hermes schema.

**Fix in v0.1.1:** Updated config reader to read the `display.platforms.api_server` path for dashboard binding detection.

---

### ✅ Resolved: MCP Servers Not Detected

**Assertion:** (e2e validation finding)  
**Area:** MCP  
**Severity:** Critical — MCP servers were completely invisible to Doctor  

**Description:** Doctor read `mcp.servers` to discover MCP server configurations. The actual Hermes schema stores them at the top-level `mcp_servers` key (an underscore-separated key, not a nested `mcp` section).

**Root cause:** The config reader used a nested key path (`mcp.servers`) instead of the flat top-level key (`mcp_servers`).

**Fix in v0.1.1:** Updated config reader to read the `mcp_servers` top-level key.

---

### ✅ Resolved: Terminal Backend Not Detected

**Assertion:** (e2e validation finding)  
**Area:** Terminal  
**Severity:** Medium — terminal backend configuration was invisible  

**Description:** Doctor did not read the top-level `terminal.backend` key at all, missing the terminal backend configuration entirely.

**Root cause:** The config reader had no path for the `terminal` top-level key.

**Fix in v0.1.1:** Added config reader support for the top-level `terminal.backend` key.

---

### ✅ Resolved: Bogus auth.json Provider Conflict False Positives

**Assertion:** (e2e validation finding)  
**Area:** Providers  
**Severity:** High — false positive "Auth Provider Not Found" findings  

**Description:** Doctor cross-referenced the `auth.json` `active_provider` field with model providers, generating false "Auth Provider Not Found" findings. The `active_provider` field in `auth.json` refers to an authentication mechanism (not a model provider), so cross-referencing it with model provider names is semantically incorrect.

**Root cause:** The auth.json validation logic conflated the authentication provider field with model provider identifiers.

**Fix in v0.1.1:** Removed the spurious cross-reference between `auth.json` `active_provider` and model provider lists. Auth.json validation now only checks for the presence and structure of credentials.

---

### ✅ Resolved: Skills Metadata False Positives

**Assertion:** (e2e validation finding)  
**Area:** Skills  
**Severity:** Medium — false "Incomplete Skill Metadata" findings  

**Description:** Doctor required YAML front matter in SKILL.md files, producing false "Incomplete Skill Metadata" findings for skills that had valid metadata in other formats or that intentionally omitted YAML front matter.

**Root cause:** The skills validator imposed a YAML-front-matter requirement that the Hermes spec does not enforce.

**Fix in v0.1.1:** Relaxed the SKILL.md metadata check to only require a title line (`# Title`), matching the actual Hermes skill spec. YAML front matter is optional.

---

## Limitation 1: Malformed Fallback Provider Config

**Assertion:** VAL-PROV-011  
**Area:** Providers  

**Description:** When a provider section has a malformed `fallback_providers` field (e.g., a string instead of an array, or references to nonexistent providers), the Doctor does not detect this as a broken finding.

**Why it exists:** The Doctor does not currently have a check that validates `fallback_providers` structure or references. This is a **not yet implemented** feature gap.

**Impact:** Misconfigured fallback chains go undetected, which could cause silent fallback failures during real Hermes operation.

**Scope for future work:** Low priority. Fallback provider validation is an edge case that affects a minority of configurations.

---

## Limitation 2: Auxiliary Model/Provider Incomplete Validation

**Assertion:** VAL-PROV-012  
**Area:** Providers  

**Description:** When auxiliary models reference providers that aren't properly configured, the Doctor's detection is limited. While the provider collector does collect data about all providers, there is no dedicated check that maps auxiliary model configs (embeddings, classification, etc.) to their respective provider configurations.

**Why it exists:** The auxiliary model validation is a **partial implementation**. Basic provider-level env var checks do catch some missing key issues, but the mapping from auxiliary model → provider → configuration completeness is not validated.

**Impact:** Some auxiliary provider misconfigurations may be missed if those providers aren't also referenced as main-model providers.

**Scope for future work:** Medium priority. Would benefit from a model-to-provider cross-reference validator.

---

## Limitation 3: Remote MCP URLs — No Probing

**Assertion:** VAL-MCP-015  
**Area:** MCP  

**Description:** When an MCP server is configured with a remote URL transport (e.g., SSE, HTTP), the Doctor records the URL but does not probe the remote endpoint. The finding is reported as `info` with `probed: false`.

**Why it exists:** This is a **conscious design choice**. The Doctor avoids making outbound network requests to arbitrary remote endpoints in default mode. This prevents accidental network egress, protects user privacy, and avoids triggering external monitoring systems. The architecture dictates local-only probing.

**Impact:** Remote MCP servers may be down, misconfigured, or unreachable, and the Doctor will not detect this. Users must verify remote server health through other means.

**Scope for future work:** Not planned for default mode. An opt-in `--allow-remote-probes` flag could enable remote health checks, but this would require careful security review.

---

## Limitation 4: Security Public-Binding Check Not Registered

**Assertion:** VAL-DASH-024  
**Area:** Security  

**Description:** The `security-public-binding` check ID exists in the security collector code but is not registered in the security check pipeline. When the dashboard is bound to `0.0.0.0`, the dashboard area's `dashboard-localhost-binding` finding catches this at severity `4` (risk), but there is no separate **security** area finding for public binding.

**Why it exists:** The `dashboard-localhost-binding` check in the dashboard area already covers this scenario. The security-area duplicate was planned but not wired into the check pipeline. This is a **not yet implemented** feature gap.

**Impact:** The public binding condition is still detected with correct severity (risk 4) in the dashboard area. Users get appropriate warnings. The only gap is that a security-area finding is not produced separately, which could affect security-dashboard rollups or consolidated security views.

**Scope for future work:** Low priority. Would involve registering `security-public-binding` in the security checks array.

---

## Limitation 5: Huge File Detection Relies on Sparse Files

**Assertion:** VAL-MEM-012  
**Area:** Memory  

**Description:** The huge file detection test creates a sparse file (logical size 110 MB, actual blocks allocated ~0 KB). The Doctor detects files based on their `stat` size (logical size), not their actual disk usage. This works correctly for most real-world scenarios but may produce false positives for intentionally sparse files.

**Why it exists:** The Doctor uses `fs.stat()` to check file sizes, which returns the logical file size. Sparse files are an edge case that would require additional `stat` fields (blocks allocated) to differentiate. This is an **acceptable behavior** given that sparse files in Hermes memory/log directories are extremely rare in practice.

**Impact:** A user who intentionally creates a sparse memory file near the threshold may see a false-positive warning. This is unlikely in real Hermes usage.

**Scope for future work:** Very low priority. Adding block allocation checking would add complexity for negligible real-world benefit.

---

## Limitation 6: Dashboard Public Binding — Not Probed (Design Choice)

**Assertion:** (e2e validation finding)
**Area:** Dashboard

**Description:** When the dashboard API server (`display.platforms.api_server`) is bound to `0.0.0.0` (all interfaces), the Doctor correctly identifies this as a `risk` severity 4 finding (`dashboard-localhost-binding`). However, the dashboard-reachable check reports `info`/severity 0 with "not probed (remote URL)" because `0.0.0.0` is not treated as a localhost address for probing purposes. On a real Hermes VM, the dashboard IS accessible via the machine's external IP/domain (e.g., `http://dashboard.example.com:8642`).

**Why it exists:** The Doctor uses `isLocalhostUrl()` to determine whether to probe, which only considers `127.0.0.1`, `localhost`, and `::1` as localhost. The `0.0.0.0` wildcard address is not localhost — it binds to all interfaces. Probing `0.0.0.0` would not reach the dashboard (the OS treats it as a source address, not a reachable target). This is a **conscious design choice**: the Doctor does not resolve external hostnames or probe remote IPs in default mode.

**Impact:** Users with a dashboard bound to `0.0.0.0` will see a risk finding about public exposure but won't get a reachability probe result. The risk finding is the important diagnostic; the probe result is supplementary.

**Scope for future work:** Not planned for default mode. An opt-in flag could allow probing the machine's external IP, but this would be a network operation.

---

## Limitation 7: Dashboard Authentication Detection Ignores Infrastructure Proxy Auth

**Assertion:** (e2e validation finding)
**Area:** Dashboard

**Description:** The Doctor checks the `dashboard.oauth` config section for authentication configuration. When no OAuth is configured (e.g., `dashboard.oauth.client_id: ''` and `portal_url: ''`), the Doctor reports `dashboard-auth` as `risk` severity 4 with "authentication disabled." However, on the real Hermes VM, authentication is handled by the infrastructure proxy (exe.dev login) that sits in front of the dashboard, not by Hermes' own OAuth config. The Doctor cannot detect proxy-level authentication.

**Why it exists:** The Doctor only has access to the Hermes config file and can only check Hermes-level auth settings. Infrastructure-level auth (reverse proxy, VPN, SSH tunnel) is outside its scope. This is a **design limitation**.

**Impact:** Users with proxy-level auth may see a misleading "authentication disabled" warning even though their dashboard is actually protected by the infrastructure layer.

**Scope for future work:** Low priority. Infrastructure auth is inherently undetectable from inside the Hermes home directory.

---

## Limitation 8: Dashboard TLS Detection Ignores Proxy TLS Termination

**Assertion:** (e2e validation finding)
**Area:** Dashboard

**Description:** The Doctor checks the dashboard URL scheme (http vs https) and reports `dashboard-tls` as `info`/severity 1 when the dashboard uses plain HTTP. On the real Hermes VM, TLS may be terminated at the infrastructure proxy level, not at the Hermes dashboard level. The Doctor sees `http://0.0.0.0:8642` (no TLS) but the actual external endpoint (`https://dashboard.example.com:8642`) serves HTTPS via the proxy.

**Why it exists:** The Doctor only inspects internal Hermes config, not the external network topology. Proxy-level TLS termination is invisible from the Hermes home directory. This is a **design limitation**.

**Impact:** Users with proxy-level TLS may see an info finding about missing TLS even though their traffic is encrypted at the proxy layer.

**Scope for future work:** Not planned. Detecting proxy-level TLS is outside the Doctor's scope (it's a local diagnostics tool).

---

## Summary

| # | Limitation | Area | Severity | Root Cause | Scope for Fix |
|---|-----------|------|----------|-----------|---------------|
| 1 | Malformed fallback undetected | Providers | Low | Not implemented | Low |
| 2 | Auxiliary provider incomplete validation | Providers | Medium | Partially implemented | Medium |
| 3 | Remote MCP URLs not probed | MCP | Low | Design choice | Not planned |
| 4 | Security public-binding not registered | Security | Low | Not wired up | Low |
| 5 | Sparse file false positive risk | Memory | Low | Acceptable behavior | Very low |
| 6 | Dashboard 0.0.0.0 not probed | Dashboard | Low | Design choice | Not planned |
| 7 | Proxy-level auth undetectable | Dashboard | Low | Out of scope | Not planned |
| 8 | Proxy-level TLS undetectable | Dashboard | Low | Out of scope | Not planned |

**Total gaps:** 8 (2 provider, 1 MCP, 1 security, 1 memory, 3 dashboard)  
**Acceptance impact:** All gaps are documented and understood. None affect the core safety guarantees (redaction, golden path, audit hard gates).
