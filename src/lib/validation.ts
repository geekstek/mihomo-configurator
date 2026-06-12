import YAML from 'yaml';
import { z } from 'zod';
import { BUILT_IN_POLICIES } from '../constants';
import type { ConfigDraft, ProxyGroup, ValidationIssue } from '../types';

const portSchema = z.number().int().min(1).max(65535);
const positiveIntSchema = z.number().int().positive();

export function validateDraft(draft: ConfigDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const proxyNames = collectNames(draft.proxies.map((proxy) => proxy.name));
  const groupNames = collectNames(draft.proxyGroups.map((group) => group.name));
  const providerNames = collectNames(draft.proxyProviders.map((provider) => provider.name));
  const ruleProviderNames = collectNames(draft.ruleProviders.map((provider) => provider.name));
  const policyNames = new Set([
    ...BUILT_IN_POLICIES,
    ...proxyNames.names,
    ...groupNames.names,
  ]);

  validateDefault(draft, issues);
  pushDuplicates(issues, '代理提供者', providerNames.duplicates);
  pushDuplicates(issues, '代理', proxyNames.duplicates);
  pushDuplicates(issues, '策略组', groupNames.duplicates);
  pushDuplicates(issues, '规则提供者', ruleProviderNames.duplicates);

  draft.proxyProviders.forEach((provider) => {
    if (!provider.name.trim()) {
      push(issues, 'error', '代理提供者', '名称不能为空', provider.id);
    }

    if (provider.type === 'http' && !provider.url.trim()) {
      push(issues, 'error', '代理提供者', `${nameFor(provider.name)} 需要 URL`, provider.id);
    }

    if (provider.type === 'http' && provider.url.trim() && !isLikelyUrl(provider.url)) {
      push(issues, 'warning', '代理提供者', `${provider.name} 的 URL 看起来不是完整地址`, provider.id);
    }

    if (!positiveIntSchema.safeParse(provider.interval).success) {
      push(issues, 'error', '代理提供者', `${nameFor(provider.name)} 的更新间隔必须是正整数`, provider.id);
    }

    if (provider.healthCheck.enable && !provider.healthCheck.url.trim()) {
      push(issues, 'error', '代理提供者', `${nameFor(provider.name)} 开启健康检查后需要 URL`, provider.id);
    }

    validateExtraYaml(issues, '代理提供者', provider.extraYaml, provider.id);
  });

  draft.proxies.forEach((proxy) => {
    if (!proxy.name.trim()) {
      push(issues, 'error', '代理', '名称不能为空', proxy.id);
    }

    if (!proxy.server.trim()) {
      push(issues, 'error', '代理', `${nameFor(proxy.name)} 需要服务器地址`, proxy.id);
    }

    if (!portSchema.safeParse(proxy.port).success) {
      push(issues, 'error', '代理', `${nameFor(proxy.name)} 需要 1-65535 的端口`, proxy.id);
    }

    if (proxy.type === 'ss' && !proxy.cipher.trim()) {
      push(issues, 'error', '代理', `${nameFor(proxy.name)} 需要 cipher`, proxy.id);
    }

    if (['ss', 'trojan', 'hysteria2'].includes(proxy.type) && !proxy.password.trim()) {
      push(issues, 'warning', '代理', `${nameFor(proxy.name)} 通常需要 password`, proxy.id);
    }

    if (['vmess', 'vless'].includes(proxy.type) && !proxy.uuid.trim()) {
      push(issues, 'error', '代理', `${nameFor(proxy.name)} 需要 UUID`, proxy.id);
    }

    validateExtraYaml(issues, '代理', proxy.extraYaml, proxy.id);
  });

  draft.proxyGroups.forEach((group) => {
    if (!group.name.trim()) {
      push(issues, 'error', '策略组', '名称不能为空', group.id);
    }

    if (!group.includeAll && group.proxies.length === 0 && group.use.length === 0) {
      push(issues, 'error', '策略组', `${nameFor(group.name)} 至少需要一个代理、策略组或 provider`, group.id);
    }

    if (group.type === 'relay' && group.proxies.length < 2) {
      push(issues, 'warning', '策略组', `${nameFor(group.name)} 的 relay 通常至少需要两个节点`, group.id);
    }

    if (needsHealthCheck(group) && !group.url.trim()) {
      push(issues, 'error', '策略组', `${nameFor(group.name)} 需要测试 URL`, group.id);
    }

    group.proxies.forEach((policy) => {
      if (!policyNames.has(policy)) {
        push(issues, 'error', '策略组', `${nameFor(group.name)} 引用了不存在的策略：${policy}`, group.id);
      }
    });

    group.use.forEach((provider) => {
      if (!providerNames.names.has(provider)) {
        push(issues, 'error', '策略组', `${nameFor(group.name)} 引用了不存在的代理提供者：${provider}`, group.id);
      }
    });

    validateExtraYaml(issues, '策略组', group.extraYaml, group.id);
  });

  detectGroupCycles(draft.proxyGroups).forEach((cycle) => {
    push(issues, 'error', '策略组', `策略组存在循环引用：${cycle.join(' → ')}`);
  });

  draft.ruleProviders.forEach((provider) => {
    if (!provider.name.trim()) {
      push(issues, 'error', '规则提供者', '名称不能为空', provider.id);
    }

    if (provider.type === 'http' && !provider.url.trim()) {
      push(issues, 'error', '规则提供者', `${nameFor(provider.name)} 需要 URL`, provider.id);
    }

    if (provider.type === 'http' && provider.url.trim() && !isLikelyUrl(provider.url)) {
      push(issues, 'warning', '规则提供者', `${provider.name} 的 URL 看起来不是完整地址`, provider.id);
    }

    if (provider.format === 'mrs' && provider.behavior === 'classical') {
      push(issues, 'error', '规则提供者', `${nameFor(provider.name)} 的 MRS 格式只支持 domain 或 ipcidr`, provider.id);
    }

    if (!positiveIntSchema.safeParse(provider.interval).success) {
      push(issues, 'error', '规则提供者', `${nameFor(provider.name)} 的更新间隔必须是正整数`, provider.id);
    }

    if (provider.proxy && !policyNames.has(provider.proxy)) {
      push(issues, 'error', '规则提供者', `${nameFor(provider.name)} 使用了不存在的下载策略：${provider.proxy}`, provider.id);
    }

    validateExtraYaml(issues, '规则提供者', provider.extraYaml, provider.id);
  });

  draft.rules.forEach((rule) => {
    if (rule.kind === 'raw') {
      if (!rule.raw.trim()) {
        push(issues, 'warning', '规则', '空的原始规则会被忽略', rule.id);
      }

      return;
    }

    if (!rule.type.trim()) {
      push(issues, 'error', '规则', '规则类型不能为空', rule.id);
    }

    if (rule.type !== 'MATCH' && !rule.payload.trim()) {
      push(issues, 'error', '规则', `${rule.type} 需要匹配内容`, rule.id);
    }

    if (!rule.target.trim()) {
      push(issues, 'error', '规则', `${rule.type} 需要目标策略`, rule.id);
    } else if (!policyNames.has(rule.target)) {
      push(issues, 'error', '规则', `${rule.type} 使用了不存在的目标策略：${rule.target}`, rule.id);
    }

    if (rule.type === 'RULE-SET' && !ruleProviderNames.names.has(rule.payload)) {
      push(issues, 'error', '规则', `RULE-SET 引用了不存在的规则提供者：${rule.payload}`, rule.id);
    }
  });

  validateExtraYaml(issues, '基础', draft.defaultConfig.extraYaml);
  validateExtraYaml(issues, '额外顶层', draft.extraTopLevelYaml);

  return issues;
}

