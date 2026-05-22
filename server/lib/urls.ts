const DEFAULT_API_BASE_URL = 'https://api.wolfslair.cc/api';
const DEFAULT_FRONTEND_URL = 'https://lalela.net';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  return trimTrailingSlash(process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL);
}

export function getFrontendUrl(): string {
  return trimTrailingSlash(process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL);
}

export function getAppBaseUrl(): string {
  return trimTrailingSlash(process.env.APP_BASE_URL ?? getFrontendUrl());
}