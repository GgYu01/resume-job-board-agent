function escapedJsonString(value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `"${escaped}"`;
}

export function contactActionLabels(site) {
  const normalized = String(site || "").toLowerCase();
  if (normalized === "boss") return ["立即沟通"];
  if (normalized === "liepin") return ["聊一聊"];
  return [];
}

export function contactTriggerExpression(site) {
  const labels = contactActionLabels(site);
  const labelsLiteral = `[${labels.map(escapedJsonString).join(",")}]`;
  return `(() => {
    const labels = ${labelsLiteral};
    const norm = (value) => String(value || "")
      .replace(/\\u00a0/g, " ")
      .replace(/[ \\t\\r\\n]+/g, " ")
      .trim();
    const compact = (value) => norm(value).replace(/\\s+/g, "");
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle ? window.getComputedStyle(el) : {};
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 1, height: 1 };
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 &&
        rect.width > 0 && rect.height > 0;
    };
    const isDisabled = (el) => Boolean(
      el?.disabled ||
      el?.getAttribute?.("disabled") !== null ||
      /true/i.test(String(el?.getAttribute?.("aria-disabled") || ""))
    );
    const clickableFor = (el) => el.closest?.("button,a,[role='button'],.btn,.button,.op-btn,.chat-btn") || el;
    const textFor = (el) => norm([
      el.innerText,
      el.textContent,
      el.value,
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title"),
    ].filter(Boolean).join(" "));

    if (!labels.length) {
      return JSON.stringify({ supported: false, attempted: false, clicked: false, reason: "unsupported-site", url: location.href });
    }

    const elements = Array.from(document.querySelectorAll("button,a,[role='button'],div,span"));
    for (const label of labels) {
      const wanted = compact(label);
      for (const el of elements) {
        const text = textFor(el);
        if (!text || compact(text) !== wanted) continue;
        const target = clickableFor(el);
        if (!isVisible(target) || isDisabled(target)) continue;
        target.scrollIntoView?.({ block: "center", inline: "center" });
        target.click();
        return JSON.stringify({
          supported: true,
          attempted: true,
          clicked: true,
          label,
          text,
          url: location.href,
          title: document.title || ""
        });
      }
    }

    return JSON.stringify({
      supported: true,
      attempted: true,
      clicked: false,
      reason: "button-not-found",
      labels,
      url: location.href,
      title: document.title || ""
    });
  })()`;
}
