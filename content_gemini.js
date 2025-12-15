// content_gemini.js
(function () {
  console.log("[AI Logger] Gemini content script loaded");

  // We'll be generous with selectors because Gemini's DOM can differ by region/account.
  // We dedupe per element so a bit of extra noise is okay.
  const MESSAGE_SELECTOR = [
    "user-query-content",
    "message-content",
    "model-response-content",
    "[data-message-author]",
    "[data-utterance-role]",
    "[data-testid*='message']",
    "[data-qa*='message']"
  ].join(",");

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

  function guessRole(el, index) {
    if (!(el instanceof Element)) return "unknown";

    const tag = el.tagName.toLowerCase();
    const classes = (el.className || "").toString().toLowerCase();
    const attrs = [
      el.getAttribute("data-message-author"),
      el.getAttribute("data-utterance-role"),
      el.getAttribute("data-testid"),
      el.getAttribute("data-qa")
    ]
      .filter(Boolean)
      .map((v) => v.toLowerCase())
      .join(" ");

    const blob = [tag, classes, attrs].join(" ");

    if (blob.includes("user")) return "user";
    if (blob.includes("assistant")) return "assistant";
    if (blob.includes("model")) return "assistant";
    if (blob.includes("response")) return "assistant";

    // Fallback heuristic: even index = user, odd = assistant
    return index % 2 === 0 ? "user" : "assistant";
  }

  function scanMessages() {
    const chatRoot =
      document.querySelector("#chat-history") ||
      document.querySelector("main") ||
      document.body;

    if (!chatRoot) {
      console.warn("[AI Logger/Gemini] No chat root yet");
      return;
    }

    const nodes = chatRoot.querySelectorAll(MESSAGE_SELECTOR);
    console.log("[AI Logger/Gemini] scanMessages, found", nodes.length, "candidates");

    const now = new Date().toISOString();

    nodes.forEach((el, idx) => {
      if (!(el instanceof Element)) return;

      const text = (el.innerText || "").trim();
      if (!text) return;

      const prev = loggedTextByElement.get(el);
      if (prev === text) return;          // already logged this exact element text

      loggedTextByElement.set(el, text);

      const role = guessRole(el, idx);
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
    }, 500); // wait for streaming/DOM to settle
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
      if (shouldScan) scheduleScan();
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
