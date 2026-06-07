#!/bin/sh
set -e

BASE_URL="${ALERT_RECEIVER_URL:-http://localhost:3000}"

echo "==> Mock Webhook Sender"
echo "    Target: $BASE_URL"
echo ""

sleep 5

# --- PagerDuty: HIGH severity ---
echo "[1/4] Sending PagerDuty HIGH incident..."
curl -s -X POST "$BASE_URL/webhook/pagerduty" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "event": "incident.trigger",
      "incident": {
        "id": "PD-MOCK-001",
        "title": "High CPU on prod-api",
        "service": { "name": "prod-api" },
        "urgency": "high",
        "status": "triggered",
        "body": { "details": "CPU usage has exceeded 90% on prod-api for 5 minutes" },
        "created_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
      }
    }]
  }' | jq . 2>/dev/null || echo "Response received"

echo ""
sleep 2

# --- Opsgenie: CRITICAL severity ---
echo "[2/4] Sending Opsgenie CRITICAL incident..."
curl -s -X POST "$BASE_URL/webhook/opsgenie" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "alert": {
      "alertId": "OG-MOCK-001",
      "message": "Disk usage critical on node-1",
      "alias": "disk-critical-node-1",
      "description": "Disk usage has exceeded 95% on node-1",
      "source": "node-1",
      "priority": "P1",
      "entity": "node-1",
      "createdAt": '"$(date +%s%3N)"',
      "updatedAt": '"$(date +%s%3N)"'
    }
  }' | jq . 2>/dev/null || echo "Response received"

echo ""
sleep 2

# --- PagerDuty: duplicate (should be suppressed) ---
echo "[3/4] Sending duplicate PagerDuty incident (should be suppressed)..."
curl -s -X POST "$BASE_URL/webhook/pagerduty" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "event": "incident.trigger",
      "incident": {
        "id": "PD-MOCK-001",
        "title": "High CPU on prod-api",
        "service": { "name": "prod-api" },
        "urgency": "high",
        "status": "triggered",
        "body": { "details": "CPU usage has exceeded 90% on prod-api for 5 minutes" },
        "created_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
      }
    }]
  }' | jq . 2>/dev/null || echo "Response received"

echo ""
sleep 2

# --- Opsgenie: resolve ---
echo "[4/4] Sending Opsgenie resolved event..."
curl -s -X POST "$BASE_URL/webhook/opsgenie" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "close",
    "alert": {
      "alertId": "OG-MOCK-002",
      "message": "Memory pressure on worker",
      "alias": "memory-pressure-worker",
      "description": "Memory usage exceeded threshold",
      "source": "worker",
      "priority": "P2",
      "entity": "worker",
      "createdAt": '"$(date +%s%3N)"',
      "updatedAt": '"$(date +%s%3N)"'
    }
  }' | jq . 2>/dev/null || echo "Response received"

echo ""
echo "==> Done. Check the alert-receiver logs and try:"
echo "    curl http://localhost:3002/postmortem/PD-MOCK-001"
echo "    curl http://localhost:3002/postmortem/PD-MOCK-001/markdown"
