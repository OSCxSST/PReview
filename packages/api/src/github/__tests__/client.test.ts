import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetInstallationOctokit = vi.fn();
const MockApp = vi.fn().mockImplementation(() => ({
  getInstallationOctokit: mockGetInstallationOctokit,
}));

vi.mock("octokit", () => ({
  App: MockApp,
}));

describe("client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env["GITHUB_APP_ID"] = "12345";
    process.env["GITHUB_APP_PRIVATE_KEY"] = "test-private-key";
    process.env["GITHUB_WEBHOOK_SECRET"] = "test-secret";
  });

  describe("getGitHubApp", () => {
    it("creates an App instance with correct config", async () => {
      const { getGitHubApp } = await import("../client.js");
      getGitHubApp();
      expect(MockApp).toHaveBeenCalledWith({
        appId: "12345",
        privateKey: "test-private-key",
        webhooks: { secret: "test-secret" },
      });
    });

    it("returns singleton on subsequent calls", async () => {
      const { getGitHubApp } = await import("../client.js");
      const app1 = getGitHubApp();
      const app2 = getGitHubApp();
      expect(app1).toBe(app2);
      expect(MockApp).toHaveBeenCalledTimes(1);
    });

    it("throws when GITHUB_APP_ID is missing", async () => {
      delete process.env["GITHUB_APP_ID"];
      const { getGitHubApp } = await import("../client.js");
      expect(() => getGitHubApp()).toThrow(
        "GITHUB_APP_ID environment variable is required",
      );
    });

    it("throws when GITHUB_APP_PRIVATE_KEY is missing", async () => {
      delete process.env["GITHUB_APP_PRIVATE_KEY"];
      const { getGitHubApp } = await import("../client.js");
      expect(() => getGitHubApp()).toThrow(
        "GITHUB_APP_PRIVATE_KEY environment variable is required",
      );
    });

    it("throws when GITHUB_WEBHOOK_SECRET is missing", async () => {
      delete process.env["GITHUB_WEBHOOK_SECRET"];
      const { getGitHubApp } = await import("../client.js");
      expect(() => getGitHubApp()).toThrow(
        "GITHUB_WEBHOOK_SECRET environment variable is required",
      );
    });
  });

  describe("getInstallationOctokit", () => {
    it("delegates to app.getInstallationOctokit", async () => {
      const mockOctokit = { request: vi.fn() };
      mockGetInstallationOctokit.mockResolvedValue(mockOctokit);
      const { getInstallationOctokit } = await import("../client.js");
      const result = await getInstallationOctokit(42);
      expect(mockGetInstallationOctokit).toHaveBeenCalledWith(42);
      expect(result).toBe(mockOctokit);
    });
  });

  describe("fetchWithEtag", () => {
    it("returns fresh data on first call", async () => {
      const { fetchWithEtag } = await import("../client.js");
      const mockOctokit = {
        request: vi.fn().mockResolvedValue({
          data: { id: 1 },
          headers: { etag: '"abc123"' },
        }),
      };

      const result = await fetchWithEtag(
        mockOctokit as never,
        "GET /repos/{owner}/{repo}",
        { owner: "test", repo: "repo" },
      );

      expect(result.data).toEqual({ id: 1 });
      expect(result.fromCache).toBe(false);
    });

    it("sends if-none-match header when cache exists", async () => {
      const { fetchWithEtag } = await import("../client.js");
      const mockOctokit = {
        request: vi.fn().mockResolvedValue({
          data: { id: 1 },
          headers: { etag: '"abc123"' },
        }),
      };

      // First call populates cache
      await fetchWithEtag(mockOctokit as never, "GET /test", {});

      // Second call with fresh data
      mockOctokit.request.mockResolvedValue({
        data: { id: 2 },
        headers: { etag: '"def456"' },
      });
      await fetchWithEtag(mockOctokit as never, "GET /test", {});

      expect(mockOctokit.request).toHaveBeenLastCalledWith("GET /test", {
        headers: { "if-none-match": '"abc123"' },
      });
    });

    it("returns cached data on 304 response", async () => {
      const { fetchWithEtag } = await import("../client.js");
      const mockOctokit = {
        request: vi.fn().mockResolvedValue({
          data: { id: 1, name: "cached" },
          headers: { etag: '"etag304"' },
        }),
      };

      // First call populates cache
      await fetchWithEtag(mockOctokit as never, "GET /cached", {});

      // Second call returns 304
      const error304 = Object.assign(new Error("Not Modified"), {
        status: 304,
      });
      mockOctokit.request.mockRejectedValue(error304);

      const result = await fetchWithEtag(
        mockOctokit as never,
        "GET /cached",
        {},
      );
      expect(result.data).toEqual({ id: 1, name: "cached" });
      expect(result.fromCache).toBe(true);
    });

    it("throws non-304 errors", async () => {
      const { fetchWithEtag } = await import("../client.js");
      const mockOctokit = {
        request: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("Rate limited"), { status: 429 }),
          ),
      };

      await expect(
        fetchWithEtag(mockOctokit as never, "GET /error", {}),
      ).rejects.toThrow("Rate limited");
    });

    it("throws 304 when no cached data exists", async () => {
      const { fetchWithEtag } = await import("../client.js");
      const mockOctokit = {
        request: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("Not Modified"), { status: 304 }),
          ),
      };

      await expect(
        fetchWithEtag(mockOctokit as never, "GET /no-cache", {}),
      ).rejects.toThrow("Not Modified");
    });

    it("handles response without etag header", async () => {
      const { fetchWithEtag } = await import("../client.js");
      const mockOctokit = {
        request: vi.fn().mockResolvedValue({
          data: { id: 1 },
          headers: {},
        }),
      };

      const result = await fetchWithEtag(
        mockOctokit as never,
        "GET /no-etag",
        {},
      );
      expect(result.data).toEqual({ id: 1 });
      expect(result.fromCache).toBe(false);
    });
  });

  describe("paginateAll", () => {
    it("calls octokit.paginate with per_page 100", async () => {
      const { paginateAll } = await import("../client.js");
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      };

      const result = await paginateAll(
        mockOctokit as never,
        "GET /repos/{owner}/{repo}/pulls",
        { owner: "test", repo: "repo" },
      );

      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/pulls",
        { per_page: 100, owner: "test", repo: "repo" },
      );
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("uses default empty params", async () => {
      const { paginateAll } = await import("../client.js");
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue([]),
      };

      await paginateAll(mockOctokit as never, "GET /test");
      expect(mockOctokit.paginate).toHaveBeenCalledWith("GET /test", {
        per_page: 100,
      });
    });
  });
});