function validateDefault(draft: ConfigDraft, issues: ValidationIssue[]): void {
  const ports = [
    ['HTTP 端口', draft.defaultConfig.port],
    ['SOCKS 端口', draft.defaultConfig.socksPort],
    ['Mixed 端口', draft.defaultConfig.mixedPort],
    ['Redir 端口', draft.defaultConfig.redirPort],
    ['TProxy 端口', draft.defaultConfig.tproxyPort],
  ] as const;

  ports.forEach(([label, port]) => {
    if (port !== undefined && !portSchema.safeParse(port).success) {
      push(issues, 'error', '基础', `${label} 必须在 1-65535 之间`);
    }
  });

  if (draft.defaultConfig.geoUpdateInterval <= 0) {
    push(issues, 'error', '基础', 'Geo 更新间隔必须是正整数');
  }

  if (draft.defaultConfig.dnsEnable && draft.defaultConfig.dnsNameservers.length === 0) {
    push(issues, 'warning', '基础', 'DNS 已启用但没有 nameserver');
  }
}

function collectNames(values: string[]): { names: Set<string>; duplicates: string[] } {
  const names = new Set<string>();
  const duplicates = new Set<string>();

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      if (names.has(value)) {
        duplicates.add(value);
      }

      names.add(value);
    });

  return { names, duplicates: [...duplicates] };
}

function pushDuplicates(issues: ValidationIssue[], section: string, duplicates: string[]): void {
  duplicates.forEach((name) => {
    push(issues, 'error', section, `名称重复：${name}`);
  });
}

function detectGroupCycles(groups: ProxyGroup[]): string[][] {
  const groupNames = new Set(groups.map((group) => group.name).filter(Boolean));
  const graph = new Map<string, string[]>();

  groups.forEach((group) => {
    graph.set(group.name, group.proxies.filter((proxy) => groupNames.has(proxy)));
  });

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (name: string, path: string[]): void => {
    if (visiting.has(name)) {
      const start = path.indexOf(name);
      cycles.push([...path.slice(start), name]);
      return;
    }

    if (visited.has(name)) {
      return;
    }

    visiting.add(name);
    graph.get(name)?.forEach((next) => visit(next, [...path, next]));
    visiting.delete(name);
    visited.add(name);
  };

  [...groupNames].forEach((name) => visit(name, [name]));

  return cycles;
}

function validateExtraYaml(
  issues: ValidationIssue[],
  section: string,
  yaml: string,
  itemId?: string,
): void {
  if (!yaml.trim()) {
    return;
  }

  try {
    const parsed = YAML.parse(yaml);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      push(issues, 'error', section, '高级 YAML 必须是对象', itemId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法解析高级 YAML';
    push(issues, 'error', section, `高级 YAML 无法解析：${message}`, itemId);
  }
}

function push(
  issues: ValidationIssue[],
  level: ValidationIssue['level'],
  section: string,
  message: string,
  itemId?: string,
): void {
  issues.push({ level, section, message, itemId });
}

function nameFor(name: string): string {
  return name.trim() || '未命名项';
}

function needsHealthCheck(group: ProxyGroup): boolean {
  return ['url-test', 'fallback', 'load-balance'].includes(group.type);
}

function isLikelyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
