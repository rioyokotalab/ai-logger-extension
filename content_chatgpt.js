(function () {
  console.log("[AI Logger] ChatGPT content script loaded");

  const loggedTextByElement = new WeakMap();
  let scanTimeoutId = null;

  function sendLogViaBackground(data) {
    console.log("[AI Logger] sending message to background", data);
    chrome.runtime.sendMessage(
      { type: "ai-logger-log", data },
      response => {
        console.log("[AI Logger] background response:", response);
      }
    );
  }

  // One-time debug ping so we know things are wired up
  function sendStartupPing() {
    sendLogViaBackground({
      ts: new Date().toISOString(),
      platform: "chatgpt",
      role: "debug",
      content: "ChatGPT content script loaded"
    });
  }

  // Scan all assistant messages and log if content changed
  function scanMessages() {
    const nodes = document.querySelectorAll("[data-message-author-role]");
    const now = new Date().toISOString();

    nodes.forEach(node => {
      if (!(node instanceof Element)) return;

      const role = node.getAttribute("data-message-author-role") || "unknown";
      const text = (node.innerText || "").trim();
      if (!text) return;

      const prevText = loggedTextByElement.get(node);
      if (prevText === text) {
        // No change since last log, skip
        return;
      }

      loggedTextByElement.set(node, text);

      const entry = {
        ts: now,
        platform: "chatgpt",
        role,
        content: text
      };

      console.log("[AI Logger] Logging assistant message:", entry);
      sendLogViaBackground(entry);
    });
  }

  // Debounced scan: don’t run on every tiny mutation
  function scheduleScan() {
    if (scanTimeoutId !== null) {
      clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = setTimeout(() => {
      scanTimeoutId = null;
      scanMessages();
    }, 500); // 0.5s after last mutation
  }

  function startObserver() {
    const chatRoot = document.querySelector("main") || document.body;
    if (!chatRoot) {
      console.warn("[AI Logger] No chat root found, retrying...");
      setTimeout(startObserver, 1000);
      return;
    }

    console.log("[AI Logger] Observing chat root:", chatRoot);

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

    // Initial scan + ping
    sendStartupPing();
    scanMessages();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }
})();
