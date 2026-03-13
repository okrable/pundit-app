import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_LOG_KEY = '@pundit_debug_log';
const MAX_LOG_ENTRIES = 200;

export interface DebugLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  details?: string;
}

let sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let memoryLog: DebugLogEntry[] = [];
let isLoaded = false;
let writeQueue = Promise.resolve();

function normalizeDetails(details?: unknown): string | undefined {
  if (details === undefined || details === null) {
    return undefined;
  }

  if (details instanceof Error) {
    return `${details.name}: ${details.message}${details.stack ? `\n${details.stack}` : ''}`;
  }

  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch (error) {
    return String(details);
  }
}

async function loadLogs(): Promise<void> {
  if (isLoaded) {
    return;
  }

  try {
    const raw = await AsyncStorage.getItem(DEBUG_LOG_KEY);
    if (raw) {
      memoryLog = JSON.parse(raw) as DebugLogEntry[];
    }
  } catch (error) {
    console.error('Failed to load debug logs:', error);
    memoryLog = [];
  } finally {
    isLoaded = true;
  }
}

function enqueuePersist(): void {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      await AsyncStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(memoryLog.slice(-MAX_LOG_ENTRIES)));
    })
    .catch((error) => {
      console.error('Failed to persist debug logs:', error);
    });
}

export async function appendDebugLog(
  level: DebugLogEntry['level'],
  event: string,
  details?: unknown
): Promise<void> {
  await loadLogs();

  const entry: DebugLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    details: normalizeDetails(details),
  };

  memoryLog = [...memoryLog, entry].slice(-MAX_LOG_ENTRIES);
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleMethod(`[debug:${sessionId}] ${event}`, entry.details ?? '');
  enqueuePersist();
}

export function logInfo(event: string, details?: unknown): void {
  void appendDebugLog('info', event, details);
}

export function logWarn(event: string, details?: unknown): void {
  void appendDebugLog('warn', event, details);
}

export function logError(event: string, details?: unknown): void {
  void appendDebugLog('error', event, details);
}

export async function startDebugSession(reason: string): Promise<void> {
  sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await appendDebugLog('info', 'session.start', { sessionId, reason });
}

export async function getDebugLogText(): Promise<string> {
  await loadLogs();
  return memoryLog
    .map((entry) => {
      const details = entry.details ? ` | ${entry.details}` : '';
      return `${entry.timestamp} [${entry.level}] ${entry.event}${details}`;
    })
    .join('\n');
}

export async function clearDebugLogs(): Promise<void> {
  memoryLog = [];
  isLoaded = true;
  await AsyncStorage.removeItem(DEBUG_LOG_KEY);
}
