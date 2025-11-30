// content_claude.js
(function () {
  console.log("[AI Logger] Claude content script loaded");

  // Include both attribute-based selectors AND the assistant class we saw
  const MESSAGE_SELECTOR = [
    "[data-message-role]",
    "[data-message-author]",
    "[data-qa*='message']",
    "[data-testid*='message']",
    "[data-role*='assistant']",
    "[data-role*='user']",
    "div.font-claude-response"          // <--- assistant bubbles
  ].join(",");

  const loggedTextByElement = new WeakMap();
  let scanTimeoutId = null;

  function sendLogViaBackground(data) {
    console.log("[AI Logger/Claude] sending message to background", data);
    chrome.runtime.sendMessage(
      { type: "ai-logger-log", data },
      response => {
        console.log("[AI Logger/Claude] background response:", response);
      }
    );
  }

  function sendStartupPing() {
    sendLogViaBackground({
      ts: new Date().toISOString(),
      platform: "claude",
      role: "debug",
      content: "Claude content script loaded"
    });
  }

  function guessRole(node) {
    if (!(node instanceof Element)) return "unknown";

    // 1) Special case: anything with or inside .font-claude-response is ASSISTANT
    if (
      node.matches("div.font-claude-response") ||
      node.closest("div.font-claude-response")
    ) {
      return "assistant";
    }

    // 2) Otherwise, infer from data attributes
    const candidates = [
      node.getAttribute("data-message-role"),
      node.getAttribute("data-message-author"),
      node.getAttribute("data-qa-role"),
      node.getAttribute("data-role"),
      node.getAttribute("data-testid"),
      node.getAttribute("data-qa")
    ]
      .filter(Boolean)
      .map(v => v.toLowerCase());

    const joined = candidates.join(" ");

    if (joined.includes("assistant")) return "assistant";
    if (joined.includes("user")) return "user";
    if (joined.includes("system")) return "system";

    return "unknown";
  }

  function scanMessages() {
    const now = new Date().toISOString();
    const nodes = document.querySelectorAll(MESSAGE_SELECTOR);

    console.log("[AI Logger/Claude] scanMessages, found", nodes.length, "candidates");

    nodes.forEach(node => {
      if (!(node instanceof Element)) return;

      const role = guessRole(node);
      if (role === "unknown") return;

      const text = (node.innerText || "").trim();
      if (!text) return;

      const prevText = loggedTextByElement.get(node);
      if (prevText === text) {
        // same element, same text, already logged
        return;
      }

      loggedTextByElement.set(node, text);

      const entry = {
        ts: now,
        platform: "claude",
        role,
        content: text
      };

      console.log("[AI Logger/Claude] logging message:", entry);
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
    }, 500); // wait a bit after DOM changes
  }

  function startObserver() {
    const chatRoot =
      document.querySelector('[data-qa="message-list"]') ||
      document.querySelector("main") ||
      document.body;

    if (!chatRoot) {
      console.warn("[AI Logger/Claude] No chat root found, retrying...");
      setTimeout(startObserver, 1000);
      return;
    }

    console.log("[AI Logger/Claude] Observing chat root:", chatRoot);

    const observer = new MutationObserver(mutations => {
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
