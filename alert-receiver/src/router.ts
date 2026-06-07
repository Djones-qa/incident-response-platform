import axios from 'axios';
import { IncidentEvent } from './types/incident';

const RUNBOOK_EXECUTOR_URL =
  process.env['RUNBOOK_EXECUTOR_URL'] ?? 'http://runbook-executor:3001';

/**
 * Routes HIGH and CRITICAL incidents to the runbook executor automatically.
 */
export async function routeToRunbook(event: IncidentEvent): Promise<void> {
  if (event.severity !== 'HIGH' && event.severity !== 'CRITICAL') {
    return;
  }

  console.log(
    `[Router] Routing ${event.severity} incident ${event.id} to runbook executor`
  );

  try {
    await axios.post(`${RUNBOOK_EXECUTOR_URL}/execute`, event, {
      timeout: 10_000,
    });
    console.log(`[Router] Successfully routed incident ${event.id}`);
  } catch (err) {
    console.error(`[Router] Failed to route incident ${event.id}:`, err);
  }
}
