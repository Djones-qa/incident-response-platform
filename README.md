# incident-response-platform

[![CI](https://github.com/Djones-qa/incident-response-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Djones-qa/incident-response-platform/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-red?logo=redis)](https://redis.io/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![Slack](https://img.shields.io/badge/Slack-Notifications-4A154B?logo=slack)](https://slack.com/)
[![PagerDuty](https://img.shields.io/badge/PagerDuty-Webhooks-06AC38?logo=pagerduty)](https://www.pagerduty.com/)
[![Opsgenie](https://img.shields.io/badge/Opsgenie-Webhooks-172B4D)](https://www.atlassian.com/software/opsgenie)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A production-grade, automated incident response platform built with TypeScript and Node.js. Ingests alerts from PagerDuty and Opsgenie, deduplicates them, executes Kubernetes runbooks automatically for HIGH/CRITICAL incidents, and generates structured post-mortems.

---

## Architecture

```
PagerDuty / Opsgenie
        │
        ▼ webhook
┌─────────────────────┐     Redis pub/sub     ┌──────────────────────┐
│   alert-receiver    │ ───────────────────► │  runbook-executor    │
│   (port 3000)       │                       │  (port 3001)         │
│                     │   timeline events     │                      │
│  • Normalize        │ ──────────────────►  │  • Map to runbook    │
│  • Deduplicate      │        Redis          │  • Execute K8s API   │
│  • Slack notify     │                       │  • restart-pod       │
│  • Route HIGH/CRIT  │                       │  • scale-deployment  │
└─────────────────────┘                       │  • drain-node        │
                                              │  • rollback          │
                                              └──────────────────────┘
                                                        │
                                                Redis timeline
                                                        │
                                              ┌─────────▼────────────┐
                                              │  postmortem-generator│
                                              │  (port 3002)         │
                                              │                      │
                                              │  • Pull timeline     │
                                              │  • Generate JSON     │
                                              │  • Generate Markdown │
                                              └──────────────────────┘
```

## Services

### alert-receiver (port 3000)

Ingests webhooks from PagerDuty and Opsgenie, normalizes both payload formats into a common `IncidentEvent` type, deduplicates via Redis TTL, publishes to the event bus, sends Slack notifications, and automatically routes HIGH/CRITICAL incidents to the runbook executor.

**Endpoints:**
- `GET /health` — health check
- `POST /webhook/pagerduty` — PagerDuty v2 webhook receiver
- `POST /webhook/opsgenie` — Opsgenie webhook receiver

### runbook-executor (port 3001)

Receives incident events, maps them to runbooks by alert name or service, and executes against the Kubernetes API via a service account. Supports dry-run mode for safe testing.

**Built-in runbooks:** `restart-pod`, `scale-deployment`, `drain-node`, `rollback-deployment`

**Endpoints:**
- `GET /health` — health check
- `POST /execute` — trigger runbook for an incident event

### postmortem-generator (port 3002)

Pulls the complete incident timeline from Redis and generates structured post-mortems in JSON and Markdown format.

**Endpoints:**
- `GET /health` — health check
- `GET /postmortem/:incidentId` — JSON post-mortem
- `GET /postmortem/:incidentId/markdown` — Markdown post-mortem

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20 (for local development)

### 1. Clone and configure

```bash
git clone https://github.com/Djones-qa/incident-response-platform.git
cd incident-response-platform
cp .env.example .env
# Edit .env — add your SLACK_WEBHOOK_URL if desired
```

### 2. Start the platform

```bash
docker compose up --build
```

All 3 services + Redis will start. The runbook-executor defaults to `DRY_RUN=true` locally.

### 3. Send test webhooks

```bash
docker compose --profile testing run mock-webhook-sender
```

Or manually:

```bash
# PagerDuty HIGH incident
curl -X POST http://localhost:3000/webhook/pagerduty \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "event": "incident.trigger",
      "incident": {
        "id": "PD-TEST-001",
        "title": "High CPU on prod-api",
        "service": { "name": "prod-api" },
        "urgency": "high",
        "status": "triggered",
        "body": { "details": "CPU usage exceeded 90%" },
        "created_at": "2024-01-15T10:00:00Z"
      }
    }]
  }'

# Opsgenie CRITICAL incident
curl -X POST http://localhost:3000/webhook/opsgenie \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "alert": {
      "alertId": "OG-TEST-001",
      "message": "Disk usage critical on node-1",
      "alias": "disk-critical",
      "priority": "P1",
      "entity": "node-1",
      "createdAt": 1705312800000,
      "updatedAt": 1705312800000
    }
  }'
```

### 4. Generate a post-mortem

```bash
# JSON
curl http://localhost:3002/postmortem/PD-TEST-001

# Markdown
curl http://localhost:3002/postmortem/PD-TEST-001/markdown
```

---

## Local Development

```bash
# Install dependencies for all services
cd alert-receiver && npm install
cd ../runbook-executor && npm install
cd ../postmortem-generator && npm install

# Run tests
npm run test:ci      # in any service directory

# Typecheck
npm run typecheck

# Build
npm run build
```

---

## Kubernetes Deployment

```bash
# Apply all manifests in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/resource-quota.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/network-policy.yaml
kubectl apply -f k8s/pod-disruption-budget.yaml
kubectl apply -f k8s/redis-deployment.yaml

# Create the Slack secret (required before deploying alert-receiver)
kubectl create secret generic slack-secret \
  --from-literal=webhook-url="$SLACK_WEBHOOK_URL" \
  -n incident-platform

kubectl apply -f k8s/alert-receiver-deployment.yaml
kubectl apply -f k8s/runbook-executor-deployment.yaml
kubectl apply -f k8s/postmortem-generator-deployment.yaml
```

---

## CI Pipeline

| Job | Description |
|-----|-------------|
| `typecheck-build` | Matrix across all 3 services — `tsc --noEmit` + `npm run build` |
| `unit-tests` | Jest tests for alert normalization, deduplication, runbook mapping, postmortem generation |
| `trivy-scan` | Scans all 3 Dockerfiles + `k8s/` manifests, fails on HIGH/CRITICAL |
| `kubeconform` | Validates all K8s manifests against 1.28 schemas |

---

## Security

- All containers run as non-root users with read-only root filesystems
- Kubernetes RBAC follows least-privilege — runbook-executor only has the permissions it needs
- Default deny-all `NetworkPolicy` with selective allow rules
- `PodDisruptionBudget` ensures `minAvailable: 1` for alert-receiver and runbook-executor
- `ResourceQuota` + `LimitRange` prevent resource exhaustion
- PodSecurity `restricted` profile enforced on the namespace

---

## Topics

`incident-response` `sre` `runbooks` `pagerduty` `opsgenie` `slack` `postmortem` `kubernetes` `docker` `typescript` `nodejs` `redis` `github-actions` `platform-engineering` `alerting` `oncall` `devops` `automation` `reliability`

---

## Author

**Darrius Jones**  
GitHub: [@Djones-qa](https://github.com/Djones-qa)  
LinkedIn: [darrius-jones-28226b350](https://www.linkedin.com/in/darrius-jones-28226b350)

---

## License

MIT
