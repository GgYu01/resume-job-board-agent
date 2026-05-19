import { redactSensitiveEvidence } from "../privacy/redact.mjs";

function escapedJsonLiteral(value) {
  return JSON.stringify(value)
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function expressionCommonSource() {
  return `
    const norm = (value) => String(value || "")
      .replace(/\\u00a0/g, " ")
      .replace(/[ \\t]+/g, " ")
      .replace(/\\n{3,}/g, "\\n\\n")
      .trim();
    const compact = (value) => norm(value).replace(/\\s+/g, "");
    const attr = (el, name) => el?.getAttribute ? el.getAttribute(name) || "" : "";
    const classFor = (el) => String(el?.className?.baseVal || el?.className || "");
    const tagFor = (el) => String(el?.tagName || "").toLowerCase();
    const textFor = (el) => norm([
      el?.innerText,
      el?.textContent,
      el?.value,
      attr(el, "aria-label"),
      attr(el, "title"),
    ].filter(Boolean).join("\\n"));
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle ? window.getComputedStyle(el) : {};
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 1, height: 1 };
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 &&
        rect.width > 0 && rect.height > 0;
    };
    const hashText = (text) => {
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(36);
    };
    const selectorHint = (el) => {
      const classes = classFor(el).split(/\\s+/).filter(Boolean).slice(0, 3).join(".");
      return classes ? tagFor(el) + "." + classes : tagFor(el);
    };
    const interactionTargetFor = (el) => {
      if (wantedSite === "boss") return el?.querySelector?.(".friend-content") || el;
      return el;
    };
    const clickConversationTarget = (el) => {
      const target = interactionTargetFor(el) || el;
      target?.scrollIntoView?.({ block: "center", inline: "center" });
      const rect = target?.getBoundingClientRect ? target.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
      const clientX = Number(rect.left || 0) + Math.min(Number(rect.width || 1) - 4, Math.max(4, Number(rect.width || 1) / 2));
      const clientY = Number(rect.top || 0) + Math.min(Number(rect.height || 1) - 4, Math.max(4, Number(rect.height || 1) / 2));
      if (target?.dispatchEvent && typeof MouseEvent === "function") {
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
          target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            view: window,
          }));
        }
      }
      target?.click?.();
      return {
        selectorHint: selectorHint(target),
        textSample: textFor(target).slice(0, 180),
        rect: {
          left: Math.round(Number(rect.left || 0)),
          top: Math.round(Number(rect.top || 0)),
          width: Math.round(Number(rect.width || 0)),
          height: Math.round(Number(rect.height || 0)),
        },
      };
    };
    const isOnScreen = (el) => {
      const rect = el?.getBoundingClientRect ? el.getBoundingClientRect() : { top: 0, bottom: 1 };
      return Number(rect.bottom || 0) >= -20 && Number(rect.top || 0) <= (window.innerHeight || 900) + 80;
    };
    const hasBossFriendItems = () => Array.from(document.querySelectorAll(".friend-content-warp"))
      .some((el) => isVisible(el) && isOnScreen(el) && textFor(el).length >= 4);
    const conversationCandidateScore = (el, options = {}) => {
      if (!isVisible(el)) return -1000;
      if (!isOnScreen(el)) return -1000;
      const text = textFor(el);
      const classes = classFor(el);
      const bundle = compact([text, classes, attr(el, "role")].join(" "));
      const bossStrict = wantedSite === "boss" && options.preferBossFriendItems;
      if (bossStrict && !/\\bfriend-content-warp\\b/i.test(classes)) return -1000;
      if (text.length < 4 || text.length > 700) return -1000;
      if (/list|wrapper|container|panel/i.test(classes) && Array.from(el.children || []).length > 1) return -1000;
      if (/\\b(chat-container|chat-wrap|list-warp|chat-user|chat-content|user-list|user-list-content|label-list|user-nav|nav-list|figure|name-box|name-text|message-status)\\b/i.test(classes)) return -1000;
      if (/\\u53d1\\u7b80\\u5386|\\u6362\\u5fae\\u4fe1|\\u4ea4\\u6362\\u5fae\\u4fe1|\\u53d1\\u9001|\\u8f93\\u5165\\u6d88\\u606f|Enter|Ctrl\\+Enter/i.test(bundle)) return -1000;
      if (/toolbar|chat-controls|message-content|chat-input|editor|textarea|send/i.test(classes)) return -1000;
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, left: 0 };
      let score = 0;
      if (/\\bfriend-content-warp\\b/i.test(classes)) score += 140;
      if (/conversation|session|chat-list|chat-item|friend|contact|boss|item/i.test(classes)) score += 80;
      if (/active|selected|current/i.test(classes)) score += 10;
      if (/\\n/.test(text)) score += 15;
      if (rect.left <= Math.max(520, (window.innerWidth || 1280) * 0.55)) score += 12;
      if (rect.width <= Math.max(520, (window.innerWidth || 1280) * 0.65)) score += 8;
      if (/message|record|bubble|content/i.test(classes) && rect.width > 300) score -= 80;
      return score;
    };
    const conversationCandidates = (max) => {
      const elements = Array.from(document.querySelectorAll("*"));
      const preferBossFriendItems = wantedSite === "boss" && hasBossFriendItems();
      const seen = new Set();
      const candidates = [];
      for (const el of elements) {
        const score = conversationCandidateScore(el, { preferBossFriendItems });
        if (score <= 0) continue;
        const text = textFor(el);
        const keyText = compact(text.slice(0, 220));
        if (!keyText || seen.has(keyText)) continue;
        seen.add(keyText);
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : {};
        const index = candidates.length;
        const auditKey = wantedSite + ":" + index + ":" + hashText(keyText);
        candidates.push({
          auditKey,
          index,
          site: wantedSite,
          textSample: text.slice(0, 360),
          active: /active|selected|current/i.test(classFor(el)),
          selectorHint: selectorHint(el),
          score: Math.round(score * 1000) / 1000,
          rect: {
            left: Math.round(Number(rect.left || 0)),
            top: Math.round(Number(rect.top || 0)),
            width: Math.round(Number(rect.width || 0)),
            height: Math.round(Number(rect.height || 0)),
          },
          target: el,
        });
        if (candidates.length >= max) break;
      }
      return candidates;
    };
  `;
}

export function conversationListExpression(site, { max = 20 } = {}) {
  const payloadLiteral = escapedJsonLiteral({
    site: String(site || "").toLowerCase(),
    max: Math.max(1, Number(max) || 20),
  });
  return `(() => {
    const payload = ${payloadLiteral};
    const wantedSite = payload.site || "";
    ${expressionCommonSource()}
    const candidates = conversationCandidates(payload.max).map(({ target, ...item }) => item);
    return JSON.stringify({
      marker: "__JOB_BOARD_CONVERSATION_AUDIT_LIST__",
      site: wantedSite,
      url: location.href,
      title: document.title || "",
      candidates,
      count: candidates.length,
    });
  })()`;
}

export function conversationSelectExpression(site, { auditKey = "", index = -1 } = {}) {
  const payloadLiteral = escapedJsonLiteral({
    site: String(site || "").toLowerCase(),
    auditKey: String(auditKey || ""),
    index: Number(index),
  });
  return `(() => {
    const payload = ${payloadLiteral};
    const wantedSite = payload.site || "";
    ${expressionCommonSource()}
    const candidates = conversationCandidates(200);
    const selected = candidates.find((item) => item.auditKey === payload.auditKey) ||
      candidates.find((item) => item.index === payload.index);
    if (!selected) {
      return JSON.stringify({
        marker: "__JOB_BOARD_CONVERSATION_AUDIT_SELECT__",
        site: wantedSite,
        selected: false,
        auditKey: payload.auditKey,
        index: payload.index,
        count: candidates.length,
        url: location.href,
        title: document.title || "",
      });
    }
    const clickedTarget = clickConversationTarget(selected.target);
    const { target, ...candidate } = selected;
    return JSON.stringify({
      marker: "__JOB_BOARD_CONVERSATION_AUDIT_SELECT__",
      site: wantedSite,
      selected: true,
      candidate,
      clickedTarget,
      url: location.href,
      title: document.title || "",
    });
  })()`;
}

function actionStatus(action = {}) {
  if (action.clicked) return "clicked";
  if (action.available) return "available";
  if (action.unavailable || action.status === "platform-unavailable") return "platform-unavailable";
  if (action.alreadySatisfied || action.status === "already-satisfied") return "already-satisfied";
  return action.status || "unknown";
}

export function summarizeConversationAuditResults(conversations = []) {
  const summary = {
    conversation_count: conversations.length,
    available_resume_count: 0,
    available_wechat_count: 0,
    clicked_resume_count: 0,
    clicked_wechat_count: 0,
    platform_unavailable_count: 0,
    already_satisfied_count: 0,
    action_not_found_count: 0,
    message_sent_count: 0,
  };
  for (const item of conversations || []) {
    const followup = item.followup || {};
    summary.message_sent_count += Number(followup.sentMessageCount || 0);
    for (const action of followup.actions || []) {
      const type = String(action.type || "");
      const status = actionStatus(action);
      if (type === "resume" && status === "available") summary.available_resume_count += 1;
      if (type === "wechat" && status === "available") summary.available_wechat_count += 1;
      if (type === "resume" && status === "clicked") summary.clicked_resume_count += 1;
      if (type === "wechat" && status === "clicked") summary.clicked_wechat_count += 1;
      if (status === "platform-unavailable") summary.platform_unavailable_count += 1;
      if (status === "already-satisfied") summary.already_satisfied_count += 1;
      if (status === "action-not-found") summary.action_not_found_count += 1;
    }
  }
  return summary;
}

const REDACT_KEYS = new Set([
  "text",
  "textSample",
  "targetText",
  "sample",
  "activeConversationSample",
  "bodySample",
  "snippet",
]);

export function sanitizeConversationAuditResult(result = {}) {
  if (Array.isArray(result)) return result.map((item) => sanitizeConversationAuditResult(item));
  if (!result || typeof result !== "object") {
    return typeof result === "string" ? redactSensitiveEvidence(result) : result;
  }
  const out = {};
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      out[key] = REDACT_KEYS.has(key) ? redactSensitiveEvidence(value) : value;
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) => sanitizeConversationAuditResult(item));
    } else if (value && typeof value === "object") {
      out[key] = sanitizeConversationAuditResult(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
