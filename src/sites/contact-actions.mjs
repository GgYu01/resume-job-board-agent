function escapedJsonString(value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `"${escaped}"`;
}

export function contactActionLabels(site) {
  const normalized = String(site || "").toLowerCase();
  if (normalized === "boss") return ["立即沟通", "继续沟通"];
  if (normalized === "liepin") return ["聊一聊", "继续聊"];
  return [];
}

function contactTriggerLabels(site) {
  const normalized = String(site || "").toLowerCase();
  const primary = contactActionLabels(normalized);
  if (normalized === "boss") return [...primary, "\u5728\u7ebf\u6c9f\u901a"];
  if (normalized === "liepin") return [...primary, "\u5728\u7ebf\u6c9f\u901a", "\u7acb\u5373\u6c9f\u901a", "\u7ee7\u7eed\u6c9f\u901a"];
  return primary;
}

function normalizeTextValue(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function compactTextValue(value) {
  return normalizeTextValue(value).replace(/\s+/g, "");
}

function normalizedSite(site) {
  return String(site || "").toLowerCase();
}

export function contactVerificationOutcome(triggerResult, verification) {
  const site = normalizedSite(triggerResult?.site || verification?.site || "");
  const label = compactTextValue(triggerResult?.label || "");
  const clicked = Boolean(triggerResult?.clicked);
  const conversationOpen = Boolean(verification?.conversationOpen);
  const messageSent = Boolean(verification?.messageSent);
  const alreadyContacted = Boolean(verification?.alreadyContacted);
  const continueLabel = label === compactTextValue("继续沟通") || label === compactTextValue("继续聊");
  const directSendLabel = contactTriggerLabels(site)
    .map((item) => compactTextValue(item))
    .includes(label) && !continueLabel;
  const verified = Boolean(
    messageSent ||
    conversationOpen ||
    (clicked && directSendLabel && alreadyContacted),
  );
  const inferredMessageSent = Boolean(
    messageSent ||
    (clicked && directSendLabel && alreadyContacted && !continueLabel),
  );
  let status = verification?.status || "not-verified";
  if (!verified && status !== "not-verified" && status !== "verification-target-not-found") {
    status = `${status}-not-triggered`;
  }
  return {
    site,
    verified,
    messageSent: inferredMessageSent,
    conversationOpen,
    alreadyContacted,
    status,
    strictReason: verified
      ? "strict-contact-verified"
      : continueLabel && alreadyContacted
        ? "continue-button-marker-without-open-chat"
        : "contact-not-strictly-verified",
  };
}

export function contactActionFailures(actions) {
  return (actions || []).filter((action) => {
    const site = normalizedSite(action?.site);
    if (!["boss", "liepin"].includes(site)) return false;
    if (action?.supported === false) return false;
    return !action?.verified;
  });
}

export function contactFailureReason(failures) {
  const count = (failures || []).length;
  if (!count) return "";
  const samples = failures
    .slice(0, 3)
    .map((item) => `${item.site || "unknown"}:${item.id || item.title || item.url || item.targetId || "record"}`)
    .join(", ");
  return `contact-trigger-failed:${count}${samples ? ` (${samples})` : ""}`;
}

function contactPreferredClassTerms(site) {
  const normalized = String(site || "").toLowerCase();
  if (normalized === "boss") return ["btn-startchat", "startchat"];
  if (normalized === "liepin") return ["btn-main", "btn-chat", "chat-btn"];
  return [];
}

export function contactPageStateExpression(site) {
  const siteLiteral = escapedJsonString(site);
  return `(() => {
    const marker = "__JOB_BOARD_CONTACT_PAGE_STATE__";
    const site = String(${siteLiteral} || "").toLowerCase();
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
    const textFor = (el) => norm([
      el.innerText,
      el.textContent,
      el.value,
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title"),
      el.getAttribute?.("placeholder"),
    ].filter(Boolean).join(" "));
    const labelMatch = (text, label) => {
      const match = compact(text);
      const wanted = compact(label);
      return Boolean(match && wanted && (match === wanted || match.includes(wanted)));
    };
    const triggerLabels = site === "boss"
      ? ["\\u7acb\\u5373\\u6c9f\\u901a", "\\u7ee7\\u7eed\\u6c9f\\u901a", "\\u5728\\u7ebf\\u6c9f\\u901a"]
      : site === "liepin"
        ? ["\\u804a\\u4e00\\u804a", "\\u7acb\\u5373\\u6c9f\\u901a", "\\u5728\\u7ebf\\u6c9f\\u901a", "\\u7ee7\\u7eed\\u6c9f\\u901a"]
        : [];
    const existingLabels = site === "boss"
      ? ["\\u7ee7\\u7eed\\u6c9f\\u901a", "\\u5df2\\u6c9f\\u901a", "\\u6c9f\\u901a\\u8fc7", "\\u5df2\\u804a"]
      : site === "liepin"
        ? ["\\u5df2\\u804a", "\\u5df2\\u804a\\u8fc7", "\\u7ee7\\u7eed\\u804a", "\\u7ee7\\u7eed\\u6c9f\\u901a", "\\u6c9f\\u901a\\u8fc7", "\\u5df2\\u6c9f\\u901a"]
        : [];
    const elements = Array.from(document.querySelectorAll("button,a,[role='button'],div,span,textarea,input,[contenteditable='true']"));
    const visibleItems = elements
      .filter(isVisible)
      .map((el) => ({
        tag: String(el.tagName || "").toUpperCase(),
        text: textFor(el),
        role: String(el.getAttribute?.("role") || ""),
        className: String(el.className || ""),
        href: el.href || "",
      }));
    const visibleText = norm(visibleItems.map((item) => item.text).join(" "));
    const classText = visibleItems.map((item) => item.className).join(" ");
    const body = norm(document.body ? document.body.innerText : visibleText);
    const url = location.href;
    const actionable = (item) => /^(A|BUTTON)$/.test(item.tag) ||
      item.role === "button" ||
      /btn|button|chat|startchat|op-btn|main|operate/i.test(item.className);
    const textBundle = (item) => [item.text, item.className, item.href].join(" ");
    const matchingItems = (labels) => visibleItems.filter((item) =>
      actionable(item) && labels.some((label) => labelMatch(textBundle(item), label))
    );
    const triggerItems = matchingItems(triggerLabels);
    const existingItems = matchingItems(existingLabels);
    const bossChatUrl = /zhipin\\.com\\/web\\/geek\\/(?:chat|message)|\\/chat/i.test(url);
    const liepinChatUrl = /liepin\\.com\\/(?:message|im|chat)|\\/im\\//i.test(url);
    const chatUrl = site === "boss" ? bossChatUrl : site === "liepin" ? liepinChatUrl : bossChatUrl || liepinChatUrl;
    const chatUi = /zpchat|chat-modal|chat-list|message-list|chat-panel|chat-window|im-chat|im-session|im-message|im-ui-(?:chat|session|message)/i.test(classText) ||
      visibleItems.some((item) => /^(TEXTAREA|INPUT)$/.test(item.tag) && /\\u53d1\\u9001|\\u56de\\u590d|\\u8f93\\u5165\\u6d88\\u606f|\\u6d88\\u606f\\u5185\\u5bb9|\\u6c9f\\u901a\\u5185\\u5bb9/.test(item.text));
    const alreadyText = site === "boss"
      ? /\\u7ee7\\u7eed\\u6c9f\\u901a|\\u5df2\\u6c9f\\u901a|\\u6c9f\\u901a\\u8fc7|\\u5df2\\u804a/.test(visibleText)
      : /\\u5df2\\u804a|\\u5df2\\u804a\\u8fc7|\\u7ee7\\u7eed\\u804a|\\u7ee7\\u7eed\\u6c9f\\u901a|\\u6c9f\\u901a\\u8fc7|\\u5df2\\u6c9f\\u901a/.test(visibleText);
    const outgoingDefaultMessage = /(?:\\u60a8\\u597d|\\u4f60\\u597d|\\u6211).{0,30}(?:\\u804c\\u4f4d|\\u5c97\\u4f4d).{0,50}(?:\\u611f\\u5174\\u8da3|\\u6c9f\\u901a|\\u4e86\\u89e3)|(?:\\u5bf9|\\u6211\\u5bf9).{0,30}(?:\\u804c\\u4f4d|\\u5c97\\u4f4d).{0,30}\\u611f\\u5174\\u8da3/.test(body);
    const messageSent = Boolean((chatUrl || chatUi) && outgoingDefaultMessage);
    const conversationOpen = Boolean(chatUrl || chatUi);
    const supported = ["boss", "liepin"].includes(site);
    const alreadyContacted = Boolean(conversationOpen || existingItems.length);
    const alreadySatisfied = Boolean(supported && (messageSent || conversationOpen || existingItems.length));
    const shouldTrigger = Boolean(supported && !alreadySatisfied);
    const signals = [];
    if (chatUrl) signals.push("chat-url");
    if (chatUi) signals.push("chat-ui");
    if (messageSent) signals.push("outgoing-default-message-text");
    if (existingItems.length) signals.push("existing-conversation-action");
    if (alreadyText) signals.push("already-contacted-text");
    if (triggerItems.length) signals.push("trigger-action-visible");
    const status = messageSent
      ? "sent"
      : conversationOpen
        ? "conversation-opened"
        : alreadySatisfied
          ? "existing-conversation-marker"
          : triggerItems.length
            ? "needs-trigger"
            : supported
              ? "trigger-not-visible"
              : "unsupported-site";
    return JSON.stringify({
      marker,
      supported,
      verified: alreadySatisfied,
      alreadySatisfied,
      shouldTrigger,
      triggerAvailable: triggerItems.length > 0,
      triggerLabels,
      existingLabels,
      alreadyContacted,
      messageSent,
      conversationOpen,
      status,
      signals,
      url,
      title: document.title || "",
      textSample: visibleText.slice(0, 500)
    });
  })()`;
}

export function contactTriggerExpression(site) {
  const labels = contactTriggerLabels(site);
  const labelsLiteral = `[${labels.map(escapedJsonString).join(",")}]`;
  const siteLiteral = escapedJsonString(site);
  const preferredClassTerms = contactPreferredClassTerms(site);
  const preferredClassLiteral = `[${preferredClassTerms.map(escapedJsonString).join(",")}]`;
  return `(() => {
    const labels = ${labelsLiteral};
    const site = ${siteLiteral};
    const preferredClassTerms = ${preferredClassLiteral};
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
    const clickableFor = (el) => el.closest?.("button,a,[role='button'],.btn,.button,.op-btn,.chat-btn,.btn-main,.btn-chat,.btn-startchat") || el;
    const textFor = (el) => norm([
      el.innerText,
      el.textContent,
      el.value,
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title"),
    ].filter(Boolean).join(" "));
    const classFor = (el) => String(el?.className || "");
    const tagFor = (el) => String(el?.tagName || "").toUpperCase();
    const hasPreferredClass = (el, target) => {
      const classes = [classFor(el), classFor(target)].join(" ");
      return preferredClassTerms.some((term) => classes.includes(term));
    };
    const isSafeSiteTarget = (el, target) => {
      if (String(site || "").toLowerCase() !== "liepin") return true;
      const operate = target.closest?.(".job-apply-operate,.job-detail-operate,.job-apply,.job-action,.job-actions");
      const list = target.closest?.(".job-list,.job-list-box,.recommend,.recommend-list,.similar-job,.hot-job");
      if (list && !operate) return false;
      return Boolean(operate || hasPreferredClass(el, target));
    };
    const labelMatch = (text, label) => {
      const match = compact(text);
      const wanted = compact(label);
      return Boolean(text && wanted && (match === wanted || match.includes(wanted)));
    };
    const targetScore = (el, target, label, index) => {
      const text = textFor(el);
      const targetText = textFor(target) || text;
      const wanted = compact(label);
      const match = compact(text);
      const targetMatch = compact(targetText);
      const classes = [classFor(el), classFor(target)].join(" ");
      let score = 0;
      if (target === el) score += 6;
      if (/^(A|BUTTON)$/.test(tagFor(target))) score += 25;
      if (targetMatch === wanted) score += 35;
      else if (targetMatch.includes(wanted)) score += 18;
      if (match === wanted) score += 25;
      else if (match.includes(wanted)) score += 8;
      if (preferredClassTerms.some((term) => classes.includes(term))) score += 40;
      if (/chat|沟通|聊/i.test([classes, targetText].join(" "))) score += 10;
      if (/btn-container|job-apply-operate|job-op|btns/.test(classes) && !/^(A|BUTTON)$/.test(tagFor(target))) score -= 15;
      return score - index / 10000;
    };

    if (!labels.length) {
      return JSON.stringify({ supported: false, attempted: false, clicked: false, reason: "unsupported-site", url: location.href });
    }

    const documents = [document];
    for (const frame of Array.from(window.frames || [])) {
      try {
        if (frame?.document && !documents.includes(frame.document)) documents.push(frame.document);
      } catch {
        // Ignore cross-origin frames.
      }
    }

    const candidates = [];
    for (const label of labels) {
      for (const doc of documents) {
        const elements = Array.from(doc.querySelectorAll("button,a,[role='button'],div,span"));
        for (const [index, el] of elements.entries()) {
          const text = textFor(el);
          const target = clickableFor(el);
          const targetText = textFor(target) || text;
          if (!labelMatch(text, label) && !labelMatch(targetText, label)) continue;
          if (!isVisible(target) || isDisabled(target)) continue;
          if (!isSafeSiteTarget(el, target)) continue;
          candidates.push({
            doc,
            el,
            target,
            label,
            text,
            targetText,
            score: targetScore(el, target, label, index),
          });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0];
    if (selected) {
      selected.target.scrollIntoView?.({ block: "center", inline: "center" });
      selected.target.click();
      return JSON.stringify({
        supported: true,
        attempted: true,
        clicked: true,
        label: selected.label,
        text: selected.text,
        targetText: selected.targetText,
        targetTag: tagFor(selected.target),
        targetClass: classFor(selected.target),
        score: selected.score,
        preContactState: site === "boss" && compact(selected.label) === compact("继续沟通") ? "existing-conversation-marker" : "unknown",
        url: selected.doc.location?.href || location.href,
        title: selected.doc.title || document.title || ""
      });
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

export function contactVerificationExpression(site) {
  const siteLiteral = escapedJsonString(site);
  return `(() => {
    const site = ${siteLiteral};
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
    const textFor = (el) => norm([
      el.innerText,
      el.textContent,
      el.value,
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title"),
      el.getAttribute?.("placeholder"),
    ].filter(Boolean).join(" "));
    const elements = Array.from(document.querySelectorAll("button,a,[role='button'],div,span,textarea,input,[contenteditable='true']"));
    const body = norm(document.body ? document.body.innerText : elements.map(textFor).join(" "));
    const url = location.href;
    const visibleItems = elements
      .filter(isVisible)
      .map((el) => ({
        tag: String(el.tagName || "").toUpperCase(),
        text: textFor(el),
        className: String(el.className || ""),
        href: el.href || "",
      }));
    const visibleText = norm(visibleItems.map((item) => item.text).join(" "));
    const classText = visibleItems.map((item) => item.className).join(" ");
    const all = norm([url, document.title || "", visibleText, classText].join(" "));
    const bossChatUrl = /zhipin\\.com\\/web\\/geek\\/(?:chat|message)|\\/chat/i.test(url);
    const liepinChatUrl = /liepin\\.com\\/(?:message|im|chat)|\\/im\\//i.test(url);
    const chatUrl = site === "boss" ? bossChatUrl : site === "liepin" ? liepinChatUrl : bossChatUrl || liepinChatUrl;
    const chatUi = /zpchat|chat-modal|chat-list|message-list|chat-panel|chat-window|im-chat|im-session|im-message|im-ui-(?:chat|session|message)/i.test(classText) ||
      visibleItems.some((item) => /^(TEXTAREA|INPUT)$/.test(item.tag) && /发送|回复|输入消息|请输入.{0,12}消息|消息内容|沟通内容/i.test(item.text));
    const alreadyContacted = site === "boss"
      ? /继续沟通|沟通过|已沟通/.test(visibleText)
      : /已聊|继续聊|继续沟通|沟通过|已沟通/.test(visibleText);
    const outgoingDefaultMessage = /(?:您好|你好|我).{0,30}(?:职位|岗位).{0,50}(?:感兴趣|沟通|了解)|(?:对|我对).{0,30}(?:职位|岗位).{0,30}感兴趣/.test(body);
    const messageSent = Boolean((chatUrl || chatUi) && outgoingDefaultMessage);
    const conversationOpen = Boolean(chatUrl || chatUi);
    const signals = [];
    if (chatUrl) signals.push("chat-url");
    if (chatUi) signals.push("chat-ui");
    if (alreadyContacted) signals.push("already-contacted");
    if (outgoingDefaultMessage) signals.push("outgoing-default-message-text");
    const status = messageSent
      ? "sent"
      : conversationOpen
        ? "conversation-opened"
        : alreadyContacted
          ? "existing-conversation-marker"
          : "not-verified";
    return JSON.stringify({
      supported: ["boss", "liepin"].includes(String(site || "").toLowerCase()),
      verified: messageSent || conversationOpen,
      status,
      messageSent,
      conversationOpen,
      alreadyContacted,
      signals,
      url,
      title: document.title || "",
      textSample: visibleText.slice(0, 500)
    });
  })()`;
}
