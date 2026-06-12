import YAML from 'yaml';
import type {
  ConfigDraft,
  DefaultConfig,
  GroupType,
  ProxyGroup,
  ProxyItem,
  ProxyProvider,
  ProxyProviderType,
  ProxyType,
  RuleItem,
  RuleProvider,
  RuleProviderBehavior,
  RuleProviderFormat,
} from '../types';
import {
  createEmptyDraft,
  createProxy,
  createProxyGroup,
  createProxyProvider,
  createRule,
  createRuleProvider,
} from './defaultDraft';

const SECTION_KEYS = ['proxy-providers', 'proxies', 'proxy-groups', 'rule-providers', 'rules'];
const DEFAULT_KEYS = [
  'port',
  'socks-port',
  'mixed-port',
  'redir-port',
  'tproxy-port',
  'allow-lan',
  'bind-address',
  'mode',
  'log-level',
  'ipv6',
  'unified-delay',
  'tcp-concurrent',
  'external-controller',
  'secret',
  'global-client-fingerprint',
  'geodata-mode',
  'geodata-loader',
  'geo-auto-update',
  'geo-update-interval',
  'profile',
  'dns',
];

const PROXY_PROVIDER_KEYS = [
  'type',
  'url',
  'path',
  'interval',
  'filter',
  'exclude-filter',
  'health-check',
];

const PROXY_KEYS = [
  'name',
  'type',
  'server',
  'port',
  'username',
  'password',
  'cipher',
  'uuid',
  'alterId',
  'alter-id',
  'tls',
  'udp',
  'sni',
  'servername',
  'network',
  'skip-cert-verify',
];

const GROUP_KEYS = [
  'name',
  'type',
  'proxies',
  'use',
  'url',
  'interval',
  'tolerance',
  'strategy',
  'lazy',
  'disable-udp',
  'include-all',
  'filter',
  'exclude-filter',
  'icon',
];

const RULE_PROVIDER_KEYS = [
  'type',
  'behavior',
  'format',
  'url',
  'path',
  'interval',
  'proxy',
];

const PROVIDER_TYPES = ['http', 'file'] as const satisfies readonly ProxyProviderType[];
const PROXY_TYPES = [
  'ss',
  'vmess',
  'vless',
  'trojan',
  'http',
  'socks5',
  'hysteria2',
  'tuic',
  'wireguard',
] as const satisfies readonly ProxyType[];
const GROUP_TYPES = ['select', 'url-test', 'fallback', 'load-balance', 'relay'] as const satisfies readonly GroupType[];
const GROUP_STRATEGIES = ['consistent-hashing', 'round-robin', ''] as const;
const RULE_PROVIDER_BEHAVIORS = ['domain', 'ipcidr', 'classical'] as const satisfies readonly RuleProviderBehavior[];
const RULE_PROVIDER_FORMATS = ['yaml', 'text', 'mrs'] as const satisfies readonly RuleProviderFormat[];

export function draftToYaml(draft: ConfigDraft): string {
  const extraTopLevel = parseYamlObject(draft.extraTopLevelYaml);
  const extraDefault = parseYamlObject(draft.defaultConfig.extraYaml);

  const output = deepMerge(
    deepMerge(extraTopLevel, defaultToYamlObject(draft.defaultConfig)),
    extraDefault,
  );

  const proxyProviders = objectFromNamedItems(
    draft.proxyProviders,
    (provider) => provider.name,
    providerToYamlObject,
  );
  const ruleProviders = objectFromNamedItems(
    draft.ruleProviders,
    (provider) => provider.name,
    ruleProviderToYamlObject,
  );

  if (Object.keys(proxyProviders).length > 0) {
    output['proxy-providers'] = proxyProviders;
  } else {
    delete output['proxy-providers'];
  }

  const proxies = draft.proxies
    .filter((proxy) => proxy.name.trim() !== '')
    .map(proxyToYamlObject);

  if (proxies.length > 0) {
    output.proxies = proxies;
  } else {
    delete output.proxies;
  }

  const proxyGroups = draft.proxyGroups
    .filter((group) => group.name.trim() !== '')
    .map(groupToYamlObject);

  if (proxyGroups.length > 0) {
    output['proxy-groups'] = proxyGroups;
  } else {
    delete output['proxy-groups'];
  }

  if (Object.keys(ruleProviders).length > 0) {
    output['rule-providers'] = ruleProviders;
  } else {
    delete output['rule-providers'];
  }

  const rules = draft.rules
    .map(ruleToString)
    .filter((rule) => rule.trim() !== '');

  if (rules.length > 0) {
    output.rules = rules;
  } else {
    delete output.rules;
  }

  return YAML.stringify(output, {
    lineWidth: 0,
    minContentWidth: 0,
    collectionStyle: 'block',
  });
}

