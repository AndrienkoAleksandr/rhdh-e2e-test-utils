import path from "node:path";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../../..");

export const PQ_HTTPD_NAME = "pq-httpd";
export const PQ_HTTPD_HTTPS_PORT = 8443;

export const DEFAULT_CONFIG_PATHS = {
  httpdManifest: path.join(
    PACKAGE_ROOT,
    "dist/deployment/pqc/config/httpd.yaml",
  ),
};

export const TLS_GROUPS = {
  classical: "X25519",
  hybrid: "X25519MLKEM768",
} as const;

export type TlsGroup = (typeof TLS_GROUPS)[keyof typeof TLS_GROUPS];
