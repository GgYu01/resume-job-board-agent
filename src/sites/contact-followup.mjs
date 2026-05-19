function escapedJsonLiteral(value) {
  return JSON.stringify(value)
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export const DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE = "这是我的简历，请查收，如果方便辛苦您加我微信。";
export const DEFAULT_CONTACT_FOLLOWUP_STEP_DELAY_MS = 900;
export const DEFAULT_CONTACT_FOLLOWUP_VERIFY_DELAY_MS = 1800;
export const DEFAULT_CONTACT_FOLLOWUP_MESSAGE_MAX_CHARS = 900;

export function splitContactFollowupMessage(text, maxChars = DEFAULT_CONTACT_FOLLOWUP_MESSAGE_MAX_CHARS) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  const limit = Math.max(120, Number(maxChars) || DEFAULT_CONTACT_FOLLOWUP_MESSAGE_MAX_CHARS);
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [normalized]) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if (`${current}\n\n${paragraph}`.length <= limit) {
      current = `${current}\n\n${paragraph}`;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }
  if (current) chunks.push(current);

  const out = [];
  for (const chunk of chunks) {
    if (chunk.length <= limit) {
      out.push(chunk);
      continue;
    }
    for (let index = 0; index < chunk.length; index += limit) {
      out.push(chunk.slice(index, index + limit).trim());
    }
  }
  return out.filter(Boolean);
}

export function normalizeContactFollowupMessages({
  resumeNote = DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE,
  message = "",
  messages = [],
  maxChars = DEFAULT_CONTACT_FOLLOWUP_MESSAGE_MAX_CHARS,
} = {}) {
  const out = [];
  const note = String(resumeNote || "").trim();
  if (note) out.push(note);
  for (const item of messages || []) {
    out.push(...splitContactFollowupMessage(item, maxChars));
  }
  out.push(...splitContactFollowupMessage(message, maxChars));
  return out.filter((item, index, array) => item && array.indexOf(item) === index);
}