export function yamlToDraft(sourceYaml: string): ConfigDraft {
  const parsed = YAML.parse(sourceYaml) ?? {};

  if (!isRecord(parsed)) {
    throw new Error('YAML 顶层必须是对象');
  }

  const draft = createEmptyDraft();
  draft.sourceYaml = sourceYaml;
  draft.defaultConfig = yamlObjectToDefault(parsed, draft.defaultConfig);
  draft.proxyProviders = parseProxyProviders(parsed['proxy-providers']);
  draft.proxies = parseProxies(parsed.proxies);
  draft.proxyGroups = parseProxyGroups(parsed['proxy-groups']);
  draft.ruleProviders = parseRuleProviders(parsed['rule-providers']);
  draft.rules = parseRules(parsed.rules);
  draft.extraTopLevelYaml = stringifyExtra(omitKeys(parsed, [...SECTION_KEYS, ...DEFAULT_KEYS]));
  draft.updatedAt = new Date().toISOString();

  return draft;
}

function defaultToYamlObject(config: DefaultConfig): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  setNumber(output, 'port', config.port);
  setNumber(output, 'socks-port', config.socksPort);
  setNumber(output, 'mixed-port', config.mixedPort);
  setNumber(output, 'redir-port', config.redirPort);
  setNumber(output, 'tproxy-port', config.tproxyPort);
  output['allow-lan'] = config.allowLan;
  setString(output, 'bind-address', config.bindAddress);
  output.mode = config.mode;
  output['log-level'] = config.logLevel;
  output.ipv6 = config.ipv6;
  output['unified-delay'] = config.unifiedDelay;
  output['tcp-concurrent'] = config.tcpConcurrent;
  setString(output, 'external-controller', config.externalController);
  setString(output, 'secret', config.secret);
  setString(output, 'global-client-fingerprint', config.globalClientFingerprint);
  output['geodata-mode'] = config.geodataMode;
  output['geodata-loader'] = config.geodataLoader;
  output['geo-auto-update'] = config.geoAutoUpdate;
  setNumber(output, 'geo-update-interval', config.geoUpdateInterval);
  output.profile = {
    'store-selected': config.profileStoreSelected,
    'store-fake-ip': config.profileStoreFakeIp,
  };

  if (config.dnsEnable || config.dnsListen || config.dnsNameservers.length > 0) {
    output.dns = stripEmpty({
      enable: config.dnsEnable,
      listen: config.dnsListen,
      'enhanced-mode': config.dnsEnhancedMode || undefined,
      'fake-ip-range': config.dnsFakeIpRange || undefined,
      nameserver: config.dnsNameservers.filter(Boolean),
    });
  }

  return stripEmpty(output);
}

function providerToYamlObject(provider: ProxyProvider): Record<string, unknown> {
  const base = parseYamlObject(provider.extraYaml);
  const output = stripEmpty({
    type: provider.type,
    url: provider.type === 'http' ? provider.url : undefined,
    path: provider.path,
    interval: provider.interval,
    filter: provider.filter || undefined,
    'exclude-filter': provider.excludeFilter || undefined,
    'health-check': stripEmpty({
      enable: provider.healthCheck.enable,
      url: provider.healthCheck.url,
      interval: provider.healthCheck.interval,
      lazy: provider.healthCheck.lazy,
      timeout: provider.healthCheck.timeout,
      'expected-status': provider.healthCheck.expectedStatus || undefined,
    }),
  });

  return deepMerge(base, output);
}

