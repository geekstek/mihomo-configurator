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

export type RuleProviderTemplate = {
  id: string;
  label: string;
  name: string;
  behavior: RuleProviderBehavior;
  format: RuleProviderFormat;
  url: string;
  path: string;
};

const META_GEOSITE_BASE = 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite';

export const RULE_PROVIDER_TEMPLATES: RuleProviderTemplate[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    name: 'openai',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/metacubex/meta-rules-dat/refs/heads/meta/geo/geosite/openai.mrs',
    path: './ruleset/openai.mrs',
  },
  {
    id: 'anthropic',
    label: 'Anthropic / Claude',
    name: 'anthropic',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/anthropic.mrs`,
    path: './ruleset/anthropic.mrs',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    name: 'perplexity',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/perplexity.mrs`,
    path: './ruleset/perplexity.mrs',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    name: 'google-gemini',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/google-gemini.mrs`,
    path: './ruleset/google-gemini.mrs',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    name: 'youtube',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/youtube.mrs`,
    path: './ruleset/youtube.mrs',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    name: 'telegram',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/telegram.mrs`,
    path: './ruleset/telegram.mrs',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    name: 'whatsapp',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/whatsapp.mrs`,
    path: './ruleset/whatsapp.mrs',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    name: 'facebook',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/facebook.mrs`,
    path: './ruleset/facebook.mrs',
  },
  {
    id: 'google',
    label: 'Google',
    name: 'google',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/google.mrs`,
    path: './ruleset/google.mrs',
  },
  {
    id: 'github',
    label: 'GitHub',
    name: 'github',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/github.mrs`,
    path: './ruleset/github.mrs',
  },
  {
    id: 'x',
    label: 'X / Twitter',
    name: 'x',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/twitter.mrs`,
    path: './ruleset/twitter.mrs',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    name: 'instagram',
    behavior: 'domain',
    format: 'mrs',
    url: `${META_GEOSITE_BASE}/instagram.mrs`,
    path: './ruleset/instagram.mrs',
  },
  {
    id: 'category-ads-all',
    label: 'Ads 全量',
    name: 'category-ads-all',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://gh-proxy.com/github.com/metacubex/meta-rules-dat/raw/refs/heads/meta/geo/geosite/category-ads-all.mrs',
    path: './ruleset/category-ads-all.mrs',
  },
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
