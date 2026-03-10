import { App, type Octokit } from "octokit";

export type InstallationOctokit = InstanceType<typeof Octokit>;

let app: InstanceType<typeof App> | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function getGitHubApp(): InstanceType<typeof App> {
  if (app) return app;

  app = new App({
    appId: getRequiredEnv("GITHUB_APP_ID"),
    privateKey: getRequiredEnv("GITHUB_APP_PRIVATE_KEY"),
    webhooks: {
      secret: getRequiredEnv("GITHUB_WEBHOOK_SECRET"),
    },
  });

  return app;
}

export async function getInstallationOctokit(
  installationId: number,
): Promise<InstallationOctokit> {
  return getGitHubApp().getInstallationOctokit(
    installationId,
  ) as Promise<InstallationOctokit>;
}

/** ETag cache for conditional requests to reduce rate limit consumption. */
const ETAG_CACHE_MAX_SIZE = 1000;
const etagCache = new Map<string, { etag: string; data: unknown }>();

/**
 * Make a GitHub API request with ETag caching.
 * Returns cached data with a 304 response, or fresh data otherwise.
 */
export async function fetchWithEtag<T>(
  octokit: InstallationOctokit,
  route: string,
  params: Record<string, unknown> = {},
): Promise<{ data: T; fromCache: boolean }> {
  const cacheKey = `${route}:${JSON.stringify(params)}`;
  const cached = etagCache.get(cacheKey);

  const headers: Record<string, string> = {};
  if (cached) {
    headers["if-none-match"] = cached.etag;
  }

  try {
    const response = await octokit.request(route, {
      ...params,
      headers,
    });

    const etag = response.headers.etag;
    if (etag) {
      etagCache.delete(cacheKey);
      etagCache.set(cacheKey, { etag, data: response.data });
      if (etagCache.size > ETAG_CACHE_MAX_SIZE) {
        const oldest = etagCache.keys().next().value!;
        etagCache.delete(oldest);
      }
    }

    return { data: response.data as T, fromCache: false };
  } catch (error: unknown) {
    if (
      cached &&
      error instanceof Error &&
      "status" in error &&
      (error as { status: number }).status === 304
    ) {
      return { data: cached.data as T, fromCache: true };
    }
    throw error;
  }
}

/**
 * Paginate through all pages of a GitHub API endpoint.
 */
export async function paginateAll<T>(
  octokit: InstallationOctokit,
  route: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  return octokit.paginate(route, {
    per_page: 100,
    ...params,
  }) as Promise<T[]>;
}
