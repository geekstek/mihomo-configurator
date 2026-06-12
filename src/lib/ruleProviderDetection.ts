import YAML from 'yaml';
import type { RuleProviderBehavior, RuleProviderFormat } from '../types';

export type RuleProviderDetectionStatus =
  | 'ok'
  | 'http-error'
  | 'cors-or-network'
  | 'timeout'
  | 'invalid-url';

export type RuleProviderDetectionResult = {
  status: RuleProviderDetectionStatus;
  message: string;
  detail?: string;
  statusCode?: number;
  normalizedUrl?: string;
  format?: RuleProviderFormat;
  behavior?: RuleProviderBehavior;
  name?: string;
  path?: string;
  confidence: 'high' | 'medium' | 'low';
};

const READ_LIMIT = 256 * 1024;
const TIMEOUT_MS = 9000;
const TEXT_EXTENSIONS = new Set(['txt', 'text', 'list']);
const YAML_EXTENSIONS = new Set(['yaml', 'yml']);
const CLASSICAL_RULE_PREFIXES = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-REGEX',
  'DOMAIN-WILDCARD',
  'GEOSITE',
  'IP-CIDR',
  'IP-CIDR6',
  'IP-ASN',
  'GEOIP',
  'SRC-IP-CIDR',
  'SRC-IP-CIDR6',
  'SRC-PORT',
  'DST-PORT',
  'PROCESS-NAME',
  'PROCESS-PATH',
  'PROCESS-PATH-REGEX',
  'IN-TYPE',
  'NETWORK',
  'UID',
  'AND',
  'OR',
  'NOT',
]);

