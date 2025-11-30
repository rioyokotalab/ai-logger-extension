chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ai-logger-log") {
    const payload = message.data;
    console.log("[AI Logger BG] received log message", payload);

    fetch("http://127.0.0.1:8788/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(res => {
        console.log("[AI Logger BG] log response status:", res.status);
        sendResponse({ ok: true, status: res.status });
      })
      .catch(err => {
        console.error("[AI Logger BG] log error:", err);
        sendResponse({ ok: false, error: String(err) });
      });

    // Tell Chrome we will respond asynchronously
    return true;
  }
});