function proxyToYamlObject(proxy: ProxyItem): Record<string, unknown> {
  const base = parseYamlObject(proxy.extraYaml);
  const output = stripEmpty({
    name: proxy.name,
    type: proxy.type,
    server: proxy.server,
    port: proxy.port,
    username: proxy.username || undefined,
    password: proxy.password || undefined,
    cipher: proxy.cipher || undefined,
    uuid: proxy.uuid || undefined,
    alterId: proxy.alterId,
    tls: proxy.tls || undefined,
    udp: proxy.udp,
    sni: proxy.sni || undefined,
    servername: proxy.sni || undefined,
    network: proxy.network || undefined,
    'skip-cert-verify': proxy.skipCertVerify || undefined,
    'ws-opts': proxy.wsPath ? { path: proxy.wsPath } : undefined,
  });

  return deepMerge(base, output);
}

function groupToYamlObject(group: ProxyGroup): Record<string, unknown> {
  const base = parseYamlObject(group.extraYaml);
  const output = stripEmpty({
    name: group.name,
    type: group.type,
    proxies: group.proxies.filter(Boolean),
    use: group.use.filter(Boolean),
    url: needsHealthCheck(group.type) ? group.url : undefined,
    interval: needsHealthCheck(group.type) ? group.interval : undefined,
    tolerance: group.type === 'url-test' ? group.tolerance : undefined,
    strategy: group.type === 'load-balance' && group.strategy ? group.strategy : undefined,
    lazy: needsHealthCheck(group.type) ? group.lazy : undefined,
    'disable-udp': group.disableUdp || undefined,
    'include-all': group.includeAll || undefined,
    filter: group.filter || undefined,
    'exclude-filter': group.excludeFilter || undefined,
    icon: group.icon || undefined,
  });

  return deepMerge(base, output);
}

function ruleProviderToYamlObject(provider: RuleProvider): Record<string, unknown> {
  const base = parseYamlObject(provider.extraYaml);
  const output = stripEmpty({
    type: provider.type,
    behavior: provider.behavior,
    format: provider.format,
    url: provider.type === 'http' ? provider.url : undefined,
    path: provider.path,
    interval: provider.interval,
    proxy: provider.proxy || undefined,
  });

  return deepMerge(base, output);
}

function ruleToString(rule: RuleItem): string {
  if (rule.kind === 'raw') {
    return rule.raw.trim();
  }

  const type = rule.type.trim().toUpperCase();
  const target = rule.target.trim();

  if (!type || !target) {
    return '';
  }

  if (type === 'MATCH') {
    return `MATCH,${target}`;
  }

  const parts = [type, rule.payload.trim(), target].filter(Boolean);

  if (rule.noResolve) {
    parts.push('no-resolve');
  }

  return parts.join(',');
}

function yamlObjectToDefault(source: Record<string, unknown>, fallback: DefaultConfig): DefaultConfig {
  const profile = isRecord(source.profile) ? source.profile : {};
  const dns = isRecord(source.dns) ? source.dns : {};

  return {
    ...fallback,
    port: numberOrUndefined(source.port, fallback.port),
    socksPort: numberOrUndefined(source['socks-port'], fallback.socksPort),
    mixedPort: numberOrUndefined(source['mixed-port'], fallback.mixedPort),
    redirPort: numberOrUndefined(source['redir-port'], fallback.redirPort),
    tproxyPort: numberOrUndefined(source['tproxy-port'], fallback.tproxyPort),
    allowLan: boolOr(source['allow-lan'], fallback.allowLan),
    bindAddress: stringOr(source['bind-address'], fallback.bindAddress),
    mode: enumOr(source.mode, ['rule', 'global', 'direct'], fallback.mode),
    logLevel: enumOr(source['log-level'], ['silent', 'error', 'warning', 'info', 'debug'], fallback.logLevel),
    ipv6: boolOr(source.ipv6, fallback.ipv6),
    unifiedDelay: boolOr(source['unified-delay'], fallback.unifiedDelay),
    tcpConcurrent: boolOr(source['tcp-concurrent'], fallback.tcpConcurrent),
    externalController: stringOr(source['external-controller'], fallback.externalController),
    secret: stringOr(source.secret, fallback.secret),
    globalClientFingerprint: stringOr(
      source['global-client-fingerprint'],
      fallback.globalClientFingerprint,
    ),
    geodataMode: boolOr(source['geodata-mode'], fallback.geodataMode),
    geodataLoader: enumOr(source['geodata-loader'], ['standard', 'memconservative'], fallback.geodataLoader),
    geoAutoUpdate: boolOr(source['geo-auto-update'], fallback.geoAutoUpdate),
    geoUpdateInterval: numberOrUndefined(source['geo-update-interval'], fallback.geoUpdateInterval) ?? fallback.geoUpdateInterval,
    profileStoreSelected: boolOr(profile['store-selected'], fallback.profileStoreSelected),
    profileStoreFakeIp: boolOr(profile['store-fake-ip'], fallback.profileStoreFakeIp),
    dnsEnable: boolOr(dns.enable, fallback.dnsEnable),
    dnsListen: stringOr(dns.listen, fallback.dnsListen),
    dnsEnhancedMode: enumOr(dns['enhanced-mode'], ['fake-ip', 'redir-host', ''], fallback.dnsEnhancedMode),
    dnsFakeIpRange: stringOr(dns['fake-ip-range'], fallback.dnsFakeIpRange),
    dnsNameservers: arrayOfStrings(dns.nameserver, fallback.dnsNameservers),
    extraYaml: '',
  };
}

