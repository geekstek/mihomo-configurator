import type {
  ConfigDraft,
  ProxyGroup,
  ProxyItem,
  ProxyProvider,
  RuleItem,
  RuleProvider,
} from '../types';
import { createId } from './id';

export function createEmptyDraft(): ConfigDraft {
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    title: 'mihomo-config',
    defaultConfig: {
      port: 7890,
      socksPort: 7891,
      mixedPort: undefined,
      redirPort: undefined,
      tproxyPort: undefined,
      allowLan: false,
      bindAddress: '*',
      mode: 'rule',
      logLevel: 'info',
      ipv6: false,
      unifiedDelay: true,
      tcpConcurrent: true,
      externalController: '127.0.0.1:9090',
      secret: '',
      globalClientFingerprint: 'chrome',
      geodataMode: false,
      geodataLoader: 'standard',
      geoAutoUpdate: true,
      geoUpdateInterval: 24,
      profileStoreSelected: true,
      profileStoreFakeIp: true,
      dnsEnable: true,
      dnsListen: '0.0.0.0:1053',
      dnsEnhancedMode: 'fake-ip',
      dnsFakeIpRange: '198.18.0.1/16',
      dnsNameservers: ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
      extraYaml: '',
    },
    proxyProviders: [],
    proxies: [],
    proxyGroups: [
      createProxyGroup({
        name: 'PROXY',
        type: 'select',
        proxies: ['DIRECT'],
      }),
      createProxyGroup({
        name: 'AUTO',
        type: 'url-test',
        proxies: ['PROXY'],
      }),
    ],
    ruleProviders: [],
    rules: [
      createRule({ type: 'GEOIP', payload: 'LAN', target: 'DIRECT', noResolve: true }),
      createRule({ type: 'MATCH', target: 'PROXY' }),
    ],
    extraTopLevelYaml: '',
    sourceYaml: '',
    updatedAt: now,
  };
}

export function createProxyProvider(partial: Partial<ProxyProvider> = {}): ProxyProvider {
  return {
    id: createId('provider'),
    name: '',
    type: 'http',
    url: '',
    path: '',
    interval: 86400,
    filter: '',
    excludeFilter: '',
    healthCheck: {
      enable: true,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      lazy: true,
    },
    extraYaml: '',
    ...partial,
  };
}

export function createProxy(partial: Partial<ProxyItem> = {}): ProxyItem {
  return {
    id: createId('proxy'),
    name: '',
    type: 'ss',
    server: '',
    port: undefined,
    username: '',
    password: '',
    cipher: 'aes-128-gcm',
    uuid: '',
    alterId: undefined,
    tls: false,
    udp: true,
    sni: '',
    network: '',
    wsPath: '',
    skipCertVerify: false,
    extraYaml: '',
    ...partial,
  };
}

export function createProxyGroup(partial: Partial<ProxyGroup> = {}): ProxyGroup {
  return {
    id: createId('group'),
    name: '',
    type: 'select',
    proxies: [],
    use: [],
    url: 'https://www.gstatic.com/generate_204',
    interval: 300,
    tolerance: 50,
    strategy: '',
    lazy: true,
    disableUdp: false,
    includeAll: false,
    filter: '',
    excludeFilter: '',
    icon: '',
    extraYaml: '',
    ...partial,
  };
}

export function createRuleProvider(partial: Partial<RuleProvider> = {}): RuleProvider {
  return {
    id: createId('ruleProvider'),
    name: '',
    type: 'http',
    behavior: 'classical',
    format: 'yaml',
    url: '',
    path: '',
    interval: 86400,
    proxy: '',
    extraYaml: '',
    ...partial,
  };
}

export function createRule(partial: Partial<RuleItem> = {}): RuleItem {
  return {
    id: createId('rule'),
    kind: 'structured',
    type: 'DOMAIN-SUFFIX',
    payload: '',
    target: 'DIRECT',
    noResolve: false,
    raw: '',
    ...partial,
  };
}
