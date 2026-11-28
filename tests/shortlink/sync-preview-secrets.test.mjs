import {
  extractSecretKeysFromWrangler,
  parseArgs,
  parseEnvFile,
  resolveSecrets,
} from "../../scripts/sync-preview-secrets.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("sync-preview-secrets helpers", () => {
  it("parses .env files with quotes and comments", () => {
    const parsed = parseEnvFile(`
      # comment
      OPS_AGENT_SECRET="abc123"
      SHORTLINK_API_KEY='xyz=789'
      SHORTLINK_COOKIE_SECRET=plain_val
    `);
    assert.deepEqual(parsed, {
      OPS_AGENT_SECRET: "abc123",
      SHORTLINK_API_KEY: "xyz=789",
      SHORTLINK_COOKIE_SECRET: "plain_val",
    });
  });

  it("extracts preview secret keys from wrangler.jsonc comments", () => {
    const sample = `
      "previews": {
        "vars": {
          "FOO": "bar"
          // - OPS_AGENT_SECRET
          // - SHORTLINK_API_KEY
          // - SHORTLINK_COOKIE_SECRET
        }
      }
    `;
    assert.deepEqual(extractSecretKeysFromWrangler(sample, "previews"), [
      "OPS_AGENT_SECRET",
      "SHORTLINK_API_KEY",
      "SHORTLINK_COOKIE_SECRET",
    ]);
  });

  it("resolves secrets with process.env overriding envFile and tracks missing keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "sync-secrets-test-"));
    try {
      const envPath = join(dir, ".env.local");
      writeFileSync(envPath, 'OPS_AGENT_SECRET="from-file"\nSHORTLINK_API_KEY="file-key"\n');
      const res = resolveSecrets({
        keys: ["OPS_AGENT_SECRET", "SHORTLINK_API_KEY", "SHORTLINK_COOKIE_SECRET"],
        env: { OPS_AGENT_SECRET: "from-env" },
        envFilePath: envPath,
      });
      assert.deepEqual(res.found, {
        OPS_AGENT_SECRET: "from-env",
        SHORTLINK_API_KEY: "file-key",
      });
      assert.deepEqual(res.missing, ["SHORTLINK_COOKIE_SECRET"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses CLI flags cleanly", () => {
    const opts = parseArgs(["--apply", "--keys", "A,B", "-c", "workers/shortlink/wrangler.jsonc"]);
    assert.equal(opts.apply, true);
    assert.deepEqual(opts.keys, ["A", "B"]);
    assert.equal(opts.config, "workers/shortlink/wrangler.jsonc");
  });
});
