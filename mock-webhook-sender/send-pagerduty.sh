#!/bin/sh
# Sends a realistic PagerDuty v3 webhook payload to the alert-receiver service.
# Usage: ./send-pagerduty.sh [target_url]

TARGET_URL="${1:-http://localhost:3000/webhook/pagerduty}"

echo "Sending PagerDuty webhook to ${TARGET_URL}..."

curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${TARGET_URL}" \
  -H "Content-Type: application/json" \
  -H "X-PagerDuty-Signature: v1=mock-signature-for-dev" \
  -d '{
    "event": {
      "id": "01BKJVEM7GRWFMGFDH8BMCRM9Z",
      "event_type": "incident.triggered",
      "resource_type": "incident",
      "occurred_at": "2024-01-15T10:30:00Z",
      "agent": {
        "html_url": "https://acme.pagerduty.com/users/P123456",
        "id": "P123456",
        "self": "https://api.pagerduty.com/users/P123456",
        "summary": "Tom Bombadil",
        "type": "user_reference"
      },
      "client": {
        "name": "PagerDuty"
      },
      "data": {
        "id": "PGR0VU2",
        "type": "incident",
        "self": "https://api.pagerduty.com/incidents/PGR0VU2",
        "html_url": "https://acme.pagerduty.com/incidents/PGR0VU2",
        "number": 2,
        "status": "triggered",
        "incident_key": "production-pod-crash-loop",
        "created_at": "2024-01-15T10:29:58Z",
        "title": "PodCrashLooping on payment-service",
        "service": {
          "html_url": "https://acme.pagerduty.com/services/PIJ90N7",
          "id": "PIJ90N7",
          "self": "https://api.pagerduty.com/services/PIJ90N7",
          "summary": "payment-service",
          "name": "payment-service",
          "type": "service_reference"
        },
        "assignees": [
          {
            "html_url": "https://acme.pagerduty.com/users/P123456",
            "id": "P123456",
            "self": "https://api.pagerduty.com/users/P123456",
            "summary": "Alice Engineer",
            "type": "user_reference"
          }
        ],
        "escalation_policy": {
          "html_url": "https://acme.pagerduty.com/escalation_policies/PT20YPA",
          "id": "PT20YPA",
          "self": "https://api.pagerduty.com/escalation_policies/PT20YPA",
          "summary": "Production Escalation",
          "type": "escalation_policy_reference"
        },
        "teams": [],
        "priority": {
          "id": "P53ZZH5",
          "name": "P1"
        },
        "urgency": "high",
        "severity": "critical",
        "conference_bridge": null,
        "resolve_reason": null,
        "dedup_key": "production-pod-crash-loop",
        "body": {
          "details": "Pod payment-service-7d9c8b6f4-xkp2n has been restarting continuously for the past 15 minutes. OOMKilled detected in container logs. Memory limit exceeded at 512Mi."
        }
      }
    }
  }'

echo ""
echo "PagerDuty webhook sent."
