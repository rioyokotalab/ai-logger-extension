(function () {
  console.log("[AI Logger] Gemini content script loaded");

  // Gemini messages live under #chat-history as custom elements:
  //   user-query-content  -> your prompts
  //   message-content     -> Gemini's replies
  // (based on public bookmarklets & selectors)  [oai_citation:1‡GitHub](https://github.com/give-me/bookmarklets?utm_source=chatgpt.com)
  const EVENTS_SELECTOR = "user-query-content, message-content";

  const loggedTextByElement = new WeakMap();
  let scanTimeoutId = null;

  function sendLogViaBackground(data) {
    console.log("[AI Logger/Gemini] sending message to background", data);
    chrome.runtime.sendMessage(
      { type: "ai-logger-log", data },
      (response) => {
        console.log("[AI Logger/Gemini] background response:", response);
      }
    );
  }

  function sendStartupPing() {
    sendLogViaBackground({
      ts: new Date().toISOString(),
      platform: "gemini",
      role: "debug",
      content: "Gemini content script loaded"
    });
  }

  function scanMessages() {
    const chatRoot = document.querySelector("#chat-history") || document.body;
    if (!chatRoot) {
      console.warn("[AI Logger/Gemini] #chat-history not found");
      return;
    }

    const events = chatRoot.querySelectorAll(EVENTS_SELECTOR);
    console.log(
      "[AI Logger/Gemini] scanMessages, found",
      events.length,
      "events"
    );

    const now = new Date().toISOString();

    events.forEach((el, index) => {
      if (!(el instanceof Element)) return;

      // Heuristic from public scripts: events alternate user/AI:
      // index 0: user, 1: assistant, 2: user, 3: assistant, ...
      const role = index % 2 === 0 ? "user" : "assistant";

      const text = (el.innerText || "").trim();
      if (!text) return;

      const prev = loggedTextByElement.get(el);
      if (prev === text) {
        // Same element + same text as last time → skip
        return;
      }
      loggedTextByElement.set(el, text);

      const entry = {
        ts: now,
        platform: "gemini",
        role,
        content: text
      };

      console.log("[AI Logger/Gemini] logging message:", entry);
      sendLogViaBackground(entry);
    });
  }

  function scheduleScan() {
    if (scanTimeoutId !== null) {
      clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = setTimeout(() => {
      scanTimeoutId = null;
      scanMessages();
    }, 500); // wait a bit after DOM settles (handles streaming)
  }

  function startObserver() {
    const chatRoot =
      document.querySelector("#chat-history") ||
      document.querySelector("main") ||
      document.body;

    if (!chatRoot) {
      console.warn("[AI Logger/Gemini] No chat root yet, retrying...");
      setTimeout(startObserver, 1000);
      return;
    }

    console.log("[AI Logger/Gemini] Observing chat root:", chatRoot);

    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.type === "childList" || m.type === "characterData") {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        scheduleScan();
      }
    });

    observer.observe(chatRoot, {
      childList: true,
      subtree: true,
      characterData: true
    });

    sendStartupPing();
    scanMessages();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }
})();
