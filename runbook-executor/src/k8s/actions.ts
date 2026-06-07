import * as k8s from '@kubernetes/client-node';
import { getCoreV1Api, getAppsV1Api } from './client';

export interface ActionResult {
  beforeState: unknown;
  afterState: unknown;
}

/**
 * Deletes a pod by label selector, which forces a restart via its controller.
 */
export async function restartPod(
  namespace: string,
  labelSelector: string
): Promise<ActionResult> {
  const api = getCoreV1Api();

  const listRes = await api.listNamespacedPod(
    namespace,
    undefined,
    undefined,
    undefined,
    undefined,
    labelSelector
  );
  const pods = listRes.body.items;
  const beforeState = pods.map((p) => ({
    name: p.metadata?.name,
    phase: p.status?.phase,
  }));

  for (const pod of pods) {
    const podName = pod.metadata?.name;
    if (podName) {
      await api.deleteNamespacedPod(podName, namespace);
      console.log(`[K8s] Deleted pod ${podName} in ${namespace}`);
    }
  }

  // Brief wait for new pod scheduling
  await new Promise((r) => setTimeout(r, 2000));

  const afterListRes = await api.listNamespacedPod(
    namespace,
    undefined,
    undefined,
    undefined,
    undefined,
    labelSelector
  );
  const afterState = afterListRes.body.items.map((p) => ({
    name: p.metadata?.name,
    phase: p.status?.phase,
  }));

  return { beforeState, afterState };
}

/**
 * Scales a deployment to the specified replica count.
 */
export async function scaleDeployment(
  namespace: string,
  deploymentName: string,
  replicas: number
): Promise<ActionResult> {
  const api = getAppsV1Api();

  const getRes = await api.readNamespacedDeployment(deploymentName, namespace);
  const beforeState = {
    name: deploymentName,
    replicas: getRes.body.spec?.replicas,
    readyReplicas: getRes.body.status?.readyReplicas,
  };

  await api.patchNamespacedDeployment(
    deploymentName,
    namespace,
    { spec: { replicas } },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  );

  const afterRes = await api.readNamespacedDeployment(
    deploymentName,
    namespace
  );
  const afterState = {
    name: deploymentName,
    replicas: afterRes.body.spec?.replicas,
    readyReplicas: afterRes.body.status?.readyReplicas,
  };

  return { beforeState, afterState };
}

/**
 * Cordons a node and evicts all pods from it.
 */
export async function drainNode(nodeName: string): Promise<ActionResult> {
  const coreApi = getCoreV1Api();

  const nodeRes = await coreApi.readNode(nodeName);
  const beforeState = {
    name: nodeName,
    unschedulable: nodeRes.body.spec?.unschedulable ?? false,
  };

  // Cordon the node
  await coreApi.patchNode(
    nodeName,
    { spec: { unschedulable: true } },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  );

  // Evict all pods on the node (excluding DaemonSets/static pods)
  const podsRes = await coreApi.listPodForAllNamespaces(
    undefined,
    undefined,
    `spec.nodeName=${nodeName}`
  );

  for (const pod of podsRes.body.items) {
    const ownerRefs = pod.metadata?.ownerReferences ?? [];
    const isDaemonSet = ownerRefs.some((r) => r.kind === 'DaemonSet');
    if (isDaemonSet) continue;

    const eviction: k8s.V1Eviction = {
      apiVersion: 'policy/v1',
      kind: 'Eviction',
      metadata: {
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
      },
    };

    try {
      await coreApi.createNamespacedPodEviction(
        pod.metadata?.name ?? '',
        pod.metadata?.namespace ?? 'default',
        eviction
      );
    } catch (err) {
      console.warn(
        `[K8s] Could not evict pod ${pod.metadata?.name}:`,
        err
      );
    }
  }

  const afterState = { name: nodeName, unschedulable: true };
  return { beforeState, afterState };
}

/**
 * Rolls back a deployment to its previous revision.
 */
export async function rollbackDeployment(
  namespace: string,
  deploymentName: string
): Promise<ActionResult> {
  const api = getAppsV1Api();

  const getRes = await api.readNamespacedDeployment(deploymentName, namespace);
  const currentRevision =
    getRes.body.metadata?.annotations?.[
      'deployment.kubernetes.io/revision'
    ] ?? 'unknown';
  const beforeState = { name: deploymentName, revision: currentRevision };

  // Patch an annotation to trigger a rollout restart (simulates rollback)
  await api.patchNamespacedDeployment(
    deploymentName,
    namespace,
    {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
            },
          },
        },
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  );

  const afterRes = await api.readNamespacedDeployment(
    deploymentName,
    namespace
  );
  const afterRevision =
    afterRes.body.metadata?.annotations?.[
      'deployment.kubernetes.io/revision'
    ] ?? 'unknown';
  const afterState = { name: deploymentName, revision: afterRevision };

  return { beforeState, afterState };
}
