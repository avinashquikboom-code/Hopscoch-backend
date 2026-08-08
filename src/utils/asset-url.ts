const PRODUCTION_API = 'https://api.fciseller.com';

/**
 * Base URL for publicly stored assets (S3 CDN or production API proxy).
 * Never returns localhost — dev uploads must not leak local URLs into the DB.
 */
export function getPublicAssetBaseUrl(): string {
  const cdn =
    process.env.S3_PUBLIC_BASE_URL?.trim() ||
    process.env.AWS_S3_PUBLIC_BASE_URL?.trim();
  if (cdn) {
    return cdn.replace(/\/$/, '');
  }

  const api = (process.env.API_URL || PRODUCTION_API).trim().replace(/\/$/, '');
  if (
    api.includes('localhost') ||
    api.includes('127.0.0.1') ||
    api.includes('10.0.2.2')
  ) {
    return PRODUCTION_API;
  }
  return api;
}

export function usesDirectS3PublicUrl(): boolean {
  return Boolean(
    process.env.S3_PUBLIC_BASE_URL?.trim() ||
      process.env.AWS_S3_PUBLIC_BASE_URL?.trim()
  );
}

/**
 * Build a stable public URL for an object stored in S3 (key = folder/file.jpg).
 */
export function buildPublicAssetUrl(s3Key: string): string {
  const key = s3Key.replace(/^\/+/, '');
  const base = getPublicAssetBaseUrl();

  if (usesDirectS3PublicUrl()) {
    return `${base}/${key}`;
  }

  return `${base}/api/uploads/${key}`;
}

/**
 * Normalize legacy / dev URLs to production-safe asset URLs.
 */
export function normalizeAssetUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  if (/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      let path = parsed.pathname;
      if (path.startsWith('/uploads/') && !path.startsWith('/api/uploads/')) {
        path = `/api/uploads/${path.slice('/uploads/'.length)}`;
      }
      return `${getPublicAssetBaseUrl()}${path}${parsed.search || ''}`;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/api/uploads/')) {
    return `${getPublicAssetBaseUrl()}${trimmed}`;
  }

  if (trimmed.startsWith('/uploads/')) {
    return `${getPublicAssetBaseUrl()}/api/uploads/${trimmed.slice('/uploads/'.length)}`;
  }

  if (trimmed.startsWith('/')) {
    return `${getPublicAssetBaseUrl()}${trimmed}`;
  }

  return trimmed;
}

/**
 * Extract S3 object key from a stored URL, relative path, or raw key.
 */
export function extractS3KeyFromUrl(fileUrlOrKey: string): string {
  const trimmed = fileUrlOrKey.trim();
  if (!trimmed) return trimmed;

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    let key = trimmed.replace(/^\/+/, '');
    if (key.startsWith('api/uploads/')) {
      key = key.slice('api/uploads/'.length);
    } else if (key.startsWith('uploads/')) {
      key = key.slice('uploads/'.length);
    }
    return key;
  }

  try {
    const parsed = new URL(trimmed);
    let path = parsed.pathname.replace(/^\/+/, '');
    if (path.startsWith('api/uploads/')) {
      path = path.slice('api/uploads/'.length);
    } else if (path.startsWith('uploads/')) {
      path = path.slice('uploads/'.length);
    }
    return path;
  } catch {
    return trimmed;
  }
}
