if (typeof globalThis.indexedDB === "undefined") {
  void import("fake-indexeddb/auto");
}
