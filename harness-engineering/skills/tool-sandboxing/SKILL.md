---
name: tool-sandboxing
description: Use when LLM-invoked tools execute code, touch the filesystem, or make network calls — and you need to bound their blast radius. Apply when designing the isolation boundary for tool execution in an agent harness. Covers filesystem jails, network egress controls, exec sandboxes (containers, gVisor, firecracker, seatbelt/landlock), capability-scoped credentials, and the difference between safety sandboxing and security sandboxing.
---

# Tool Sandboxing

## Pain Signals — You Need This Pattern When:

- Tools can execute arbitrary code (`Bash`, `python`, `node -e`) and a hallucinated command could damage the host
- Tools fetch URLs, and a prompt-injected URL could exfiltrate secrets or pivot internally
- Tools have ambient credentials (cloud SDK, kubeconfig) that grant far more than the task requires
- Untrusted input (user uploads, web pages, third-party APIs) reaches the LLM and shapes tool calls — prompt injection is realistic
- The harness runs as a service for multiple users; one user's session must not affect another's

**Two distinct goals.** Safety sandboxing prevents accidents (rm -rf typos). Security sandboxing prevents adversaries (prompt injection driving exfiltration). Same mechanisms, different threat models — and security sandboxing is strictly harder. If your threat model includes an attacker, accept that defense-in-depth is required.

---

## Core Principle

Treat the tool layer as **untrusted by default**. The trust boundary is between the harness core (your code, your decisions) and tool execution (model-driven, prompt-injectable). Everything the model can cause to happen must be bounded explicitly.

```
┌────────────────────────────────────────┐
│ harness core (trusted)                 │
│                                        │
│   policy / permission / audit          │
└─────────────┬──────────────────────────┘
              │ tool call
              ▼
┌────────────────────────────────────────┐
│ sandbox boundary                       │
│                                        │
│   ┌──────────────────────────────┐     │
│   │ tool execution (untrusted)   │     │
│   │  - jailed fs                 │     │
│   │  - egress allowlist          │     │
│   │  - scoped credentials        │     │
│   │  - resource caps             │     │
│   └──────────────────────────────┘     │
└────────────────────────────────────────┘
```

---

## Threat Model

Enumerate before designing controls:

| Threat | Source | Mitigation tier |
|--------|--------|-----------------|
| Hallucinated destructive command | Model | Permission gate + safety sandbox |
| Prompt injection from web/file content | External input via tool result | Security sandbox + egress limits |
| Credential exfiltration | Compromised tool args | Scoped creds, no ambient auth |
| Lateral movement (cloud, k8s) | Tool with admin scope | Least privilege, short-lived creds |
| Denial-of-service (fork bomb, fill disk) | Hallucinated or malicious | Resource caps |
| Cross-user data leak | Multi-tenant harness | Per-session isolation |

If an attacker is in scope, prompt injection is the dominant threat; assume any text the model reads can become instructions.

---

## Filesystem Jail

Bound what tool execution can read and write.

| Mechanism | Strength | Cost |
|-----------|----------|------|
| Cwd convention only | None | Free; safety-only |
| Path validation in tool | Weak (race conditions) | Cheap |
| Bind-mounted overlay | Medium | Containers; per-session workspace |
| Linux landlock / OpenBSD pledge | Strong, in-process | Kernel support; per-process |
| Container fs (read-only root + rw workdir) | Strong | Container runtime |
| MicroVM (firecracker) | Strongest | Heaviest |

Defaults that work for most harnesses:

- **Workspace path is the only writable area.** Everything else read-only or invisible.
- **No traversal escapes.** Resolve symlinks, reject `..` after canonicalization.
- **System paths invisible.** `/etc/shadow`, `~/.aws`, `~/.ssh`, `~/.config` not in the sandbox view.
- **Per-session workspace.** Sessions cannot see each other's files.

---

## Network Egress

The most-overlooked control. A sandboxed shell that can `curl example.com` is an exfiltration channel.

| Policy | Use when |
|--------|----------|
| **Default-deny + allowlist** | Production, untrusted input |
| **Default-allow + denylist (cloud metadata, internal CIDRs)** | Dev convenience; weak |
| **No network** | Strict; tools must declare net needs |

Allowlist must include:

- Whatever APIs the harness genuinely needs
- DNS over a controlled resolver (so allowlist is by hostname, not raw IP)

Block list always includes:

- Cloud metadata services (`169.254.169.254`, `metadata.google.internal`)
- RFC1918 / link-local unless explicitly allowed
- IPv6 unique-local unless allowed

Enforce at network namespace / firewall, not in the tool. In-tool URL validation is bypassable (DNS rebinding, redirects).

---

## Exec Isolation

