import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FilePlus2,
  History as HistoryIcon,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BUILT_IN_POLICIES,
  GROUP_TYPES,
  PROXY_TYPES,
  RULE_PROVIDER_BEHAVIORS,
  RULE_PROVIDER_FORMATS,
  RULE_TYPES,
  SECTIONS,
} from './constants';
import {
  createEmptyDraft,
  createProxy,
  createProxyGroup,
  createProxyProvider,
  createRule,
  createRuleProvider,
} from './lib/defaultDraft';
import { draftToYaml, yamlToDraft } from './lib/configTransform';
import { readPreferences, writePreferences } from './lib/cookies';
import {
  detectRuleProviderUrl,
  type RuleProviderDetectionResult,
} from './lib/ruleProviderDetection';
import {
  clearHistory,
  deleteHistoryRecord,
  listHistory,
  loadCurrentDraft,
  saveCurrentDraft,
  saveHistorySnapshot,
} from './lib/storage';
import { validateDraft } from './lib/validation';
import type {
  ConfigDraft,
  DefaultConfig,
  GroupType,
  HistoryRecord,
  Preferences,
  ProxyGroup,
  ProxyItem,
  ProxyProvider,
  ProxyType,
  RuleItem,
  RuleProvider,
  RuleProviderBehavior,
  RuleProviderFormat,
  ValidationIssue,
} from './types';

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null;
type RuleProviderDetectionState = {
  url: string;
  status: 'checking' | RuleProviderDetectionResult['status'];
  message: string;
  detail?: string;
  result?: RuleProviderDetectionResult;
};

