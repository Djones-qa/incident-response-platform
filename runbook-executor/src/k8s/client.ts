import * as k8s from '@kubernetes/client-node';

let coreV1Api: k8s.CoreV1Api;
let appsV1Api: k8s.AppsV1Api;

function getKubeConfig(): k8s.KubeConfig {
  const kc = new k8s.KubeConfig();

  // In-cluster config when running inside Kubernetes
  try {
    kc.loadFromCluster();
    console.log('[K8s] Loaded in-cluster config');
  } catch {
    // Fall back to local kubeconfig for dev/testing
    kc.loadFromDefault();
    console.log('[K8s] Loaded default kubeconfig');
  }

  return kc;
}

export function getCoreV1Api(): k8s.CoreV1Api {
  if (!coreV1Api) {
    const kc = getKubeConfig();
    coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
  }
  return coreV1Api;
}

export function getAppsV1Api(): k8s.AppsV1Api {
  if (!appsV1Api) {
    const kc = getKubeConfig();
    appsV1Api = kc.makeApiClient(k8s.AppsV1Api);
  }
  return appsV1Api;
}
