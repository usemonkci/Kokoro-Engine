export const MEMORY_MODEL_DIALOG_EVENT = "kokoro:open-memory-model-download-dialog";

export function requestMemoryModelDialog(): void {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new CustomEvent(MEMORY_MODEL_DIALOG_EVENT));
}
