import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type TauriResources =
  | Record<string, string>
  | Array<string | { src?: string; source?: string; target?: string; dest?: string }>;

interface TauriConfig {
  bundle?: {
    resources?: TauriResources;
  };
}

function includesResourceMapping(resources: TauriResources | undefined, source: string, target: string): boolean {
  if (!resources) return false;

  if (Array.isArray(resources)) {
    return resources.some((resource) => {
      if (typeof resource === "string") return resource === source;

      const resourceSource = resource.src ?? resource.source;
      const resourceTarget = resource.target ?? resource.dest;
      return resourceSource === source && resourceTarget === target;
    });
  }

  return resources[source] === target;
}

describe("Tauri bundle resources", () => {
  it("bundles builtin Live2D assets where the live2d protocol resolves them", () => {
    const configPath = resolve(process.cwd(), "src-tauri", "tauri.conf.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as TauriConfig;

    expect(includesResourceMapping(config.bundle?.resources, "../public/live2d", "live2d")).toBe(true);
  });
});