export function contactFollowupExpression(site, {
  resumeNote = DEFAULT_CONTACT_FOLLOWUP_RESUME_NOTE,
  messages = [],
  messagesNormalized = null,
  exchangeResume = true,
  exchangeWechat = true,
  requireExchangeActions = true,
  stepDelayMs = DEFAULT_CONTACT_FOLLOWUP_STEP_DELAY_MS,
  verifyDelayMs = DEFAULT_CONTACT_FOLLOWUP_VERIFY_DELAY_MS,
} = {}) {
  const payloadLiteral = escapedJsonLiteral({
    site: String(site || "").toLowerCase(),
    messages: Array.isArray(messagesNormalized)
      ? messagesNormalized.filter(Boolean)
      : normalizeContactFollowupMessages({ resumeNote, messages }),
    exchangeResume: exchangeResume !== false,
    exchangeWechat: exchangeWechat !== false,
    requireExchangeActions: requireExchangeActions !== false,
    stepDelayMs: Math.max(0, Number(stepDelayMs) || 0),
    verifyDelayMs: Math.max(0, Number(verifyDelayMs) || 0),
  });

  return `(() => {
    const payload = ${payloadLiteral};
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    const norm = (value) => String(value || "")
      .replace(/\\u00a0/g, " ")
      .replace(/[ \\t\\r\\n]+/g, " ")
      .trim();
    const compact = (value) => norm(value).replace(/\\s+/g, "");
    const trace = [];
    const clipped = (value, limit = 160) => norm(value).slice(0, limit);
    const addTrace = (step, data = {}) => {
      trace.push({
        order: trace.length + 1,
        at: new Date().toISOString(),
        step,
        ...data,
      });
    };
    const attr = (el, name) => el?.getAttribute ? el.getAttribute(name) || "" : "";
    const classFor = (el) => String(el?.className?.baseVal || el?.className || "");
    const collapseRepeatedText = (value) => {
      let text = norm(value);
      for (let guard = 0; guard < 4; guard += 1) {
        const parts = text.split(/\\s+/).filter(Boolean);
        if (parts.length < 2 || parts.length % 2 !== 0) break;
        const half = parts.length / 2;
        const left = parts.slice(0, half).join(" ");
        const right = parts.slice(half).join(" ");
        if (left !== right) break;
        text = left;
      }
      return text;
    };
    const uniqueStrings = (values) => {
      const seen = new Set();
      const out = [];
      for (const value of values) {
        const text = collapseRepeatedText(value);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        out.push(text);
      }
      return out;
    };
    const textFor = (el) => norm(uniqueStrings([
      el?.innerText,
      el?.textContent,
      el?.value,
      attr(el, "aria-label"),
      attr(el, "title"),
      attr(el, "placeholder"),
    ]).join(" "));
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
      /true/i.test(String(el?.getAttribute?.("aria-disabled") || "")) ||
      /disabled|is-disabled|unable/i.test(classFor(el))
    );
    const documentList = () => {
      const docs = [document];
      for (const frame of Array.from(window.frames || [])) {
        try {
          if (frame?.document && !docs.includes(frame.document)) docs.push(frame.document);
        } catch {
          // Cross-origin frames cannot be inspected.
        }
      }
      return docs;
    };
    const allElements = (selector) => documentList().flatMap((doc) => Array.from(doc.querySelectorAll(selector)));
    const bundleFor = (el) => norm([
      textFor(el),
      classFor(el),
      attr(el, "role"),
      attr(el, "aria-label"),
      attr(el, "title"),
      attr(el, "placeholder"),
      attr(el, "contenteditable"),
    ].filter(Boolean).join(" "));
    const includesAny = (value, hints) => {
      const text = compact(value).toLowerCase();
      return hints.some((hint) => text.includes(compact(hint).toLowerCase()));
    };
    const clickableFor = (el) => el?.closest?.([
      "button",
      "a",
      "[role='button']",
      ".im-ui-action-button",
      ".action-item",
      ".im-ui-basic-send-btn",
      ".btn",
      ".button",
      ".op-btn",
      ".chat-btn",
      ".toolbar-btn",
      ".btn-weixin",
      ".btn-resume",
      ".exchange",
      ".resume",
      ".wechat",
      ".resume-option",
      ".cv-option",
      ".option",
      "[role='radio']",
      "[role='checkbox']",
      "label",
    ].join(",")) || el;
    const bodyText = () => norm(document.body ? document.body.innerText : "");
    const rootText = (root) => norm(root ? [root.innerText, root.textContent].filter(Boolean).join(" ") : bodyText());
    const conversationRejected = (root = activeRoot()) =>
      /\\u4e0d\\u5408\\u9002|\\u4e0d\\u5339\\u914d|\\u4e0d\\u592a\\u5408\\u9002|\\u5f88\\u9057\\u61be|\\u6682\\u4e0d|\\u4e0d\\u7b26\\u5408|\\u4e0d\\u5b8c\\u5168\\u543b\\u5408|\\u4e0d\\u80fd\\u4e0e\\u60a8\\u5171\\u4e8b|\\u795d\\u60a8.{0,20}\\u627e\\u5230\\u66f4\\u5339\\u914d/.test(rootText(root));
    const messagePresent = (message, root = activeRoot()) => {
      const snippet = compact(String(message || "").slice(0, 80));
      if (!snippet) return false;
      return compact(rootText(root)).includes(snippet);
    };
    const findInputIn = (root) => {
      const candidates = Array.from(root.querySelectorAll?.("textarea,input,[contenteditable='true'],[contenteditable=true]") || [])
        .filter((el) => isVisible(el) && !isDisabled(el));
      candidates.sort((a, b) => {
        const aBundle = bundleFor(a);
        const bBundle = bundleFor(b);
        const score = (el, bundle) => {
          let value = 0;
          if (/TEXTAREA/i.test(el.tagName || "")) value += 30;
          if (/im-ui-textarea|chat|message|input|editor|reply|textarea/i.test([bundle, classFor(el)].join(" "))) value += 30;
          if (/发送|回复|输入|消息|沟通|文字/.test(bundle)) value += 20;
          return value;
        };
        return score(b, bBundle) - score(a, aBundle);
      });
      return candidates[0] || null;
    };
    const chatRoots = () => {
      const roots = allElements("div,section,main,[role='dialog']")
        .filter((el) => isVisible(el))
        .filter((el) => /im-ui-chat-container|im-ui-basic-chat-modal|chat-container|chat-window|chat-panel|message-panel|conversation|zpchat|chat/i.test(classFor(el)) || findInputIn(el));
      roots.sort((a, b) => {
        const score = (el) => {
          let value = 0;
          const cls = classFor(el);
          const bundle = bundleFor(el);
          if (payload.site === "boss" && /chat-conversation|chat-dialog|message-panel|chat-im/i.test(cls)) value += 180;
          if (payload.site === "boss" && /chat-container|chat-wrap|chat-panel|zpchat/i.test(cls)) value -= 50;
          if (/chat-user|friend-list|friend-content|boss-list|conversation-list|contact-list|chat-list/i.test(cls)) value -= 160;
          if (payload.site === "boss" && /toolbar-btn|btn-weixin|chat-position-content|message-content/i.test(bundle)) value += 20;
          if (/im-ui-chat-container|im-ui-basic-chat-modal|chat-container|chat-window|chat-panel|zpchat/i.test(cls)) value += 80;
          if (findInputIn(el)) value += 50;
          if (/发简历|交换微信|发送|resume|wechat|send/i.test(bundleFor(el))) value += 20;
          return value;
        };
        return score(b) - score(a);
      });
      return roots;
    };
    const activeRoot = () => chatRoots()[0] || document.body;
    const modalSelector = "[role='dialog'],.dialog-wrap,.dialog-container,.dialog-layer,.dialog-content,.ant-modal,.ant-im-modal,.ant-im-modal-wrap,.ant-im-modal-content,.ant-popover,.ant-im-popover,.popover";
    const visibleDialogText = () => norm(allElements(modalSelector)
      .filter((el) => isVisible(el))
      .map((el) => rootText(el))
      .join(" "));
    const actionAlreadySatisfied = (type) => {
      const body = norm([rootText(activeRoot()), visibleDialogText()].join(" "));
      if (payload.site === "boss" && type === "resume") return /(?:\\u9644\\u4ef6|\\u5728\\u7ebf)?\\u7b80\\u5386.{0,12}(?:\\u5df2\\u53d1\\u9001|\\u53d1\\u9001\\u6210\\u529f)|(?:\\u5df2\\u53d1\\u9001|\\u53d1\\u9001\\u6210\\u529f).{0,12}(?:\\u9644\\u4ef6|\\u5728\\u7ebf)?\\u7b80\\u5386|\\u5bf9\\u65b9\\u5df2\\u540c\\u610f.{0,12}\\u7b80\\u5386/u.test(body);
      if (payload.site === "boss" && type === "wechat") return /(?:\\u5df2\\u53d1\\u8d77|\\u5df2\\u53d1\\u9001|\\u5df2\\u7d22\\u8981|\\u7b49\\u5f85\\u5bf9\\u65b9\\u540c\\u610f|\\u5bf9\\u65b9\\u5df2\\u540c\\u610f|\\u5df2\\u540c\\u610f).{0,16}(?:\\u5fae\\u4fe1|\\u5fae\\u4fe1\\u53f7)|(?:\\u5fae\\u4fe1|\\u5fae\\u4fe1\\u53f7).{0,16}(?:\\u5df2\\u53d1\\u8d77|\\u5df2\\u53d1\\u9001|\\u5df2\\u7d22\\u8981|\\u7b49\\u5f85\\u5bf9\\u65b9\\u540c\\u610f|\\u5bf9\\u65b9\\u5df2\\u540c\\u610f|\\u5df2\\u540c\\u610f)|\\u5fae\\u4fe1\\u53f7[:\\uff1a]\\s*\\S{2,}/u.test(body);
      if (type === "resume") return /在线简历|附件简历|已发送.{0,8}简历|发送成功/.test(body);
      if (type === "wechat") return /索要中|请求中|待同意|已索要|已同意|已交换.{0,8}微信|微信号.{0,12}(?:已发送|已交换)|发起.{0,12}(?:索要|交换).{0,8}微信/.test(body);
      return false;
    };
    const modalVisible = () => allElements(modalSelector)
      .some((el) => isVisible(el));
    const selectedLike = (el) => Boolean(
      el?.checked ||
      /true/i.test(String(el?.getAttribute?.("aria-checked") || "")) ||
      /true/i.test(String(el?.getAttribute?.("aria-selected") || "")) ||
      /selected|checked|active|current|is-checked|is-selected/i.test(classFor(el))
    );
    const findResumeSelectionCandidate = () => {
      const hasVisibleModal = modalVisible();
      const candidates = allElements("input,button,a,[role='radio'],[role='checkbox'],label,li,div,span")
        .filter((el) => isVisible(el) && !isDisabled(clickableFor(el)))
        .map((el, index) => {
          const target = clickableFor(el);
          const selfText = textFor(el);
          const targetText = textFor(target);
          const text = norm(uniqueStrings([targetText, selfText]).join(" "));
          const cls = [classFor(el), classFor(target)].join(" ");
          const role = [attr(el, "role"), attr(target, "role")].join(" ");
          const typeAttr = [attr(el, "type"), attr(target, "type")].join(" ");
          const bundle = [text, cls, role, typeAttr, attr(el, "aria-label"), attr(target, "aria-label")].join(" ");
          const compactText = compact(text);
          const childCount = Number(el.querySelectorAll?.("*")?.length || 0);
          const inModal = Boolean(el.closest?.(modalSelector) || target.closest?.(modalSelector));
          const selected = selectedLike(el) || selectedLike(target);
          const hasResume = /简历|resume|cv/i.test(bundle);
          const optionish = /radio|checkbox/i.test([role, typeAttr].join(" ")) ||
            /^(LABEL|LI|INPUT)$/i.test(String(el.tagName || "")) ||
            /resume|cv|option|radio|checkbox|item|card|select|selected|checked|default/i.test(cls);
          const modalContainerish = /modal|dialog|drawer|wrap|content|header|title|space|group/i.test(cls) &&
            !/radio-wrapper|checkbox-wrapper|resume|cv|option|item|card|select/i.test(cls);
          const actionish = /^(立即投递|发送简历|确认|确定|取\s*消|取消|预览|发送|知道了|我知道了)$/.test(compactText) ||
            (/btn|button/i.test(cls) && !/option|radio|checkbox|resume|cv/i.test(cls));
          let score = 0;
          if (hasResume && optionish) score += 30;
          if (/默认在线简历|默认|在线简历|default/i.test(bundle)) score += 95;
          if (/求职简历|附件简历|上传/i.test(bundle)) score += 55;
          if (/radio|checkbox/i.test([role, typeAttr, cls].join(" "))) score += 20;
          if (/^(LABEL|INPUT)$/i.test(String(el.tagName || ""))) score += 35;
          if (selected) score += 40;
          if (!inModal) score -= 40;
          if (actionish) score -= 160;
          if (!hasResume) score -= 120;
          if (modalContainerish) score -= 180;
          if (childCount > 20) score -= 160;
          else if (childCount > 8) score -= 80;
          if (text.length > 220) score -= 100;
          return {
            el,
            target,
            text,
            cls,
            role,
            typeAttr,
            selected,
            inModal,
            childCount,
            score: score - index / 10000,
          };
        })
        .filter((item) => item.score > 0 && isVisible(item.target) && !isDisabled(item.target))
        .filter((item) => !hasVisibleModal || item.inModal)
        .sort((a, b) => b.score - a.score);
      const preferred = candidates.find((item) => item.selected) || candidates[0] || null;
      const orderedCandidates = preferred
        ? [preferred, ...candidates.filter((item) => item !== preferred)]
        : candidates;
      return {
        selected: preferred,
        candidates: orderedCandidates,
        modalVisible: hasVisibleModal,
      };
    };
    const resumeSelectionSummary = (item) => ({
      text: clipped(item.text, 120),
      targetClass: clipped(item.cls, 140),
      role: clipped(item.role, 40),
      selected: Boolean(item.selected),
      inModal: Boolean(item.inModal),
      childCount: Number(item.childCount || 0),
      score: Math.round(item.score * 1000) / 1000,
    });
    const ensureResumeSelection = async () => {
      await wait(Math.min(payload.stepDelayMs, 600));
      const found = findResumeSelectionCandidate();
      addTrace("resume.selection.search", {
        modalVisible: found.modalVisible,
        candidateCount: found.candidates.length,
        candidates: found.candidates.slice(0, 5).map(resumeSelectionSummary),
      });
      const selected = found.selected;
      if (!selected) {
        addTrace("resume.selection.not_found", { assumedSiteDefault: true });
        return {
          status: "selection-not-found",
          clicked: false,
          selected: false,
          assumedSiteDefault: true,
          candidates: [],
        };
      }
      if (selected.selected) {
        addTrace("resume.selection.already_selected", {
          text: clipped(selected.text, 120),
          targetClass: clipped(selected.cls, 140),
        });
        return {
          status: "already-selected",
          clicked: false,
          selected: true,
          selectedText: selected.text,
          targetClass: selected.cls.slice(0, 200),
          candidates: found.candidates.slice(0, 5).map(resumeSelectionSummary),
        };
      }
      selected.target.scrollIntoView?.({ block: "center", inline: "center" });
      selected.target.click();
      await wait(Math.min(payload.stepDelayMs, 700));
      const after = findResumeSelectionCandidate();
      const selectedAfter = after.candidates.find((item) => item.selected && compact(item.text) === compact(selected.text)) ||
        after.candidates.find((item) => item.selected) ||
        null;
      addTrace("resume.selection.clicked", {
        text: clipped(selected.text, 120),
        targetClass: clipped(selected.cls, 140),
        verifiedSelected: Boolean(selectedAfter),
      });
      return {
        status: selectedAfter ? "selected" : "clicked",
        clicked: true,
        selected: Boolean(selectedAfter),
        selectedText: selected.text,
        selectedAfterText: selectedAfter?.text || "",
        targetClass: selected.cls.slice(0, 200),
        candidates: found.candidates.slice(0, 5).map(resumeSelectionSummary),
      };
    };
    const confirmationSummary = (item) => ({
      text: clipped(item.text, 80),
      targetClass: clipped(item.cls, 140),
      score: Math.round(item.score * 1000) / 1000,
    });
    const confirmationLabelSpecs = (type) => type === "wechat"
      ? [
          ["确定", 100],
          ["同意", 95],
          ["允许", 95],
          ["交换微信", 90],
          ["发送", 45],
          ["知道了", 40],
          ["我知道了", 40],
        ]
      : [
          ["在线简历", 100],
          ["附件简历", 100],
          ["发送简历", 95],
          ["立即投递", 95],
          ["确定", 60],
          ["确认", 60],
          ["发送", 50],
          ["知道了", 40],
          ["我知道了", 40],
        ];
    const confirmationLabelScore = (text, type) => {
      const value = compact(text);
      let best = 0;
      for (const [label, weight] of confirmationLabelSpecs(type)) {
        const labelText = compact(label);
        if (value === labelText) best = Math.max(best, weight);
        else if (value.includes(labelText)) best = Math.max(best, Math.max(1, weight - 40));
      }
      return best;
    };
    const findConfirmationCandidate = (type) => {
      const hasVisibleModal = modalVisible();
      if (!hasVisibleModal) {
        return { selected: null, candidates: [], modalVisible: false };
      }
      const candidates = allElements("button,a,[role='button'],.ant-im-btn,.ant-btn,.btn,.button")
        .filter((el) => isVisible(el) && !isDisabled(clickableFor(el)))
        .map((el, index) => {
          const target = clickableFor(el);
          const text = textFor(el) || textFor(target);
          const cls = [classFor(el), classFor(target)].join(" ");
          const inChatInput = Boolean(target.closest?.(".im-ui-chat-input,.chat-input,.input-area,.chat-editor"));
          const explicitButton = /^(BUTTON|A)$/.test(String(target.tagName || "").toUpperCase()) ||
            target.getAttribute?.("role") === "button" ||
            /btn|button/i.test(cls);
          let score = confirmationLabelScore(text, type);
          if (score > 0 && /modal|dialog|popover|confirm|ant-modal|ant-im-modal|confirm/i.test(cls)) score += 20;
          if (!target.closest?.(modalSelector)) score -= 30;
          if (!explicitButton) score -= 100;
          if (/im-ui-basic-send-btn/.test(cls) || inChatInput) score -= 80;
          return { el, target, text, cls, score: score - index / 10000 };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
      return {
        selected: candidates[0] || null,
        candidates,
        modalVisible: modalVisible(),
      };
    };
    const clickConfirmation = async (type, round) => {
      await wait(Math.min(payload.stepDelayMs, 600));
      const found = findConfirmationCandidate(type);
      addTrace("exchange.confirmation.search", {
        type,
        round,
        modalVisible: found.modalVisible,
        candidateCount: found.candidates.length,
        candidates: found.candidates.slice(0, 5).map(confirmationSummary),
      });
      const selected = found.selected;
      if (!selected) {
        return {
          clicked: false,
          type,
          round,
          reason: "confirmation-not-found",
          modalVisible: found.modalVisible,
        };
      }
      selected.target.click();
      await wait(payload.stepDelayMs);
      const clicked = {
        clicked: true,
        type,
        round,
        text: selected.text,
        targetClass: selected.cls.slice(0, 200),
      };
      addTrace("exchange.confirmation.clicked", {
        type,
        round,
        text: clipped(selected.text, 80),
        targetClass: clipped(selected.cls, 140),
      });
      return clicked;
    };
    const drainConfirmations = async (type) => {
      const confirmations = [];
      let terminal = null;
      for (let round = 1; round <= 4; round += 1) {
        const confirmation = await clickConfirmation(type, round);
        if (!confirmation.clicked) {
          terminal = confirmation;
          return {
            confirmations,
            terminal,
            completed: !confirmation.modalVisible,
            exhausted: false,
          };
        }
        confirmations.push(confirmation);
        if (actionAlreadySatisfied(type)) {
          return {
            confirmations,
            terminal: {
              clicked: false,
              type,
              round: round + 1,
              reason: "post-confirmation-signal",
              modalVisible: modalVisible(),
            },
            completed: true,
            exhausted: false,
          };
        }
      }
      const remaining = findConfirmationCandidate(type);
      terminal = {
        clicked: false,
        type,
        round: 5,
        reason: remaining.selected ? "confirmation-loop-limit" : "confirmation-not-found",
        modalVisible: remaining.modalVisible,
      };
      return {
        confirmations,
        terminal,
        completed: !remaining.selected,
        exhausted: Boolean(remaining.selected),
      };
    };
    const clickExchangeAction = async (type) => {
      if (actionAlreadySatisfied(type)) {
        addTrace("exchange.already_satisfied", { type });
        return { type, clicked: false, alreadySatisfied: true, satisfied: true, status: "already-satisfied" };
      }
      const root = activeRoot();
      const hints = type === "resume"
        ? ["发简历", "发送简历", "投递简历", "简历", "action-resume", "resume"]
        : ["交换微信", "交换微信号", "微信号", "微信", "action-wechat", "wechat"];
      const elements = Array.from(root.querySelectorAll?.("button,a,[role='button'],span,div") || []);
      const candidates = elements
        .filter((el) => isVisible(el))
        .map((el, index) => {
          const rawTarget = clickableFor(el);
          const shell = el.closest?.(".toolbar-btn,.btn-weixin,.btn-resume,.action-resume,.action-wechat") ||
            rawTarget.closest?.(".toolbar-btn,.btn-weixin,.btn-resume,.action-resume,.action-wechat") ||
            rawTarget;
          const target = shell || rawTarget;
          const text = textFor(el);
          const targetText = textFor(target) || text;
          const classes = [classFor(el), classFor(rawTarget), classFor(target)].join(" ");
          const bundle = [text, targetText, classes, attr(el, "aria-label"), attr(rawTarget, "aria-label"), attr(target, "aria-label")].join(" ");
          let score = 0;
          const targetCompact = compact(targetText || text);
          const isCompactAction = targetCompact.length > 0 && targetCompact.length <= 18;
          if (type === "resume" && /^(?:\u53d1\u7b80\u5386|\u53d1\u9001\u9644\u4ef6\u7b80\u5386|\u53d1\u9001\u7b80\u5386|\u6295\u9012\u7b80\u5386|\u9644\u4ef6\u7b80\u5386)$/u.test(targetCompact)) score += 140;
          if (type === "wechat" && /^(?:\u6362\u5fae\u4fe1|\u4ea4\u6362\u5fae\u4fe1|\u7d22\u8981\u5fae\u4fe1|\u5fae\u4fe1)$/u.test(targetCompact)) score += 140;
          if (isCompactAction && includesAny(targetText, hints)) score += 50;
          if (/toolbar-btn|btn-weixin|btn-resume|action-resume|action-wechat/i.test(classes)) score += 90;
          if (includesAny(bundle, hints)) score += 25;
          if (type === "resume" && /action-resume|resume/i.test(classes)) score += 80;
          if (type === "wechat" && /action-wechat|wechat/i.test(classes)) score += 80;
          if (/^(BUTTON|A)$/.test(String(target.tagName || "").toUpperCase()) || /button|action-item|im-ui-action-button/i.test(classes)) score += 15;
          if (/message-content|chat-record|chat-message|chat-im|chat-editor|message-controls|chat-controls/i.test(classes) && targetCompact.length > 18) score -= 100;
          if (targetCompact.length > 80) score -= 80;
          if (/发送/.test(targetText) && !/简历|微信/.test(targetText)) score -= 80;
          const unavailable = payload.site === "boss" && /unable|disabled|is-disabled|\\u53cc\\u65b9\\u56de\\u590d\\u540e\\u53ef\\u7528|\\u6c42\\u7b80\\u5386|\\u4ea4\\u6362\\u5fae\\u4fe1/u.test(bundle);
          if (unavailable) score -= 500;
          return { el, target, text, targetText, classes, bundle, unavailable, score: score - index / 10000 };
        })
        .filter((item) => item.score > 0 && !item.unavailable && isVisible(item.target) && !isDisabled(item.target))
        .sort((a, b) => b.score - a.score);
      const unavailableCandidates = elements
        .filter((el) => isVisible(el))
        .map((el, index) => {
          const rawTarget = clickableFor(el);
          const shell = el.closest?.(".toolbar-btn,.btn-weixin,.btn-resume,.action-resume,.action-wechat") ||
            rawTarget.closest?.(".toolbar-btn,.btn-weixin,.btn-resume,.action-resume,.action-wechat") ||
            rawTarget;
          const target = shell || rawTarget;
          const text = textFor(el);
          const targetText = textFor(target) || text;
          const classes = [classFor(el), classFor(rawTarget), classFor(target)].join(" ");
          const bundle = [text, targetText, classes].join(" ");
          const targetCompact = compact(targetText || text);
          const matchesType = type === "resume"
            ? /\\u7b80\\u5386|resume/i.test(bundle)
            : /\\u5fae\\u4fe1|wechat/i.test(bundle);
          const unavailable = payload.site === "boss" && /unable|disabled|is-disabled|\\u53cc\\u65b9\\u56de\\u590d\\u540e\\u53ef\\u7528|\\u6c42\\u7b80\\u5386|\\u4ea4\\u6362\\u5fae\\u4fe1/u.test(bundle);
          return { target, text, targetText, classes, targetCompact, matchesType, unavailable, score: 100 - index / 10000 };
        })
        .filter((item) => item.matchesType && item.unavailable)
        .sort((a, b) => b.score - a.score);
      addTrace("exchange.action.search", {
        type,
        candidateCount: candidates.length,
        unavailableCandidateCount: unavailableCandidates.length,
        candidates: candidates.slice(0, 5).map((item) => ({
          text: clipped(item.text || item.targetText, 80),
          targetText: clipped(item.targetText, 80),
          targetClass: clipped(item.classes, 140),
          score: Math.round(item.score * 1000) / 1000,
        })),
        unavailableCandidates: unavailableCandidates.slice(0, 3).map((item) => ({
          text: clipped(item.text || item.targetText, 80),
          targetText: clipped(item.targetText, 80),
          targetClass: clipped(item.classes, 140),
        })),
      });
      const selected = candidates[0];
      if (payload.site === "boss" && unavailableCandidates.length) {
        addTrace("exchange.action.unavailable", {
          type,
          reason: "platform-requires-mutual-reply",
          sample: clipped(unavailableCandidates[0].targetText || unavailableCandidates[0].text, 120),
          targetClass: clipped(unavailableCandidates[0].classes, 140),
        });
        return {
          type,
          clicked: false,
          alreadySatisfied: false,
          satisfied: true,
          unavailable: true,
          status: "platform-unavailable",
          reason: "platform-requires-mutual-reply",
          text: unavailableCandidates[0].text || unavailableCandidates[0].targetText,
          targetText: unavailableCandidates[0].targetText,
          targetClass: unavailableCandidates[0].classes.slice(0, 200),
        };
      }
      if (!selected) {
        addTrace("exchange.action.not_found", { type, hints });
        return { type, clicked: false, alreadySatisfied: false, satisfied: false, status: "action-not-found", hints };
      }
      selected.target.scrollIntoView?.({ block: "center", inline: "center" });
      selected.target.click();
      addTrace("exchange.action.clicked", {
        type,
        text: clipped(selected.text || selected.targetText, 80),
        targetText: clipped(selected.targetText, 80),
        targetClass: clipped(selected.classes, 140),
      });
      await wait(payload.stepDelayMs);
      const resumeSelection = type === "resume" ? await ensureResumeSelection() : null;
      const confirmationFlow = await drainConfirmations(type);
      const satisfiedBySignal = actionAlreadySatisfied(type);
      const satisfied = Boolean(satisfiedBySignal || confirmationFlow.completed);
      addTrace("exchange.action.completed", {
        type,
        satisfied,
        satisfiedBySignal,
        confirmationCount: confirmationFlow.confirmations.length,
        terminalReason: confirmationFlow.terminal?.reason || null,
        modalVisible: Boolean(confirmationFlow.terminal?.modalVisible),
      });
      return {
        type,
        clicked: true,
        alreadySatisfied: false,
        satisfied,
        status: satisfied ? "clicked" : "confirmation-incomplete",
        text: selected.text || selected.targetText,
        targetText: selected.targetText,
        targetClass: selected.classes.slice(0, 200),
        resumeSelection,
        confirmation: confirmationFlow.confirmations[0] || confirmationFlow.terminal,
        confirmations: confirmationFlow.confirmations,
        confirmationFlow,
        satisfiedBySignal,
      };
    };
    const setInputText = (input, message) => {
      input.focus?.();
      if (/TEXTAREA|INPUT/i.test(input.tagName || "")) {
        const proto = /TEXTAREA/i.test(input.tagName || "") ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
        const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        if (descriptor?.set) descriptor.set.call(input, message);
        else input.value = message;
      } else {
        input.textContent = message;
        input.innerText = message;
      }
      const eventInit = { bubbles: true, cancelable: true, inputType: "insertText", data: message };
      try {
        input.dispatchEvent(new InputEvent("input", eventInit));
      } catch {
        input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      }
      input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    };
    const findSendButton = (root) => {
      const candidates = Array.from(root.querySelectorAll?.("button,a,[role='button'],span,div") || [])
        .filter((el) => isVisible(el))
        .map((el, index) => {
          const target = clickableFor(el);
          const text = textFor(el) || textFor(target);
          const classes = [classFor(el), classFor(target)].join(" ");
          let score = 0;
          if (compact(text) === compact("发送")) score += 70;
          else if (compact(text).includes(compact("发送"))) score += 25;
          if (/send|im-ui-basic-send-btn|btn-send/i.test(classes)) score += 40;
          if (/resume|wechat|phone|action-resume|action-wechat|action-phone/i.test(classes)) score -= 80;
          return { target, text, classes, score: score - index / 10000 };
        })
        .filter((item) => item.score > 0 && isVisible(item.target) && !isDisabled(item.target))
        .sort((a, b) => b.score - a.score);
      return candidates[0] || null;
    };
    const sendMessage = async (message, index) => {
      const root = activeRoot();
      if (messagePresent(message, root)) {
        addTrace("message.already_present", { index, snippet: clipped(message, 80) });
        return { index, sent: false, verified: true, alreadyPresent: true, status: "already-present", snippet: String(message).slice(0, 80) };
      }
      const input = findInputIn(root);
      if (!input) {
        addTrace("message.input_not_found", { index, snippet: clipped(message, 80) });
        return { index, sent: false, verified: false, status: "input-not-found", snippet: String(message).slice(0, 80) };
      }
      setInputText(input, message);
      addTrace("message.input_set", { index, snippet: clipped(message, 80), length: String(message || "").length });
      await wait(Math.min(payload.stepDelayMs, 500));
      const sendButton = findSendButton(root);
      if (sendButton) {
        sendButton.target.click();
        addTrace("message.send_button.clicked", {
          index,
          text: clipped(sendButton.text, 80),
          targetClass: clipped(sendButton.classes, 140),
        });
      } else {
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        addTrace("message.enter_dispatched", { index });
      }
      await wait(payload.verifyDelayMs);
      const verified = messagePresent(message, root);
      addTrace("message.verified", { index, verified, snippet: clipped(message, 80) });
      return {
        index,
        sent: true,
        verified,
        status: verified ? "sent" : "sent-not-visible",
        snippet: String(message).slice(0, 80),
        sendButton: sendButton ? { text: sendButton.text, targetClass: sendButton.classes.slice(0, 200) } : null,
      };
    };

    return (async () => {
      const supported = ["boss", "liepin"].includes(String(payload.site || "").toLowerCase());
      const root = activeRoot();
      const hasInput = Boolean(findInputIn(root));
      if (conversationRejected(root)) {
        addTrace("conversation.rejected", { sample: clipped(rootText(root), 240) });
        return JSON.stringify({
          marker: "__JOB_BOARD_CONTACT_FOLLOWUP__",
          supported,
          attempted: true,
          verified: true,
          skipped: true,
          skipReason: "conversation-rejected",
          status: "followup-skipped-rejected",
          hasInput,
          requireExchangeActions: payload.requireExchangeActions,
          actions: [],
          sentMessages: [],
          sentMessageCount: 0,
          visibleMessageCount: 0,
          clickedExchangeCount: 0,
          alreadySatisfiedExchangeCount: 0,
          unavailableExchangeCount: 0,
          failedActions: [],
          failedMessages: [],
          trace,
          url: location.href,
          title: document.title || "",
          textSample: bodyText().slice(-800),
        });
      }
      const actions = [];
      if (payload.exchangeResume) actions.push(await clickExchangeAction("resume"));
      if (payload.exchangeWechat) actions.push(await clickExchangeAction("wechat"));
      const sentMessages = [];
      for (const [index, message] of payload.messages.entries()) {
        sentMessages.push(await sendMessage(message, index));
      }
      const required = actions.filter((action) => payload.requireExchangeActions && ["resume", "wechat"].includes(action.type));
      const requiredOk = required.every((action) => action.satisfied || action.alreadySatisfied);
      const messagesOk = sentMessages.every((item) => item.verified);
      const verified = Boolean(supported && hasInput && (!payload.requireExchangeActions || requiredOk) && messagesOk);
      const failedActions = actions.filter((action) => !(action.satisfied || action.alreadySatisfied));
      const failedMessages = sentMessages.filter((item) => !item.verified);
      const status = verified
        ? "followup-sent"
        : !hasInput
          ? "chat-input-not-found"
          : failedActions.length
            ? "exchange-action-not-satisfied"
            : failedMessages.length
              ? "message-not-verified"
              : "followup-not-verified";
      return JSON.stringify({
        marker: "__JOB_BOARD_CONTACT_FOLLOWUP__",
        supported,
        attempted: true,
        verified,
        status,
        hasInput,
        requireExchangeActions: payload.requireExchangeActions,
        actions,
        sentMessages,
        sentMessageCount: sentMessages.filter((item) => item.sent).length,
        visibleMessageCount: sentMessages.filter((item) => item.verified).length,
        clickedExchangeCount: actions.filter((item) => item.clicked).length,
        alreadySatisfiedExchangeCount: actions.filter((item) => item.alreadySatisfied).length,
        unavailableExchangeCount: actions.filter((item) => item.unavailable).length,
        failedActions,
        failedMessages,
        trace,
        url: location.href,
        title: document.title || "",
        textSample: bodyText().slice(-800),
      });
    })();
  })()`;
}