export function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences());
  const [draft, setDraft] = useState<ConfigDraft>(() => loadCurrentDraft() ?? createEmptyDraft());
  const [activeSection, setActiveSection] = useState(preferences.activeSection);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [importYaml, setImportYaml] = useState(draft.sourceYaml);
  const [notice, setNotice] = useState<Notice>(null);

  const outputYaml = useMemo(() => draftToYaml(draft), [draft]);
  const issues = useMemo(() => validateDraft(draft), [draft]);
  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  const warningCount = issues.filter((issue) => issue.level === 'warning').length;
  const policyOptions = useMemo(() => buildPolicyOptions(draft), [draft]);
  const proxyProviderOptions = useMemo(
    () => draft.proxyProviders.map((provider) => provider.name).filter(Boolean),
    [draft.proxyProviders],
  );
  const ruleProviderOptions = useMemo(
    () => draft.ruleProviders.map((provider) => provider.name).filter(Boolean),
    [draft.ruleProviders],
  );

  useEffect(() => {
    saveCurrentDraft(draft);
  }, [draft]);

  useEffect(() => {
    const next = { ...preferences, activeSection };
    setPreferences(next);
    writePreferences(next);
  }, [activeSection]);

  useEffect(() => {
    void refreshHistory();
  }, []);

  function updateDraft(updater: (current: ConfigDraft) => ConfigDraft): void {
    setDraft((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updatePreferences(patch: Partial<Preferences>): void {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      writePreferences(next);
      return next;
    });
  }

  async function refreshHistory(): Promise<void> {
    setHistoryRecords(await listHistory());
  }

  function handleImport(): void {
    try {
      const imported = yamlToDraft(importYaml);
      updateDraft(() => imported);
      setNotice({ kind: 'success', text: '已导入配置' });
      setActiveSection('default');
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : '导入失败',
      });
    }
  }

  async function handleSaveSnapshot(): Promise<void> {
    const saved = await saveHistorySnapshot(draft, outputYaml);
    updatePreferences({ lastHistoryId: saved.id });
    await refreshHistory();
    setNotice({ kind: 'success', text: '已保存历史记录' });
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(outputYaml);
    setNotice({ kind: 'success', text: 'YAML 已复制' });
  }

  function handleDownload(): void {
    const blob = new Blob([outputYaml], { type: 'application/x-yaml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${draft.title.trim() || 'config'}.yaml`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleNewDraft(): void {
    const next = createEmptyDraft();
    setDraft(next);
    setImportYaml('');
    setActiveSection('default');
    setNotice({ kind: 'info', text: '已新建配置' });
  }

  function renderSection(): ReactNode {
    switch (activeSection) {
      case 'import':
        return (
          <ImportSection
            importYaml={importYaml}
            setImportYaml={setImportYaml}
            onImport={handleImport}
          />
        );
      case 'default':
        return <DefaultSection draft={draft} updateDraft={updateDraft} />;
      case 'proxy-providers':
        return (
          <ProxyProvidersSection
            providers={draft.proxyProviders}
            updateDraft={updateDraft}
          />
        );
      case 'proxies':
        return <ProxiesSection proxies={draft.proxies} updateDraft={updateDraft} />;
      case 'proxy-groups':
        return (
          <ProxyGroupsSection
            groups={draft.proxyGroups}
            providerOptions={proxyProviderOptions}
            policyOptions={policyOptions}
            updateDraft={updateDraft}
          />
        );
      case 'rule-providers':
        return (
          <RuleProvidersSection
            providers={draft.ruleProviders}
            policyOptions={policyOptions}
            updateDraft={updateDraft}
          />
        );
      case 'rules':
        return (
          <RulesSection
            rules={draft.rules}
            policyOptions={policyOptions}
            ruleProviderOptions={ruleProviderOptions}
            updateDraft={updateDraft}
          />
        );
      case 'history':
        return (
          <HistorySection
            historyRecords={historyRecords}
            onLoad={(record) => {
              setDraft(record.draft);
              setImportYaml(record.sourceYaml);
              updatePreferences({ lastHistoryId: record.id });
              setActiveSection('default');
              setNotice({ kind: 'success', text: '已载入历史记录' });
            }}
            onDelete={async (id) => {
              await deleteHistoryRecord(id);
              await refreshHistory();
            }}
            onClear={async () => {
              await clearHistory();
              await refreshHistory();
              setNotice({ kind: 'info', text: '历史记录已清空' });
            }}
          />
        );
      default:
        return <DefaultSection draft={draft} updateDraft={updateDraft} />;
    }
  }

  return (
    <main className={`app-shell ${preferences.previewVisible ? 'with-preview' : 'without-preview'}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">M</span>
          <div>
            <h1>Mihomo Configurator</h1>
            <p>GitHub Pages Ready</p>
          </div>
        </div>

        <nav className="section-nav" aria-label="配置区块">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={activeSection === section.id ? 'active' : ''}
              type="button"
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="status-panel">
          {errorCount === 0 ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <XCircle aria-hidden="true" />
          )}
          <span>{errorCount === 0 ? '可导出' : `${errorCount} 个错误`}</span>
          {warningCount > 0 && <small>{warningCount} 个提醒</small>}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <label className="title-field">
            <span>配置名</span>
            <input
              value={draft.title}
              onChange={(event) => updateDraft((current) => ({
                ...current,
                title: event.target.value,
              }))}
            />
          </label>

          <div className="toolbar">
            <IconButton label="新建" onClick={handleNewDraft} icon={<FilePlus2 />} />
            <IconButton label="保存历史" onClick={() => void handleSaveSnapshot()} icon={<Save />} />
            <IconButton label="复制 YAML" onClick={() => void handleCopy()} icon={<Copy />} />
            <IconButton label="下载 YAML" onClick={handleDownload} icon={<Download />} />
            <IconButton
              label={preferences.previewVisible ? '隐藏预览' : '显示预览'}
              onClick={() => updatePreferences({ previewVisible: !preferences.previewVisible })}
              icon={preferences.previewVisible ? <PanelRightClose /> : <PanelRightOpen />}
            />
          </div>
        </header>

        {notice && (
          <div className={`notice ${notice.kind}`} role="status">
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">
              ×
            </button>
          </div>
        )}

        <div className="section-body">{renderSection()}</div>
      </section>

      {preferences.previewVisible && (
        <PreviewPanel
          issues={issues}
          outputYaml={outputYaml}
          onCopy={() => void handleCopy()}
          onDownload={handleDownload}
        />
      )}
    </main>
  );
}

function ImportSection({
  importYaml,
  setImportYaml,
  onImport,
}: {
  importYaml: string;
  setImportYaml: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <Panel title="导入">
      <div className="import-actions">
        <label className="file-button">
          <Upload aria-hidden="true" />
          <span>选择 YAML</span>
          <input
            type="file"
            accept=".yaml,.yml,text/yaml,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (!file) {
                return;
              }

              void file.text().then(setImportYaml);
            }}
          />
        </label>
        <button className="primary-button" type="button" onClick={onImport}>
          <Upload aria-hidden="true" />
          导入到表单
        </button>
      </div>

      <label className="field textarea-field">
        <span>现有配置 YAML</span>
        <textarea
          spellCheck={false}
          value={importYaml}
          onChange={(event) => setImportYaml(event.target.value)}
        />
      </label>
    </Panel>
  );
}

function DefaultSection({
  draft,
  updateDraft,
}: {
  draft: ConfigDraft;
  updateDraft: (updater: (current: ConfigDraft) => ConfigDraft) => void;
}) {
  function updateDefault(patch: Partial<DefaultConfig>): void {
    updateDraft((current) => ({
      ...current,
      defaultConfig: {
        ...current.defaultConfig,
        ...patch,
      },
    }));
  }

  return (
    <div className="stacked">
      <Panel title="基础配置">
        <div className="form-grid compact">
          <NumberField label="HTTP 端口" value={draft.defaultConfig.port} onChange={(port) => updateDefault({ port })} />
          <NumberField label="SOCKS 端口" value={draft.defaultConfig.socksPort} onChange={(socksPort) => updateDefault({ socksPort })} />
          <NumberField label="Mixed 端口" value={draft.defaultConfig.mixedPort} onChange={(mixedPort) => updateDefault({ mixedPort })} />
          <NumberField label="Redir 端口" value={draft.defaultConfig.redirPort} onChange={(redirPort) => updateDefault({ redirPort })} />
          <NumberField label="TProxy 端口" value={draft.defaultConfig.tproxyPort} onChange={(tproxyPort) => updateDefault({ tproxyPort })} />
          <TextField label="监听地址" value={draft.defaultConfig.bindAddress} onChange={(bindAddress) => updateDefault({ bindAddress })} />
          <SelectField
            label="模式"
            value={draft.defaultConfig.mode}
            options={[
              { value: 'rule', label: 'Rule' },
              { value: 'global', label: 'Global' },
              { value: 'direct', label: 'Direct' },
            ]}
            onChange={(mode) => updateDefault({ mode: mode as DefaultConfig['mode'] })}
          />
          <SelectField
            label="日志级别"
            value={draft.defaultConfig.logLevel}
            options={[
              { value: 'silent', label: 'Silent' },
              { value: 'error', label: 'Error' },
              { value: 'warning', label: 'Warning' },
              { value: 'info', label: 'Info' },
              { value: 'debug', label: 'Debug' },
            ]}
            onChange={(logLevel) => updateDefault({ logLevel: logLevel as DefaultConfig['logLevel'] })}
          />
          <TextField label="External Controller" value={draft.defaultConfig.externalController} onChange={(externalController) => updateDefault({ externalController })} />
          <TextField label="Secret" value={draft.defaultConfig.secret} onChange={(secret) => updateDefault({ secret })} />
          <TextField label="Fingerprint" value={draft.defaultConfig.globalClientFingerprint} onChange={(globalClientFingerprint) => updateDefault({ globalClientFingerprint })} />
        </div>
        <div className="switch-row">
          <Switch label="Allow LAN" checked={draft.defaultConfig.allowLan} onChange={(allowLan) => updateDefault({ allowLan })} />
          <Switch label="IPv6" checked={draft.defaultConfig.ipv6} onChange={(ipv6) => updateDefault({ ipv6 })} />
          <Switch label="Unified Delay" checked={draft.defaultConfig.unifiedDelay} onChange={(unifiedDelay) => updateDefault({ unifiedDelay })} />
          <Switch label="TCP Concurrent" checked={draft.defaultConfig.tcpConcurrent} onChange={(tcpConcurrent) => updateDefault({ tcpConcurrent })} />
        </div>
      </Panel>

      <Panel title="Geo 与 Profile">
        <div className="form-grid compact">
          <SelectField
            label="Geo Loader"
            value={draft.defaultConfig.geodataLoader}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'memconservative', label: 'Mem Conservative' },
            ]}
            onChange={(geodataLoader) => updateDefault({ geodataLoader: geodataLoader as DefaultConfig['geodataLoader'] })}
          />
          <NumberField label="Geo 更新间隔" value={draft.defaultConfig.geoUpdateInterval} onChange={(geoUpdateInterval) => updateDefault({ geoUpdateInterval: geoUpdateInterval ?? 24 })} />
        </div>
        <div className="switch-row">
          <Switch label="Geodata Mode" checked={draft.defaultConfig.geodataMode} onChange={(geodataMode) => updateDefault({ geodataMode })} />
          <Switch label="Geo Auto Update" checked={draft.defaultConfig.geoAutoUpdate} onChange={(geoAutoUpdate) => updateDefault({ geoAutoUpdate })} />
          <Switch label="Store Selected" checked={draft.defaultConfig.profileStoreSelected} onChange={(profileStoreSelected) => updateDefault({ profileStoreSelected })} />
          <Switch label="Store Fake IP" checked={draft.defaultConfig.profileStoreFakeIp} onChange={(profileStoreFakeIp) => updateDefault({ profileStoreFakeIp })} />
        </div>
      </Panel>

      <Panel title="DNS">
        <div className="form-grid compact">
          <TextField label="Listen" value={draft.defaultConfig.dnsListen} onChange={(dnsListen) => updateDefault({ dnsListen })} />
          <SelectField
            label="Enhanced Mode"
            value={draft.defaultConfig.dnsEnhancedMode}
            options={[
              { value: 'fake-ip', label: 'Fake IP' },
              { value: 'redir-host', label: 'Redir Host' },
              { value: '', label: '无' },
            ]}
            onChange={(dnsEnhancedMode) => updateDefault({ dnsEnhancedMode: dnsEnhancedMode as DefaultConfig['dnsEnhancedMode'] })}
          />
          <TextField label="Fake IP Range" value={draft.defaultConfig.dnsFakeIpRange} onChange={(dnsFakeIpRange) => updateDefault({ dnsFakeIpRange })} />
        </div>
        <div className="switch-row">
          <Switch label="DNS Enable" checked={draft.defaultConfig.dnsEnable} onChange={(dnsEnable) => updateDefault({ dnsEnable })} />
        </div>
        <label className="field textarea-field small">
          <span>Nameserver</span>
          <textarea
            spellCheck={false}
            value={draft.defaultConfig.dnsNameservers.join('\n')}
            onChange={(event) => updateDefault({
              dnsNameservers: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
            })}
          />
        </label>
      </Panel>

      <Panel title="高级 YAML">
        <label className="field textarea-field small">
          <span>基础额外字段</span>
          <textarea
            spellCheck={false}
            value={draft.defaultConfig.extraYaml}
            onChange={(event) => updateDefault({ extraYaml: event.target.value })}
          />
        </label>
        <label className="field textarea-field small">
          <span>额外顶层字段</span>
          <textarea
            spellCheck={false}
            value={draft.extraTopLevelYaml}
            onChange={(event) => updateDraft((current) => ({
              ...current,
              extraTopLevelYaml: event.target.value,
            }))}
          />
        </label>
      </Panel>
    </div>
  );
}

function ProxyProvidersSection({
  providers,
  updateDraft,
}: {
  providers: ProxyProvider[];
  updateDraft: (updater: (current: ConfigDraft) => ConfigDraft) => void;
}) {
  function updateProvider(id: string, patch: Partial<ProxyProvider>): void {
    updateDraft((current) => ({
      ...current,
      proxyProviders: current.proxyProviders.map((provider) => (
        provider.id === id ? { ...provider, ...patch } : provider
      )),
    }));
  }

  return (
    <EntitySection
      title="代理提供者"
      emptyText="暂无代理提供者"
      onAdd={() => updateDraft((current) => ({
        ...current,
        proxyProviders: [...current.proxyProviders, createProxyProvider()],
      }))}
    >
      {providers.map((provider) => (
        <EntityCard
          key={provider.id}
          title={provider.name || '未命名代理提供者'}
          meta={provider.type}
          onDelete={() => updateDraft((current) => ({
            ...current,
            proxyProviders: current.proxyProviders.filter((item) => item.id !== provider.id),
          }))}
        >
          <div className="form-grid">
            <TextField label="名称" value={provider.name} onChange={(name) => updateProvider(provider.id, { name })} />
            <SelectField
              label="类型"
              value={provider.type}
              options={[
                { value: 'http', label: 'HTTP' },
                { value: 'file', label: 'File' },
              ]}
              onChange={(type) => updateProvider(provider.id, { type: type as ProxyProvider['type'] })}
            />
            <TextField label="URL" value={provider.url} onChange={(url) => updateProvider(provider.id, { url })} />
            <TextField label="Path" value={provider.path} onChange={(path) => updateProvider(provider.id, { path })} />
            <NumberField label="Interval" value={provider.interval} onChange={(interval) => updateProvider(provider.id, { interval: interval ?? 86400 })} />
            <TextField label="Filter" value={provider.filter} onChange={(filter) => updateProvider(provider.id, { filter })} />
            <TextField label="Exclude Filter" value={provider.excludeFilter} onChange={(excludeFilter) => updateProvider(provider.id, { excludeFilter })} />
          </div>

          <div className="nested-box">
            <div className="switch-row">
              <Switch
                label="Health Check"
                checked={provider.healthCheck.enable}
                onChange={(enable) => updateProvider(provider.id, {
                  healthCheck: { ...provider.healthCheck, enable },
                })}
              />
              <Switch
                label="Lazy"
                checked={provider.healthCheck.lazy}
                onChange={(lazy) => updateProvider(provider.id, {
                  healthCheck: { ...provider.healthCheck, lazy },
                })}
              />
            </div>
            <div className="form-grid compact">
              <TextField
                label="Health URL"
                value={provider.healthCheck.url}
                onChange={(url) => updateProvider(provider.id, {
                  healthCheck: { ...provider.healthCheck, url },
                })}
              />
              <NumberField
                label="Health Interval"
                value={provider.healthCheck.interval}
                onChange={(interval) => updateProvider(provider.id, {
                  healthCheck: { ...provider.healthCheck, interval: interval ?? 300 },
                })}
              />
              <NumberField
                label="Timeout"
                value={provider.healthCheck.timeout}
                onChange={(timeout) => updateProvider(provider.id, {
                  healthCheck: { ...provider.healthCheck, timeout },
                })}
              />
              <TextField
                label="Expected Status"
                value={provider.healthCheck.expectedStatus ?? ''}
                onChange={(expectedStatus) => updateProvider(provider.id, {
                  healthCheck: { ...provider.healthCheck, expectedStatus },
                })}
              />
            </div>
          </div>

          <AdvancedYaml value={provider.extraYaml} onChange={(extraYaml) => updateProvider(provider.id, { extraYaml })} />
        </EntityCard>
      ))}
    </EntitySection>
  );
}

function ProxiesSection({
  proxies,
  updateDraft,
}: {
  proxies: ProxyItem[];
  updateDraft: (updater: (current: ConfigDraft) => ConfigDraft) => void;
}) {
  function updateProxy(id: string, patch: Partial<ProxyItem>): void {
    updateDraft((current) => ({
      ...current,
      proxies: current.proxies.map((proxy) => (
        proxy.id === id ? { ...proxy, ...patch } : proxy
      )),
    }));
  }

  return (
    <EntitySection
      title="代理"
      emptyText="暂无代理"
      onAdd={() => updateDraft((current) => ({
        ...current,
        proxies: [...current.proxies, createProxy()],
      }))}
    >
      {proxies.map((proxy) => (
        <EntityCard
          key={proxy.id}
          title={proxy.name || '未命名代理'}
          meta={proxy.type}
          onDelete={() => updateDraft((current) => ({
            ...current,
            proxies: current.proxies.filter((item) => item.id !== proxy.id),
          }))}
        >
          <div className="form-grid">
            <TextField label="名称" value={proxy.name} onChange={(name) => updateProxy(proxy.id, { name })} />
            <SelectField
              label="类型"
              value={proxy.type}
              options={PROXY_TYPES}
              onChange={(type) => updateProxy(proxy.id, { type: type as ProxyType })}
            />
            <TextField label="Server" value={proxy.server} onChange={(server) => updateProxy(proxy.id, { server })} />
            <NumberField label="Port" value={proxy.port} onChange={(port) => updateProxy(proxy.id, { port })} />
            <TextField label="Username" value={proxy.username} onChange={(username) => updateProxy(proxy.id, { username })} />
            <TextField label="Password" value={proxy.password} onChange={(password) => updateProxy(proxy.id, { password })} />
            <TextField label="Cipher" value={proxy.cipher} onChange={(cipher) => updateProxy(proxy.id, { cipher })} />
            <TextField label="UUID" value={proxy.uuid} onChange={(uuid) => updateProxy(proxy.id, { uuid })} />
            <NumberField label="Alter ID" value={proxy.alterId} onChange={(alterId) => updateProxy(proxy.id, { alterId })} />
            <TextField label="SNI" value={proxy.sni} onChange={(sni) => updateProxy(proxy.id, { sni })} />
            <TextField label="Network" value={proxy.network} onChange={(network) => updateProxy(proxy.id, { network })} />
            <TextField label="WS Path" value={proxy.wsPath} onChange={(wsPath) => updateProxy(proxy.id, { wsPath })} />
          </div>
          <div className="switch-row">
            <Switch label="TLS" checked={proxy.tls} onChange={(tls) => updateProxy(proxy.id, { tls })} />
            <Switch label="UDP" checked={proxy.udp} onChange={(udp) => updateProxy(proxy.id, { udp })} />
            <Switch label="Skip Cert Verify" checked={proxy.skipCertVerify} onChange={(skipCertVerify) => updateProxy(proxy.id, { skipCertVerify })} />
          </div>
          <AdvancedYaml value={proxy.extraYaml} onChange={(extraYaml) => updateProxy(proxy.id, { extraYaml })} />
        </EntityCard>
      ))}
    </EntitySection>
  );
}

function ProxyGroupsSection({
  groups,
  providerOptions,
  policyOptions,
  updateDraft,
}: {
  groups: ProxyGroup[];
  providerOptions: string[];
  policyOptions: string[];
  updateDraft: (updater: (current: ConfigDraft) => ConfigDraft) => void;
}) {
  function updateGroup(id: string, patch: Partial<ProxyGroup>): void {
    updateDraft((current) => ({
      ...current,
      proxyGroups: current.proxyGroups.map((group) => (
        group.id === id ? { ...group, ...patch } : group
      )),
    }));
  }

  return (
    <EntitySection
      title="策略组"
      emptyText="暂无策略组"
      onAdd={() => updateDraft((current) => ({
        ...current,
        proxyGroups: [...current.proxyGroups, createProxyGroup()],
      }))}
    >
      {groups.map((group) => {
        const selectablePolicies = policyOptions.filter((name) => name !== group.name);

        return (
          <EntityCard
            key={group.id}
            title={group.name || '未命名策略组'}
            meta={group.type}
            onDelete={() => updateDraft((current) => ({
              ...current,
              proxyGroups: current.proxyGroups.filter((item) => item.id !== group.id),
            }))}
          >
            <div className="form-grid">
              <TextField label="名称" value={group.name} onChange={(name) => updateGroup(group.id, { name })} />
              <SelectField
                label="类型"
                value={group.type}
                options={GROUP_TYPES}
                onChange={(type) => updateGroup(group.id, { type: type as GroupType })}
              />
              <TextField label="测试 URL" value={group.url} onChange={(url) => updateGroup(group.id, { url })} />
              <NumberField label="Interval" value={group.interval} onChange={(interval) => updateGroup(group.id, { interval })} />
              <NumberField label="Tolerance" value={group.tolerance} onChange={(tolerance) => updateGroup(group.id, { tolerance })} />
              <SelectField
                label="Strategy"
                value={group.strategy}
                options={[
                  { value: '', label: '无' },
                  { value: 'consistent-hashing', label: 'Consistent Hashing' },
                  { value: 'round-robin', label: 'Round Robin' },
                ]}
                onChange={(strategy) => updateGroup(group.id, { strategy: strategy as ProxyGroup['strategy'] })}
              />
              <TextField label="Filter" value={group.filter} onChange={(filter) => updateGroup(group.id, { filter })} />
              <TextField label="Exclude Filter" value={group.excludeFilter} onChange={(excludeFilter) => updateGroup(group.id, { excludeFilter })} />
              <TextField label="Icon" value={group.icon} onChange={(icon) => updateGroup(group.id, { icon })} />
            </div>
            <div className="switch-row">
              <Switch label="Lazy" checked={group.lazy} onChange={(lazy) => updateGroup(group.id, { lazy })} />
              <Switch label="Disable UDP" checked={group.disableUdp} onChange={(disableUdp) => updateGroup(group.id, { disableUdp })} />
              <Switch label="Include All" checked={group.includeAll} onChange={(includeAll) => updateGroup(group.id, { includeAll })} />
            </div>
            <div className="selector-grid">
              <MultiSelect
                label="策略"
                values={group.proxies}
                options={selectablePolicies}
                onChange={(proxies) => updateGroup(group.id, { proxies })}
              />
              <MultiSelect
                label="Provider"
                values={group.use}
                options={providerOptions}
                onChange={(use) => updateGroup(group.id, { use })}
              />
            </div>
            <AdvancedYaml value={group.extraYaml} onChange={(extraYaml) => updateGroup(group.id, { extraYaml })} />
          </EntityCard>
        );
      })}
    </EntitySection>
  );
}

function RuleProvidersSection({
  providers,
  policyOptions,
  updateDraft,
}: {
  providers: RuleProvider[];
  policyOptions: string[];
  updateDraft: (updater: (current: ConfigDraft) => ConfigDraft) => void;
}) {
  const [detections, setDetections] = useState<Record<string, RuleProviderDetectionState>>({});
  const autoTimers = useRef<Record<string, number>>({});

  useEffect(() => () => {
    Object.values(autoTimers.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  function updateProvider(id: string, patch: Partial<RuleProvider>): void {
    updateDraft((current) => ({
      ...current,
      ruleProviders: current.ruleProviders.map((provider) => (
        provider.id === id ? { ...provider, ...patch } : provider
      )),
    }));
  }

  function updateProviderUrl(provider: RuleProvider, url: string): void {
    updateProvider(provider.id, {
      url,
      type: url.trim() ? 'http' : provider.type,
    });
    scheduleAutoDetection(provider.id, url);
  }

  function scheduleAutoDetection(id: string, url: string): void {
    window.clearTimeout(autoTimers.current[id]);

    if (!isHttpUrl(url)) {
      setDetections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }

    autoTimers.current[id] = window.setTimeout(() => {
      void runDetection(id, url);
    }, 800);
  }

  async function runDetection(id: string, url: string): Promise<void> {
    if (!url.trim()) {
      return;
    }

    setDetections((current) => ({
      ...current,
      [id]: {
        url,
        status: 'checking',
        message: '正在检测 URL...',
      },
    }));

    const result = await detectRuleProviderUrl(url);

    setDetections((current) => ({
      ...current,
      [id]: {
        url,
        status: result.status,
        message: result.message,
        detail: result.detail,
        result,
      },
    }));

    applyDetection(id, url, result);
  }

  function applyDetection(id: string, url: string, result: RuleProviderDetectionResult): void {
    if (result.status === 'invalid-url') {
      return;
    }

    updateDraft((current) => ({
      ...current,
      ruleProviders: current.ruleProviders.map((provider) => {
        if (provider.id !== id || provider.url !== url) {
          return provider;
        }

        return {
          ...provider,
          type: 'http',
          name: provider.name || result.name || provider.name,
          path: provider.path || result.path || provider.path,
          format: result.format ?? provider.format,
          behavior: result.behavior ?? provider.behavior,
        };
      }),
    }));
  }

  return (
    <EntitySection
      title="规则提供者"
      emptyText="暂无规则提供者"
      onAdd={() => updateDraft((current) => ({
        ...current,
        ruleProviders: [...current.ruleProviders, createRuleProvider()],
      }))}
    >
      {providers.map((provider) => (
        <EntityCard
          key={provider.id}
          title={provider.name || '未命名规则提供者'}
          meta={provider.behavior}
          onDelete={() => updateDraft((current) => ({
            ...current,
            ruleProviders: current.ruleProviders.filter((item) => item.id !== provider.id),
          }))}
        >
          <div className="form-grid">
            <TextField label="名称" value={provider.name} onChange={(name) => updateProvider(provider.id, { name })} />
            <SelectField
              label="类型"
              value={provider.type}
              options={[
                { value: 'http', label: 'HTTP' },
                { value: 'file', label: 'File' },
              ]}
              onChange={(type) => updateProvider(provider.id, { type: type as RuleProvider['type'] })}
            />
            <SelectField
              label="Behavior"
              value={provider.behavior}
              options={RULE_PROVIDER_BEHAVIORS}
              onChange={(behavior) => updateProvider(provider.id, { behavior: behavior as RuleProviderBehavior })}
            />
            <SelectField
              label="Format"
              value={provider.format}
              options={RULE_PROVIDER_FORMATS}
              onChange={(format) => updateProvider(provider.id, { format: format as RuleProviderFormat })}
            />
            <RuleProviderUrlField
              value={provider.url}
              detection={detections[provider.id]}
              onChange={(url) => updateProviderUrl(provider, url)}
              onDetect={() => void runDetection(provider.id, provider.url)}
            />
            <TextField label="Path" value={provider.path} onChange={(path) => updateProvider(provider.id, { path })} />
            <NumberField label="Interval" value={provider.interval} onChange={(interval) => updateProvider(provider.id, { interval: interval ?? 86400 })} />
            <DatalistField
              label="Proxy"
              value={provider.proxy}
              options={policyOptions}
              onChange={(proxy) => updateProvider(provider.id, { proxy })}
            />
          </div>
          <AdvancedYaml value={provider.extraYaml} onChange={(extraYaml) => updateProvider(provider.id, { extraYaml })} />
        </EntityCard>
      ))}
    </EntitySection>
  );
}

function RulesSection({
  rules,
  policyOptions,
  ruleProviderOptions,
  updateDraft,
}: {
  rules: RuleItem[];
  policyOptions: string[];
  ruleProviderOptions: string[];
  updateDraft: (updater: (current: ConfigDraft) => ConfigDraft) => void;
}) {
  function updateRule(id: string, patch: Partial<RuleItem>): void {
    updateDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => (
        rule.id === id ? { ...rule, ...patch } : rule
      )),
    }));
  }

  return (
    <EntitySection
      title="规则"
      emptyText="暂无规则"
      onAdd={() => updateDraft((current) => ({
        ...current,
        rules: [...current.rules, createRule()],
      }))}
    >
      {rules.map((rule, index) => (
        <EntityCard
          key={rule.id}
          title={`#${index + 1} ${rule.kind === 'raw' ? 'Raw' : rule.type}`}
          meta={rule.target || '未设置目标'}
          onDelete={() => updateDraft((current) => ({
            ...current,
            rules: current.rules.filter((item) => item.id !== rule.id),
          }))}
        >
          <div className="form-grid">
            <SelectField
              label="模式"
              value={rule.kind}
              options={[
                { value: 'structured', label: '结构化' },
                { value: 'raw', label: 'Raw' },
              ]}
              onChange={(kind) => updateRule(rule.id, { kind: kind as RuleItem['kind'] })}
            />
            {rule.kind === 'structured' ? (
              <>
                <SelectField
                  label="类型"
                  value={rule.type}
                  options={RULE_TYPES.map((type) => ({ value: type, label: type }))}
                  onChange={(type) => updateRule(rule.id, { type })}
                />
                {rule.type === 'RULE-SET' ? (
                  <DatalistField
                    label="匹配"
                    value={rule.payload}
                    options={ruleProviderOptions}
                    onChange={(payload) => updateRule(rule.id, { payload })}
                  />
                ) : (
                  <TextField
                    label="匹配"
                    value={rule.payload}
                    onChange={(payload) => updateRule(rule.id, { payload })}
                    disabled={rule.type === 'MATCH'}
                  />
                )}
                <DatalistField
                  label="目标"
                  value={rule.target}
                  options={policyOptions}
                  onChange={(target) => updateRule(rule.id, { target })}
                />
              </>
            ) : (
              <label className="field textarea-field inline-textarea">
                <span>Raw</span>
                <textarea
                  spellCheck={false}
                  value={rule.raw}
                  onChange={(event) => updateRule(rule.id, { raw: event.target.value })}
                />
              </label>
            )}
          </div>
          {rule.kind === 'structured' && rule.type !== 'MATCH' && (
            <div className="switch-row">
              <Switch label="No Resolve" checked={rule.noResolve} onChange={(noResolve) => updateRule(rule.id, { noResolve })} />
            </div>
          )}
        </EntityCard>
      ))}
    </EntitySection>
  );
}

