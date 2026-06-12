import type { GroupType, ProxyType, RuleProviderBehavior, RuleProviderFormat } from './types';

export const BUILT_IN_POLICIES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'GLOBAL'] as const;

export const PROXY_TYPES: Array<{ value: ProxyType; label: string }> = [
  { value: 'ss', label: 'Shadowsocks' },
  { value: 'vmess', label: 'VMess' },
  { value: 'vless', label: 'VLESS' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'http', label: 'HTTP' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'hysteria2', label: 'Hysteria2' },
  { value: 'tuic', label: 'TUIC' },
  { value: 'wireguard', label: 'WireGuard' },
];

export const GROUP_TYPES: Array<{ value: GroupType; label: string }> = [
  { value: 'select', label: 'Select' },
  { value: 'url-test', label: 'URL Test' },
  { value: 'fallback', label: 'Fallback' },
  { value: 'load-balance', label: 'Load Balance' },
  { value: 'relay', label: 'Relay' },
];

export const RULE_PROVIDER_BEHAVIORS: Array<{ value: RuleProviderBehavior; label: string }> = [
  { value: 'domain', label: 'Domain' },
  { value: 'ipcidr', label: 'IP CIDR' },
  { value: 'classical', label: 'Classical' },
];

export const RULE_PROVIDER_FORMATS: Array<{ value: RuleProviderFormat; label: string }> = [
  { value: 'yaml', label: 'YAML' },
  { value: 'text', label: 'Text' },
  { value: 'mrs', label: 'MRS' },
];

export const RULE_TYPES = [
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-REGEX',
  'GEOSITE',
  'IP-CIDR',
  'IP-CIDR6',
  'IP-ASN',
  'GEOIP',
  'SRC-IP-CIDR',
  'SRC-PORT',
  'DST-PORT',
  'PROCESS-NAME',
  'PROCESS-PATH',
  'PROCESS-PATH-REGEX',
  'RULE-SET',
  'MATCH',
] as const;

export const SECTIONS = [
  { id: 'import', label: '导入' },
  { id: 'default', label: '基础' },
  { id: 'proxy-providers', label: '代理提供者' },
  { id: 'proxies', label: '代理' },
  { id: 'proxy-groups', label: '策略组' },
  { id: 'rule-providers', label: '规则提供者' },
  { id: 'rules', label: '规则' },
  { id: 'history', label: '历史' },
] as const;

export const HISTORY_LIMIT = 60;
