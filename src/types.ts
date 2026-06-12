export type ProxyProviderType = 'http' | 'file';
export type ProxyType =
  | 'ss'
  | 'vmess'
  | 'vless'
  | 'trojan'
  | 'http'
  | 'socks5'
  | 'hysteria2'
  | 'tuic'
  | 'wireguard';

export type GroupType =
  | 'select'
  | 'url-test'
  | 'fallback'
  | 'load-balance'
  | 'relay';

export type RuleProviderBehavior = 'domain' | 'ipcidr' | 'classical';
export type RuleProviderFormat = 'yaml' | 'text' | 'mrs';
export type RuleKind = 'structured' | 'raw';

export type HealthCheck = {
  enable: boolean;
  url: string;
  interval: number;
  lazy: boolean;
  timeout?: number;
  expectedStatus?: string;
};

export type DefaultConfig = {
  port?: number;
  socksPort?: number;
  mixedPort?: number;
  redirPort?: number;
  tproxyPort?: number;
  allowLan: boolean;
  bindAddress: string;
  mode: 'rule' | 'global' | 'direct';
  logLevel: 'silent' | 'error' | 'warning' | 'info' | 'debug';
  ipv6: boolean;
  unifiedDelay: boolean;
  tcpConcurrent: boolean;
  externalController: string;
  secret: string;
  globalClientFingerprint: string;
  geodataMode: boolean;
  geodataLoader: 'standard' | 'memconservative';
  geoAutoUpdate: boolean;
  geoUpdateInterval: number;
  profileStoreSelected: boolean;
  profileStoreFakeIp: boolean;
  dnsEnable: boolean;
  dnsListen: string;
  dnsEnhancedMode: 'fake-ip' | 'redir-host' | '';
  dnsFakeIpRange: string;
  dnsNameservers: string[];
  extraYaml: string;
};

export type ProxyProvider = {
  id: string;
  name: string;
  type: ProxyProviderType;
  url: string;
  path: string;
  interval: number;
  filter: string;
  excludeFilter: string;
  healthCheck: HealthCheck;
  extraYaml: string;
};

export type ProxyItem = {
  id: string;
  name: string;
  type: ProxyType;
  server: string;
  port?: number;
  username: string;
  password: string;
  cipher: string;
  uuid: string;
  alterId?: number;
  tls: boolean;
  udp: boolean;
  sni: string;
  network: string;
  wsPath: string;
  skipCertVerify: boolean;
  extraYaml: string;
};

export type ProxyGroup = {
  id: string;
  name: string;
  type: GroupType;
  proxies: string[];
  use: string[];
  url: string;
  interval?: number;
  tolerance?: number;
  strategy: 'consistent-hashing' | 'round-robin' | '';
  lazy: boolean;
  disableUdp: boolean;
  includeAll: boolean;
  filter: string;
  excludeFilter: string;
  icon: string;
  extraYaml: string;
};

export type RuleProvider = {
  id: string;
  name: string;
  type: ProxyProviderType;
  behavior: RuleProviderBehavior;
  format: RuleProviderFormat;
  url: string;
  path: string;
  interval: number;
  proxy: string;
  extraYaml: string;
};

export type RuleItem = {
  id: string;
  kind: RuleKind;
  type: string;
  payload: string;
  target: string;
  noResolve: boolean;
  raw: string;
};

export type ConfigDraft = {
  schemaVersion: 1;
  title: string;
  defaultConfig: DefaultConfig;
  proxyProviders: ProxyProvider[];
  proxies: ProxyItem[];
  proxyGroups: ProxyGroup[];
  ruleProviders: RuleProvider[];
  rules: RuleItem[];
  extraTopLevelYaml: string;
  sourceYaml: string;
  updatedAt: string;
};

export type ValidationIssue = {
  level: 'error' | 'warning';
  section: string;
  message: string;
  itemId?: string;
};

export type HistoryRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceYaml: string;
  outputYaml: string;
  draft: ConfigDraft;
};

export type Preferences = {
  activeSection: string;
  previewVisible: boolean;
  lastHistoryId: string | null;
};
