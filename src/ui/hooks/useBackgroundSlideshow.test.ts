import { describe, expect, it } from "vitest";
import {
    DEFAULT_BACKGROUND_CONFIG,
    normalizeBackgroundConfigForImageCount,
    type BackgroundConfig,
} from "./useBackgroundSlideshow";

describe("background slideshow config", () => {
    it("defaults the built-in preset background to static mode", () => {
        expect(DEFAULT_BACKGROUND_CONFIG.mode).toBe("static");
    });

    it("normalizes slideshow mode to static when no imported images exist", () => {
        const config: BackgroundConfig = {
            ...DEFAULT_BACKGROUND_CONFIG,
            mode: "slideshow",
        };

        expect(normalizeBackgroundConfigForImageCount(config, 0).mode).toBe("static");
    });

    it("keeps slideshow mode when imported images exist", () => {
        const config: BackgroundConfig = {
            ...DEFAULT_BACKGROUND_CONFIG,
            mode: "slideshow",
        };

        expect(normalizeBackgroundConfigForImageCount(config, 2).mode).toBe("slideshow");
    });

    it("keeps generated mode even without imported images", () => {
        const config: BackgroundConfig = {
            ...DEFAULT_BACKGROUND_CONFIG,
            mode: "generated",
        };

        expect(normalizeBackgroundConfigForImageCount(config, 0).mode).toBe("generated");
    });
});
