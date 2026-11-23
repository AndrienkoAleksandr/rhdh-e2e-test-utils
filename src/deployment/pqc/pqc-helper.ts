import { $, KubernetesClientHelper } from "../../utils/index.js";
import {
  DEFAULT_CONFIG_PATHS,
  PQ_HTTPD_HTTPS_PORT,
  PQ_HTTPD_NAME,
  type TlsGroup,
} from "./constants.js";
import {
  type OpensslSClientResult,
  runOpensslSClientFromRhdhPod,
} from "./s-client.js";

export type PQCDeploymentConfig = {
  namespace: string;
  releaseName: string;
  manifestPath: string;
};

/**
 * Deploys the PQC HTTPS peer (ubi10/httpd-24 with in-pod TLS on 8443).
 * Call from test.runOnce — not globalSetup. Deploys into the Playwright project namespace.
 */
export class PQCHelper {
  k8sClient = new KubernetesClientHelper();
  deploymentConfig: PQCDeploymentConfig;
  serviceHost = "";
  servicePort = PQ_HTTPD_HTTPS_PORT;

  constructor(options: { releaseName?: string; manifestPath?: string } = {}) {
    this.deploymentConfig = {
      namespace: "",
      releaseName: options.releaseName ?? PQ_HTTPD_NAME,
      manifestPath: options.manifestPath ?? DEFAULT_CONFIG_PATHS.httpdManifest,
    };
  }

  /**
   * Deploy httpd + Service into the given namespace and resolve the Service host.
   */
  async deploy(namespace: string): Promise<void> {
    this.deploymentConfig.namespace = namespace;
    console.info(
      `[PQCHelper] Starting PQC httpd deployment in ${namespace}...`,
    );
    await this.k8sClient.createNamespaceIfNotExists(namespace);
    await this._applyManifests();
    await this.waitUntilReady();
    this.resolveService();
    console.info(
      `[PQCHelper] PQC httpd ready at https://${this.serviceHost}:${this.servicePort}`,
    );
  }

  /**
   * Set the in-cluster Service DNS host (safe after worker restart when deploy
   * was skipped). Deterministic — no API lookup required.
   */
  resolveService(): void {
    const { namespace, releaseName } = this.deploymentConfig;
    if (!namespace) {
      throw new Error(
        "PQC namespace is not set — call deploy(namespace) first",
      );
    }
    this.serviceHost = `${releaseName}.${namespace}.svc`;
    this.servicePort = PQ_HTTPD_HTTPS_PORT;
  }

  getServiceHost(): string {
    if (!this.serviceHost) {
      throw new Error(
        "PQC service host is not set — call deploy(namespace) or resolveService() first",
      );
    }
    return this.serviceHost;
  }

  getServicePort(): number {
    return this.servicePort;
  }

  async waitUntilReady(timeoutSeconds = 180): Promise<void> {
    const { namespace, releaseName } = this.deploymentConfig;
    console.info("[PQCHelper] Waiting for PQC httpd pods...");
    await this.k8sClient.waitForPodsWithFailureDetection(
      namespace,
      `app=${releaseName}`,
      timeoutSeconds,
    );
  }

  /** openssl s_client from the RHDH hub pod against this helper's Service host. */
  runSClientFromRhdhPod(group: TlsGroup): OpensslSClientResult {
    return runOpensslSClientFromRhdhPod({
      namespace: this.deploymentConfig.namespace,
      host: this.getServiceHost(),
      port: this.getServicePort(),
      group,
    });
  }

  private async _applyManifests(): Promise<void> {
    const { namespace, manifestPath } = this.deploymentConfig;
    await $`kubectl apply -f ${manifestPath} -n ${namespace}`;
  }
}