function HistorySection({
  historyRecords,
  onLoad,
  onDelete,
  onClear,
}: {
  historyRecords: HistoryRecord[];
  onLoad: (record: HistoryRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  return (
    <Panel title="历史记录">
      <div className="history-actions">
        <button className="danger-button" type="button" onClick={() => void onClear()}>
          <Trash2 aria-hidden="true" />
          清空
        </button>
      </div>
      {historyRecords.length === 0 ? (
        <EmptyState text="暂无历史记录" />
      ) : (
        <div className="history-list">
          {historyRecords.map((record) => (
            <article className="history-item" key={record.id}>
              <div>
                <strong>{record.title}</strong>
                <span>{new Date(record.updatedAt).toLocaleString()}</span>
              </div>
              <div className="item-actions">
                <IconButton label="载入" icon={<HistoryIcon />} onClick={() => onLoad(record)} />
                <IconButton label="删除" icon={<Trash2 />} onClick={() => void onDelete(record.id)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function PreviewPanel({
  issues,
  outputYaml,
  onCopy,
  onDownload,
}: {
  issues: ValidationIssue[];
  outputYaml: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');

  return (
    <aside className="preview-panel">
      <div className="preview-header">
        <div>
          <h2>YAML</h2>
          <span>{errors.length === 0 ? 'Ready' : `${errors.length} Errors`}</span>
        </div>
        <div className="toolbar tight">
          <IconButton label="复制" icon={<Copy />} onClick={onCopy} />
          <IconButton label="下载" icon={<Download />} onClick={onDownload} />
        </div>
      </div>

      <div className="issue-list">
        {errors.map((issue, index) => (
          <IssueLine key={`error-${index}`} issue={issue} />
        ))}
        {warnings.map((issue, index) => (
          <IssueLine key={`warning-${index}`} issue={issue} />
        ))}
        {issues.length === 0 && (
          <div className="issue-line ok">
            <CheckCircle2 aria-hidden="true" />
            <span>校验通过</span>
          </div>
        )}
      </div>

      <pre className="yaml-preview">{outputYaml}</pre>
    </aside>
  );
}

function IssueLine({ issue }: { issue: ValidationIssue }) {
  return (
    <div className={`issue-line ${issue.level}`}>
      {issue.level === 'error' ? <XCircle aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      <span>{issue.section}：{issue.message}</span>
    </div>
  );
}

function EntitySection({
  title,
  emptyText,
  onAdd,
  children,
}: {
  title: string;
  emptyText: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <Panel title={title} action={(
      <button className="primary-button" type="button" onClick={onAdd}>
        <Plus aria-hidden="true" />
        新增
      </button>
    )}>
      {hasChildren ? <div className="entity-list">{children}</div> : <EmptyState text={emptyText} />}
    </Panel>
  );
}

function EntityCard({
  title,
  meta,
  onDelete,
  children,
}: {
  title: string;
  meta: string;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <article className="entity-card">
      <header>
        <div>
          <h3>{title}</h3>
          <span>{meta}</span>
        </div>
        <IconButton label="删除" icon={<Trash2 />} onClick={onDelete} />
      </header>
      {children}
    </article>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function TextField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function RuleProviderUrlField({
  value,
  detection,
  onChange,
  onDetect,
}: {
  value: string;
  detection?: RuleProviderDetectionState;
  onChange: (value: string) => void;
  onDetect: () => void;
}) {
  const id = useId();
  const isChecking = detection?.status === 'checking';

  return (
    <div className="field url-detection-field">
      <label htmlFor={id}>URL</label>
      <div className="url-control">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com/rules.yaml"
        />
        <button
          className={`icon-button detect-button ${isChecking ? 'is-checking' : ''}`}
          type="button"
          disabled={isChecking || !value.trim()}
          onClick={onDetect}
          title="检测 URL"
          aria-label="检测 URL"
        >
          {isChecking ? <Loader2 aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          <span>{isChecking ? '检测中' : '检测'}</span>
        </button>
      </div>
      {detection && (
        <div className={`detection-message ${getDetectionTone(detection.status)}`}>
          {detection.status === 'checking' && <Loader2 aria-hidden="true" />}
          {detection.status === 'ok' && <CheckCircle2 aria-hidden="true" />}
          {(detection.status === 'http-error' || detection.status === 'invalid-url') && <XCircle aria-hidden="true" />}
          {(detection.status === 'cors-or-network' || detection.status === 'timeout') && <AlertTriangle aria-hidden="true" />}
          <span>
            {detection.message}
            {detection.detail ? ` · ${detection.detail}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function DatalistField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <label className="field">
      <span>{label}</span>
      <input list={id} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={id}>
        {options.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value?: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === '' ? undefined : Number(next));
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function MultiSelect({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(option: string): void {
    if (values.includes(option)) {
      onChange(values.filter((value) => value !== option));
      return;
    }

    onChange([...values, option]);
  }

  return (
    <div className="multi-select">
      <span>{label}</span>
      {options.length === 0 ? (
        <small>无可选项</small>
      ) : (
        <div>
          {options.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={values.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AdvancedYaml({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <details className="advanced-yaml">
      <summary>高级 YAML</summary>
      <label className="field textarea-field small">
        <span>字段</span>
        <textarea spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </details>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="icon-button" type="button" onClick={onClick} title={label} aria-label={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function getDetectionTone(status: RuleProviderDetectionState['status']): string {
  if (status === 'ok') {
    return 'ok';
  }

  if (status === 'checking') {
    return 'info';
  }

  if (status === 'cors-or-network' || status === 'timeout') {
    return 'warning';
  }

  return 'error';
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildPolicyOptions(draft: ConfigDraft): string[] {
  return [
    ...BUILT_IN_POLICIES,
    ...draft.proxies.map((proxy) => proxy.name).filter(Boolean),
    ...draft.proxyGroups.map((group) => group.name).filter(Boolean),
  ];
}