function parseProxyProviders(value: unknown): ProxyProvider[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([, item]) => isRecord(item))
    .map(([name, item]) => {
      const data = item as Record<string, unknown>;
      const health = isRecord(data['health-check']) ? data['health-check'] : {};

      return createProxyProvider({
        name,
        type: enumOr(data.type, PROVIDER_TYPES, 'http'),
        url: stringOr(data.url, ''),
        path: stringOr(data.path, ''),
        interval: numberOrUndefined(data.interval, 86400) ?? 86400,
        filter: stringOr(data.filter, ''),
        excludeFilter: stringOr(data['exclude-filter'], ''),
        healthCheck: {
          enable: boolOr(health.enable, true),
          url: stringOr(health.url, 'https://www.gstatic.com/generate_204'),
          interval: numberOrUndefined(health.interval, 300) ?? 300,
          lazy: boolOr(health.lazy, true),
          timeout: numberOrUndefined(health.timeout, undefined),
          expectedStatus: stringOr(health['expected-status'], ''),
        },
        extraYaml: stringifyExtra(omitKeys(data, PROXY_PROVIDER_KEYS)),
      });
    });
}

function parseProxies(value: unknown): ProxyItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => createProxy({
      name: stringOr(item.name, ''),
      type: enumOr(item.type, PROXY_TYPES, 'ss'),
      server: stringOr(item.server, ''),
      port: numberOrUndefined(item.port, undefined),
      username: stringOr(item.username, ''),
      password: stringOr(item.password, ''),
      cipher: stringOr(item.cipher, ''),
      uuid: stringOr(item.uuid, ''),
      alterId: numberOrUndefined(item.alterId ?? item['alter-id'], undefined),
      tls: boolOr(item.tls, false),
      udp: boolOr(item.udp, true),
      sni: stringOr(item.sni ?? item.servername, ''),
      network: stringOr(item.network, ''),
      wsPath: isRecord(item['ws-opts']) ? stringOr(item['ws-opts'].path, '') : '',
      skipCertVerify: boolOr(item['skip-cert-verify'], false),
      extraYaml: stringifyExtra(omitKeys(item, PROXY_KEYS)),
    }));
}

function parseProxyGroups(value: unknown): ProxyGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => createProxyGroup({
      name: stringOr(item.name, ''),
      type: enumOr(item.type, GROUP_TYPES, 'select'),
      proxies: arrayOfStrings(item.proxies, []),
      use: arrayOfStrings(item.use, []),
      url: stringOr(item.url, 'https://www.gstatic.com/generate_204'),
      interval: numberOrUndefined(item.interval, 300),
      tolerance: numberOrUndefined(item.tolerance, 50),
      strategy: enumOr(item.strategy, GROUP_STRATEGIES, ''),
      lazy: boolOr(item.lazy, true),
      disableUdp: boolOr(item['disable-udp'], false),
      includeAll: boolOr(item['include-all'], false),
      filter: stringOr(item.filter, ''),
      excludeFilter: stringOr(item['exclude-filter'], ''),
      icon: stringOr(item.icon, ''),
      extraYaml: stringifyExtra(omitKeys(item, GROUP_KEYS)),
    }));
}