export async function detectRuleProviderUrl(url: string): Promise<RuleProviderDetectionResult> {
  const parsed = parseUrl(url);

  if (!parsed) {
    return {
      status: 'invalid-url',
      message: 'URL 格式不完整',
      confidence: 'low',
    };
  }

  const normalized = normalizeDownloadUrl(parsed);
  const fromUrl = inferFromUrl(normalized);
  const normalizedUrl = normalized.href === parsed.href ? undefined : normalized.href;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(normalized.href, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ...fromUrl,
        status: 'http-error',
        statusCode: response.status,
        message: `HTTP ${response.status}`,
        detail: response.statusText || undefined,
        confidence: fromUrl.confidence,
      };
    }

    const bytes = await readResponseStart(response);
    const contentType = response.headers.get('content-type') ?? '';
    const fromContent = inferFromContent(bytes, contentType, fromUrl.format);
    const merged = mergeInference(fromUrl, fromContent);

    return {
      ...merged,
      status: 'ok',
      statusCode: response.status,
      normalizedUrl,
      message: 'URL 可访问，已识别规则集',
      detail: appendNormalizedDetail(createDetail(merged), normalizedUrl),
    };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';

    return {
      ...fromUrl,
      status: isAbort ? 'timeout' : 'cors-or-network',
      normalizedUrl,
      message: isAbort ? '检测超时' : '浏览器无法读取这个 URL',
      detail: appendNormalizedDetail(isAbort
        ? '服务器响应太慢，mihomo 运行时仍可能可以下载。'
        : '常见原因是目标站点没有开放 CORS；mihomo 运行时不受浏览器 CORS 限制。', normalizedUrl),
      confidence: fromUrl.confidence,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function normalizeDownloadUrl(url: URL): URL {
  const host = url.hostname.toLowerCase();

  if (host !== 'github.com' && host !== 'www.github.com') {
    return url;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const [owner, repo, mode] = segments;

  if (!owner || !repo || (mode !== 'raw' && mode !== 'blob')) {
    return new URL(url.href.replace('://www.github.com/', '://github.com/'));
  }

  const rest = segments.slice(3);

  if (rest[0] === 'refs' && rest[1] === 'heads' && rest[2]) {
    const branch = rest[2];
    const filePath = rest.slice(3).join('/');

    if (filePath) {
      return new URL(`https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${filePath}`);
    }
  }

  const branch = rest[0];
  const filePath = rest.slice(1).join('/');

  if (!branch || !filePath) {
    return new URL(url.href.replace('://www.github.com/', '://github.com/'));
  }

  return new URL(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`);
}

function inferFromUrl(url: URL): Omit<RuleProviderDetectionResult, 'status' | 'message'> {
  const filename = getFilename(url);
  const extension = getExtension(filename);
  const format = inferFormatFromExtension(extension);
  const behavior = inferBehaviorFromText(`${url.pathname} ${url.search}`);
  const name = getNameFromFilename(filename);

  return {
    format,
    behavior,
    name,
    path: createPath(filename, format),
    confidence: format ? 'medium' : 'low',
  };
}

function inferFromContent(
  bytes: Uint8Array,
  contentType: string,
  urlFormat?: RuleProviderFormat,
): Partial<RuleProviderDetectionResult> {
  const binaryFormat = inferBinaryFormat(bytes);

  if (binaryFormat) {
    return {
      format: binaryFormat,
      confidence: binaryFormat === 'mrs' ? 'high' : 'medium',
    };
  }

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const format = inferTextFormat(text, contentType, urlFormat);
  const lines = extractRuleLines(text, format);
  const behavior = inferBehaviorFromRules(lines);

  return {
    format,
    behavior,
    confidence: behavior && format ? 'high' : format ? 'medium' : 'low',
  };
}

async function readResponseStart(response: Response): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array(await response.arrayBuffer()).slice(0, READ_LIMIT);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < READ_LIMIT) {
      const { done, value } = await reader.read();

      if (done || !value) {
        break;
      }

      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const output = new Uint8Array(Math.min(total, READ_LIMIT));
  let offset = 0;

  for (const chunk of chunks) {
    const slice = chunk.slice(0, Math.min(chunk.byteLength, output.byteLength - offset));
    output.set(slice, offset);
    offset += slice.byteLength;

    if (offset >= output.byteLength) {
      break;
    }
  }

  return output;
}

function inferBinaryFormat(bytes: Uint8Array): RuleProviderFormat | undefined {
  const isMrs = bytes.length >= 4
    && bytes[0] === 0x4d
    && bytes[1] === 0x52
    && bytes[2] === 0x53
    && bytes[3] === 0x01;
  const isZstd = bytes.length >= 4
    && bytes[0] === 0x28
    && bytes[1] === 0xb5
    && bytes[2] === 0x2f
    && bytes[3] === 0xfd;
  const hasMihomoMrsHeader = bytes.length >= 16
    && new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.slice(0, 16))
      .toLowerCase()
      .includes('mihomo');

  if (isMrs || isZstd || hasMihomoMrsHeader) {
    return 'mrs';
  }

  return undefined;
}

function inferTextFormat(
  text: string,
  contentType: string,
  urlFormat?: RuleProviderFormat,
): RuleProviderFormat {
  if (/^\s*(payload|rules)\s*:/m.test(text)) {
    return 'yaml';
  }

  if (urlFormat === 'yaml' || urlFormat === 'text') {
    return urlFormat;
  }

  if (/ya?ml/i.test(contentType)) {
    return 'yaml';
  }

  return 'text';
}

function extractRuleLines(text: string, format: RuleProviderFormat): string[] {
  if (format === 'yaml') {
    try {
      const parsed = YAML.parse(text);

      if (isRecord(parsed)) {
        const payload = Array.isArray(parsed.payload) ? parsed.payload : parsed.rules;

        if (Array.isArray(payload)) {
          return payload.filter((item): item is string => typeof item === 'string');
        }
      }
    } catch {
      return [];
    }
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('//'));
}

function inferBehaviorFromRules(lines: string[]): RuleProviderBehavior | undefined {
  const sample = lines.slice(0, 200);

  if (sample.length === 0) {
    return undefined;
  }

  if (sample.some((line) => isClassicalRule(line))) {
    return 'classical';
  }

  const ipCount = sample.filter(isIpCidr).length;
  const domainCount = sample.filter(isDomainLike).length;

  if (ipCount > 0 && ipCount === sample.length) {
    return 'ipcidr';
  }

  if (domainCount > 0 && domainCount === sample.length) {
    return 'domain';
  }

  return undefined;
}

function isClassicalRule(line: string): boolean {
  if (!line.includes(',')) {
    return false;
  }

  const [type] = line.split(',', 1);

  return CLASSICAL_RULE_PREFIXES.has(type.trim().toUpperCase());
}

function isIpCidr(line: string): boolean {
  const value = line.trim();

  return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(value)
    || /^[0-9a-f:]+\/\d{1,3}$/i.test(value);
}

function isDomainLike(line: string): boolean {
  const value = line.trim();

  if (value.includes(',') || value.includes('/') || /\s/.test(value)) {
    return false;
  }

  return /^(\+\.)?(\*\.)?\.?[a-z0-9_*?-]+(\.[a-z0-9_*?-]+)+$/i.test(value);
}

function inferFormatFromExtension(extension: string): RuleProviderFormat | undefined {
  if (extension === 'mrs') {
    return 'mrs';
  }

  if (YAML_EXTENSIONS.has(extension)) {
    return 'yaml';
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return 'text';
  }

  return undefined;
}

function inferBehaviorFromText(value: string): RuleProviderBehavior | undefined {
  const normalized = value.toLowerCase();

  if (/(^|[._/-])(ip|ipcidr|cidr|geoip|asn|ip-asn)([._/-]|$)/.test(normalized)) {
    return 'ipcidr';
  }

  if (/(^|[._/-])(domain|domains|geosite|site|host|hosts|dns)([._/-]|$)/.test(normalized)) {
    return 'domain';
  }

  if (/(^|[._/-])(classical|rules|rule|process|port)([._/-]|$)/.test(normalized)) {
    return 'classical';
  }

  return undefined;
}

function mergeInference(
  fromUrl: Omit<RuleProviderDetectionResult, 'status' | 'message'>,
  fromContent: Partial<RuleProviderDetectionResult>,
): Omit<RuleProviderDetectionResult, 'status' | 'message'> {
  const format = fromContent.format ?? fromUrl.format;
  const inferredBehavior = fromContent.behavior ?? fromUrl.behavior;
  const behavior = format === 'mrs' && inferredBehavior === 'classical'
    ? undefined
    : inferredBehavior;

  return {
    ...fromUrl,
    ...fromContent,
    format,
    behavior,
    name: fromUrl.name,
    path: createPathFromInference(fromUrl.path, format),
    confidence: maxConfidence(fromUrl.confidence, fromContent.confidence),
  };
}

function maxConfidence(
  first: RuleProviderDetectionResult['confidence'],
  second?: RuleProviderDetectionResult['confidence'],
): RuleProviderDetectionResult['confidence'] {
  const scores = { low: 0, medium: 1, high: 2 };

  if (!second) {
    return first;
  }

  return scores[second] > scores[first] ? second : first;
}

function createDetail(result: Pick<RuleProviderDetectionResult, 'format' | 'behavior' | 'confidence'>): string {
  const parts = [
    result.format ? `format: ${result.format}` : null,
    result.behavior ? `behavior: ${result.behavior}` : null,
    `置信度: ${result.confidence}`,
  ].filter(Boolean);

  return parts.join(' · ');
}

function appendNormalizedDetail(
  detail: string | undefined,
  normalizedUrl: string | undefined,
): string | undefined {
  const normalizedText = normalizedUrl ? '已规范化为 raw.githubusercontent.com' : undefined;

  return [detail, normalizedText].filter(Boolean).join(' · ') || undefined;
}

function createPath(filename: string, format?: RuleProviderFormat): string | undefined {
  const safeName = filename || `ruleset.${format ?? 'yaml'}`;
  const extension = getExtension(safeName);

  if (!extension && format) {
    return `./ruleset/${safeName}.${format}`;
  }

  return `./ruleset/${safeName}`;
}

function createPathFromInference(
  currentPath: string | undefined,
  format?: RuleProviderFormat,
): string | undefined {
  if (!currentPath || !format) {
    return currentPath;
  }

  if (getExtension(currentPath)) {
    return currentPath;
  }

  return `${currentPath}.${format}`;
}

function getFilename(url: URL): string {
  const raw = url.pathname.split('/').filter(Boolean).pop() ?? '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function getExtension(filename: string): string {
  const clean = filename.toLowerCase();
  const dot = clean.lastIndexOf('.');

  if (dot < 0 || dot === clean.length - 1) {
    return '';
  }

  return clean.slice(dot + 1);
}

function getNameFromFilename(filename: string): string | undefined {
  if (!filename) {
    return undefined;
  }

  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const normalized = withoutExtension
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
