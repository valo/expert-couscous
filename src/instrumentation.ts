export async function register() {
  if (typeof globalThis !== "undefined" && !("indexedDB" in globalThis)) {
    await import("fake-indexeddb/auto");
  }
}