For tools that run code:

| Mechanism | When |
|-----------|------|
| Subprocess with rlimits | Single-user dev tool, low risk |
| Container per call | Production, moderate risk |
| MicroVM per call | Untrusted code (CI runners, sandbox-as-a-service) |
| WASM | Pure-compute tools, no syscall surface |

Per-call vs per-session containers: per-call gives clean state but high startup cost; per-session is cheaper but accumulates state. Default to per-session with resettable workspace; per-call for high-risk tools.

Resource caps are non-optional:

```
cpu:    bounded (cgroup quota)
memory: bounded (OOM kill)
pids:   bounded (no fork bombs)
disk:   bounded (no fill-the-disk)
time:   wall-clock timeout
```

---

## Credential Scoping

The sandbox is only as good as the credentials inside it.

- **No ambient cloud auth.** No `~/.aws`, no instance metadata access, no kube-context.
- **Pass scoped tokens explicitly.** Tool that calls GitHub gets a token with the minimum repo scope, not the user's full PAT.
- **Short TTL.** Tokens expire in minutes, not hours.
- **Per-session or per-call issuance.** Audit which call used which token.
- **Never log credentials.** Redact before transcript and telemetry.

```python
class ScopedCredentialIssuer:
    def issue(self, *, tool: str, session: str, scope: list[str], ttl_seconds: int = 300):
        ...
```

The bar: a compromised tool execution should be able to do *only* what was issued, for *only* this session, for *only* a few minutes.

---

## Safety vs Security

Mechanisms are similar; rigor required differs by an order of magnitude.

| Concern | Safety mode | Security mode |
|---------|-------------|---------------|
| Path traversal | Reject `..` | Reject `..`, resolve symlinks, canonicalize, retry-resolve, kernel-level jail |
| Egress | Block obvious bad hosts | Default-deny allowlist, block metadata, DNS pinning |
| Auth | Limit user-context | No ambient creds, scoped short-lived tokens |
| Resources | Reasonable caps | Hard caps + monitoring + alarm |
| Validation | Trust the harness | Assume harness can be tricked; sandbox catches what gates miss |

If the threat model has an attacker, you are in security mode. Don't design as if it's safety mode and hope.

---

## Escape Hatches

Some tools genuinely need elevated capability (deployment, infra changes). Don't widen the sandbox; build a narrow trapdoor.

- Operation-specific (not blanket)
- Logged with full context
- Approved at issuance, not at use
- Time-limited
- Revocable mid-session

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Path validation in user-space tool | TOCTOU race or symlink bypass | Kernel-level jail |
| Sandbox without egress control | Exfiltration channel via curl | Default-deny network |
| Cloud metadata reachable | IMDS attack works | Block 169.254.169.254 explicitly |
| Ambient creds in env | Compromise = full account | Scoped tokens passed per call |
| Sandbox shared across users | Cross-tenant leak | Per-session isolation |
| Fork bomb crashes host | DoS | pids cgroup limit |
| Same sandbox per session, never reset | State accumulates between tasks | Reset workspace at task boundary |
| In-tool URL allowlist | Bypassable via redirect | Network-layer enforcement |
| "Trusted" tools skip sandbox | One bad tool defeats the boundary | All tools in sandbox; trusted ones get more capability *inside* the sandbox |

---

## When NOT to Use (Heavy Sandboxing)

- **Local single-user dev tool, no untrusted input.** Subprocess + permission gates may be enough.
- **Tools are pure compute (math, format, parse).** Restrict syscalls instead of full container.
- **Read-only research agents** with no shell, no fs writes, no auth tokens.

But "we trust our users" is not a reason to skip the egress allowlist if untrusted input ever reaches the model. Web pages, PR descriptions, and email bodies are untrusted input.

---

## Design Checklist

- [ ] Threat model explicit: safety only, or security (attacker in scope)
- [ ] Trust boundary documented; tool execution treated as untrusted past the boundary
- [ ] Filesystem jail: writable workspace, system paths invisible, no symlink escape
- [ ] Network: default-deny with allowlist; metadata services blocked; DNS controlled
- [ ] No ambient credentials in sandbox; scoped short-lived tokens issued per call
- [ ] Resource caps: cpu, memory, pids, disk, wall-clock — all enforced
- [ ] Per-session isolation; sessions cannot see each other's workspace or processes
- [ ] Tool args and credentials redacted before transcript and telemetry
- [ ] Escape hatches narrow, logged, time-limited, revocable
- [ ] Sandbox failures fail closed (block tool) by default, not open
- [ ] Periodic review: enumerate every reachable network, fs path, and credential scope from inside the sandbox
- [ ] Coordination with permission-gates skill: gates decide intent; sandbox enforces capability
