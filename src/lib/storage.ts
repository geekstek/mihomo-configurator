import { HISTORY_LIMIT } from '../constants';
import type { ConfigDraft, HistoryRecord } from '../types';
import { createId } from './id';

const CURRENT_DRAFT_KEY = 'mihomo_configurator_current_draft';
const DB_NAME = 'mihomo-configurator';
const DB_VERSION = 1;
const HISTORY_STORE = 'history';

export function saveCurrentDraft(draft: ConfigDraft): void {
  localStorage.setItem(CURRENT_DRAFT_KEY, JSON.stringify(draft));
}

export function loadCurrentDraft(): ConfigDraft | null {
  const raw = localStorage.getItem(CURRENT_DRAFT_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ConfigDraft;
  } catch {
    return null;
  }
}

export async function listHistory(): Promise<HistoryRecord[]> {
  const db = await openDb();
  const transaction = db.transaction(HISTORY_STORE, 'readonly');
  const records = await requestToPromise<HistoryRecord[]>(
    transaction.objectStore(HISTORY_STORE).getAll(),
  );

  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveHistorySnapshot(
  draft: ConfigDraft,
  outputYaml: string,
  id?: string,
): Promise<HistoryRecord> {
  const now = new Date().toISOString();
  const record: HistoryRecord = {
    id: id ?? createId('history'),
    title: draft.title.trim() || 'mihomo-config',
    createdAt: now,
    updatedAt: now,
    sourceYaml: draft.sourceYaml,
    outputYaml,
    draft,
  };

  const db = await openDb();
  const transaction = db.transaction(HISTORY_STORE, 'readwrite');
  transaction.objectStore(HISTORY_STORE).put(record);
  await transactionToPromise(transaction);
  await trimHistory();

  return record;
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(HISTORY_STORE, 'readwrite');
  transaction.objectStore(HISTORY_STORE).delete(id);
  await transactionToPromise(transaction);
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(HISTORY_STORE, 'readwrite');
  transaction.objectStore(HISTORY_STORE).clear();
  await transactionToPromise(transaction);
}

async function trimHistory(): Promise<void> {
  const records = await listHistory();
  const stale = records.slice(HISTORY_LIMIT);

  if (stale.length === 0) {
    return;
  }

  const db = await openDb();
  const transaction = db.transaction(HISTORY_STORE, 'readwrite');
  const store = transaction.objectStore(HISTORY_STORE);

  stale.forEach((record) => store.delete(record.id));
  await transactionToPromise(transaction);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务取消'));
  });
}