function parseRuleProviders(value: unknown): RuleProvider[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([, item]) => isRecord(item))
    .map(([name, item]) => {
      const data = item as Record<string, unknown>;

      return createRuleProvider({
        name,
        type: enumOr(data.type, PROVIDER_TYPES, 'http'),
        behavior: enumOr(data.behavior, RULE_PROVIDER_BEHAVIORS, 'classical'),
        format: enumOr(data.format, RULE_PROVIDER_FORMATS, 'yaml'),
        url: stringOr(data.url, ''),
        path: stringOr(data.path, ''),
        interval: numberOrUndefined(data.interval, 86400) ?? 86400,
        proxy: stringOr(data.proxy, ''),
        extraYaml: stringifyExtra(omitKeys(data, RULE_PROVIDER_KEYS)),
      });
    });
}

function parseRules(value: unknown): RuleItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(parseRuleString);
}

function parseRuleString(rawRule: string): RuleItem {
  const parts = rawRule.split(',').map((part) => part.trim());
  const type = (parts[0] ?? '').toUpperCase();

  if (parts.length < 2 || !type) {
    return createRule({ kind: 'raw', raw: rawRule });
  }

  if (type === 'MATCH') {
    return createRule({
      kind: 'structured',
      type,
      payload: '',
      target: parts[1] ?? '',
      noResolve: parts.includes('no-resolve'),
      raw: rawRule,
    });
  }

  if (parts.length < 3) {
    return createRule({ kind: 'raw', raw: rawRule });
  }

  return createRule({
    kind: 'structured',
    type,
    payload: parts[1] ?? '',
    target: parts[2] ?? '',
    noResolve: parts.slice(3).includes('no-resolve'),
    raw: rawRule,
  });
}

function objectFromNamedItems<T>(
  items: T[],
  getName: (item: T) => string,
  toYamlObject: (item: T) => Record<string, unknown>,
): Record<string, unknown> {
  return items.reduce<Record<string, unknown>>((result, item) => {
    const name = getName(item).trim();

    if (name) {
      result[name] = toYamlObject(item);
    }

    return result;
  }, {});
}

function parseYamlObject(value: string): Record<string, unknown> {
  if (!value.trim()) {
    return {};
  }

  const parsed = YAML.parse(value);

  if (!isRecord(parsed)) {
    return {};
  }

  return parsed;
}

function stringifyExtra(value: Record<string, unknown>): string {
  if (Object.keys(value).length === 0) {
    return '';
  }

  return YAML.stringify(value, { lineWidth: 0 }).trim();
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    const existing = output[key];

    if (isRecord(existing) && isRecord(value)) {
      output[key] = deepMerge(existing, value);
      return;
    }

    output[key] = value;
  });

  return stripEmpty(output);
}

function omitKeys(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const keySet = new Set(keys);

  return Object.fromEntries(Object.entries(source).filter(([key]) => !keySet.has(key)));
}

function stripEmpty<T extends Record<string, unknown>>(source: T): T {
  const output: Record<string, unknown> = {};

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      return;
    }

    if (isRecord(value)) {
      const nested = stripEmpty(value);

      if (Object.keys(nested).length === 0) {
        return;
      }

      output[key] = nested;
      return;
    }

    output[key] = value;
  });

  return output as T;
}

function setNumber(output: Record<string, unknown>, key: string, value?: number): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    output[key] = value;
  }
}

function setString(output: Record<string, unknown>, key: string, value: string): void {
  if (value.trim() !== '') {
    output[key] = value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function enumOr<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && options.includes(value as T) ? value as T : fallback;
}

function numberOrUndefined(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return fallback;
}

function arrayOfStrings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function needsHealthCheck(type: string): boolean {
  return type === 'url-test' || type === 'fallback' || type === 'load-balance';
}
