(function () {
  "use strict";

  const uiRootId = "grhRoot";
  const highlightClass = "grhHighlight";
  const rowClass = "grhSignalRow";
  const badgeClass = "grhRowBadge";
  const summaryClass = "grhSummaryCell";
  const tooltipId = "grhTooltip";
  const scanButtonId = "grhScanButton";
  const clearButtonId = "grhClearButton";
  const resultId = "grhResult";
  const privacyText = "100% local. No data leaves your browser.";
  const countKey = "inboxSignalFeedbackCount";
  const signalKey = "inboxSignalStats";
  const maxRows = 12;
  const maxSignalsPerRow = 2;
  const scanDelayMs = 500;

  const categoryColors = {
    money: [24, 128, 56],
    deadline: [245, 152, 0],
    obligation: [26, 115, 232],
    penalty: [217, 48, 37],
    risky: [128, 81, 181],
    required: [26, 115, 232],
    missing: [95, 99, 104],
    contradiction: [95, 99, 104],
    request: [26, 115, 232]
  };

  let observer = null;
  let scanTimer = null;
  let lastScanSignature = "";
  let signalStats = {};
  let fallbackCount = 0;

  function init() {
    ensureUi();
    loadSignalStats().then(function () {
      observePage();
      scheduleScan();
    });
  }

  function ensureUi() {
    if (document.getElementById(uiRootId)) {
      updateFeedbackCountLabel();
      return;
    }

    const root = document.createElement("div");
    root.id = uiRootId;
    root.setAttribute("aria-label", "InboxSignal controls");

    const title = document.createElement("div");
    title.className = "grhTitle";
    title.textContent = "InboxSignal";

    const privacy = document.createElement("div");
    privacy.className = "grhPrivacy";
    privacy.textContent = privacyText;

    const count = document.createElement("div");
    count.id = "grhSignalCount";
    count.className = "grhSignalCount";
    count.setAttribute("aria-live", "polite");

    const actions = document.createElement("div");
    actions.className = "grhActions";

    const scanButton = document.createElement("button");
    scanButton.id = scanButtonId;
    scanButton.type = "button";
    scanButton.textContent = "Scan inbox";
    scanButton.addEventListener("click", function () {
      scanInbox({ force: true, manual: true });
    });

    const clearButton = document.createElement("button");
    clearButton.id = clearButtonId;
    clearButton.type = "button";
    clearButton.textContent = "Clear signals";
    clearButton.addEventListener("click", function () {
      clearSignals();
      setResult("Cleared");
    });

    const result = document.createElement("div");
    result.id = resultId;
    result.setAttribute("aria-live", "polite");
    result.textContent = "Watching inbox list";

    actions.append(scanButton, clearButton);
    root.append(title, privacy, count, actions, result);
    document.documentElement.appendChild(root);
    updateFeedbackCountLabel();
  }

  function observePage() {
    if (observer) {
      return;
    }

    observer = new MutationObserver(function () {
      ensureUi();
      scheduleScan();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(function () {
      scanInbox({ force: false, manual: false });
    }, scanDelayMs);
  }

  function scanInbox(options) {
    const settings = options || {};
    const rows = findInboxRows();
    if (rows.length === 0) {
      if (settings.manual) {
        setResult("No visible inbox rows found");
      }
      return;
    }

    const signature = rows.map(getRowText).join("\n").slice(0, 5000);
    if (!settings.force && signature === lastScanSignature) {
      return;
    }
    lastScanSignature = signature;

    clearSignals({ quiet: true });

    let markedRows = 0;
    rows.slice(0, maxRows).forEach(function (row) {
      const rowText = getRowText(row);
      const rankedSignals = rankSignals(window.inboxSignalRules.findSignals(rowText));
      const rowSignals = rankedSignals.slice(0, maxSignalsPerRow);

      if (rowSignals.length === 0) {
        return;
      }

      const marked = markRow(row, rowSignals, rowText, rankedSignals);
      if (marked) {
        markedRows += 1;
      }
    });

    const label = markedRows === 1 ? "1 inbox signal" : markedRows + " inbox signals";
    setResult(label);
  }

  function findInboxRows() {
    const candidates = [];
    document.querySelectorAll("tr.zA, div[role='main'] tr[role='row'], div[role='main'] [role='listitem']").forEach(function (row) {
      if (!isVisible(row) || row.closest("#" + uiRootId)) {
        return;
      }

      const text = getRowText(row);
      if (text.length < 8) {
        return;
      }

      if (row.querySelector(".bog, .y2, [data-thread-id], [email]") || row.getAttribute("role") === "listitem") {
        candidates.push(row);
      }
    });

    return candidates;
  }

  function getRowText(row) {
    const subjectNode = row.querySelector(".bog") || row.querySelector("[data-thread-id]") || row;
    const snippetNode = row.querySelector(".y2") || row;
    const parts = [];
    addCleanText(parts, subjectNode);
    if (snippetNode !== subjectNode) {
      addCleanText(parts, snippetNode);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function addCleanText(parts, root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (textNode) {
          const parent = textNode.parentElement;
          if (!parent || shouldSkipElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return textNode.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    while (walker.nextNode()) {
      parts.push(walker.currentNode.nodeValue.trim());
    }
  }

  function rankSignals(signals) {
    return signals
      .map(function (signal) {
        const stats = signalStats[signal.category] || {};
        const useful = Number(stats.useful || 0);
        const notUseful = Number(stats.notUseful || 0);
        const learnedBoost = Math.max(-2, Math.min(2, (useful - notUseful) * 0.3));
        return Object.assign({}, signal, {
          score: signal.score + learnedBoost
        });
      })
      .sort(function (a, b) {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return a.start - b.start;
      });
  }

  function markRow(row, signals, rowText, summarySignals) {
    let count = 0;
    const category = signals[0].category;
    const palette = makePalette(row, category);

    signals.forEach(function (signal) {
      if (highlightSignalInRow(row, signal, palette)) {
        count += 1;
      }
    });

    if (count === 0) {
      return false;
    }

    row.classList.add(rowClass);
    row.style.setProperty("--grh-row-outline", palette.border);
    row.style.setProperty("--grh-row-fill", palette.rowFill);
    addRowBadge(row, signals[0], palette);
    addRowSummary(row, rowText, summarySignals);
    return true;
  }

  function highlightSignalInRow(row, signal, palette) {
    const targets = [
      row.querySelector(".bog"),
      row.querySelector(".y2"),
      row
    ].filter(Boolean);

    for (const target of targets) {
      const textNode = findTextNodeForSignal(target, signal.text);
      if (textNode) {
        wrapTextRange(textNode, signal.text, signal, palette);
        return true;
      }
    }

    return false;
  }

  function findTextNodeForSignal(root, text) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (textNode) {
          const parent = textNode.parentElement;
          if (!parent || shouldSkipElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          return textNode.nodeValue.toLowerCase().includes(text.toLowerCase())
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    return walker.nextNode() ? walker.currentNode : null;
  }

  function wrapTextRange(textNode, value, match, palette) {
    const text = textNode.nodeValue;
    const start = text.toLowerCase().indexOf(value.toLowerCase());
    if (start < 0) {
      return;
    }

    const end = start + value.length;
    const fragment = document.createDocumentFragment();

    if (start > 0) {
      fragment.appendChild(document.createTextNode(text.slice(0, start)));
    }

    fragment.appendChild(createHighlight(text.slice(start, end), match, palette));

    if (end < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(end)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function createHighlight(text, match, palette) {
    const span = document.createElement("span");
    span.className = highlightClass + " grhCategory" + capitalize(match.category);
    span.textContent = text;
    span.tabIndex = 0;
    span.dataset.category = match.label;
    span.dataset.categoryKey = match.category;
    span.dataset.reason = match.reason;
    span.dataset.action = match.action;
    span.style.setProperty("--grh-bg", palette.fill);
    span.style.setProperty("--grh-border", palette.border);
    span.style.setProperty("--grh-text", palette.text);

    span.addEventListener("mouseenter", function () {
      showTooltip(span);
    });
    span.addEventListener("focus", function () {
      showTooltip(span);
    });
    span.addEventListener("click", function () {
      showTooltip(span);
    });
    span.addEventListener("mouseleave", hideTooltip);
    span.addEventListener("blur", hideTooltip);

    return span;
  }

  function addRowBadge(row, signal, palette) {
    if (row.querySelector("." + badgeClass)) {
      return;
    }

    const badge = document.createElement("span");
    badge.className = badgeClass;
    badge.textContent = signal.label;
    badge.style.setProperty("--grh-bg", palette.fill);
    badge.style.setProperty("--grh-border", palette.border);
    badge.style.setProperty("--grh-text", palette.text);

    const subject = row.querySelector(".bog") || row.querySelector("[data-thread-id]") || row;
    subject.appendChild(document.createTextNode(" "));
    subject.appendChild(badge);
  }

  function addRowSummary(row, rowText, signals) {
    if (!window.inboxSignalRules.summarizeSignals || row.querySelector("." + summaryClass)) {
      return;
    }

    const summary = window.inboxSignalRules.summarizeSignals(rowText, signals);
    if (!summary || !summary.summary) {
      return;
    }

    const cell = document.createElement(row.tagName === "TR" ? "td" : "div");
    cell.className = summaryClass;
    cell.setAttribute("aria-label", "InboxSignal summary");

    const summaryLine = document.createElement("div");
    summaryLine.className = "grhSummaryLine";
    summaryLine.textContent = summary.summary;
    cell.appendChild(summaryLine);

    if (summary.actions && summary.actions.length > 0) {
      const actions = document.createElement("div");
      actions.className = "grhActionList";
      summary.actions.forEach(function (item) {
        const action = document.createElement("span");
        action.textContent = item;
        actions.appendChild(action);
      });
      cell.appendChild(actions);
    }

    if (row.tagName === "TR") {
      row.appendChild(cell);
      return;
    }

    row.appendChild(cell);
  }

  function makePalette(element, category) {
    const background = readBackground(element);
    const base = categoryColors[category] || categoryColors.risky;
    const dark = luminance(background) < 0.45;
    const fill = mix(background, base, dark ? 0.44 : 0.2);
    const rowFill = mix(background, base, dark ? 0.18 : 0.08);
    const border = mix(background, base, dark ? 0.72 : 0.55);
    const text = luminance(fill) < 0.42 ? [255, 255, 255] : [32, 33, 36];

    return {
      fill: rgb(fill),
      rowFill: rgb(rowFill),
      border: rgb(border),
      text: rgb(text)
    };
  }

  function readBackground(element) {
    let current = element;
    while (current && current !== document.documentElement) {
      const color = parseColor(window.getComputedStyle(current).backgroundColor);
      if (color && color[3] > 0.05) {
        return blendWithWhite(color);
      }
      current = current.parentElement;
    }
    return [255, 255, 255];
  }

  function parseColor(value) {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/);
    if (!match) {
      return null;
    }
    const parts = match[1].split(",").map(function (part) {
      return Number(part.trim());
    });
    if (parts.length < 3 || parts.some(function (part) { return Number.isNaN(part); })) {
      return null;
    }
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }

  function blendWithWhite(color) {
    const alpha = color[3];
    return [
      Math.round(color[0] * alpha + 255 * (1 - alpha)),
      Math.round(color[1] * alpha + 255 * (1 - alpha)),
      Math.round(color[2] * alpha + 255 * (1 - alpha))
    ];
  }

  function mix(a, b, amount) {
    return [
      Math.round(a[0] * (1 - amount) + b[0] * amount),
      Math.round(a[1] * (1 - amount) + b[1] * amount),
      Math.round(a[2] * (1 - amount) + b[2] * amount)
    ];
  }

  function luminance(color) {
    const values = color.map(function (value) {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  }

  function rgb(color) {
    return "rgb(" + color[0] + ", " + color[1] + ", " + color[2] + ")";
  }

  function clearSignals(options) {
    hideTooltip();
    document.querySelectorAll("." + highlightClass).forEach(function (span) {
      const parent = span.parentNode;
      if (!parent) {
        return;
      }

      parent.replaceChild(document.createTextNode(span.textContent || ""), span);
      parent.normalize();
    });

    document.querySelectorAll("." + badgeClass).forEach(function (badge) {
      const previous = badge.previousSibling;
      badge.remove();
      if (previous && previous.nodeType === Node.TEXT_NODE && previous.nodeValue === " ") {
        previous.remove();
      }
    });

    document.querySelectorAll("." + summaryClass).forEach(function (summary) {
      summary.remove();
    });

    document.querySelectorAll("." + rowClass).forEach(function (row) {
      row.classList.remove(rowClass);
      row.style.removeProperty("--grh-row-outline");
      row.style.removeProperty("--grh-row-fill");
    });

    if (!options || !options.quiet) {
      lastScanSignature = "";
    }
  }

  function showTooltip(target) {
    const tooltip = ensureTooltip();
    tooltip.replaceChildren();

    const category = document.createElement("div");
    category.className = "grhTooltipCategory";
    category.textContent = target.dataset.category || "Signal";

    const reason = document.createElement("div");
    reason.className = "grhTooltipText";
    reason.textContent = target.dataset.reason || "";

    const action = document.createElement("div");
    action.className = "grhTooltipAction";
    action.textContent = target.dataset.action || "";

    const feedback = document.createElement("div");
    feedback.className = "grhFeedback";

    const useful = makeFeedbackButton("Useful", target, true);
    const notUseful = makeFeedbackButton("Not useful", target, false);
    feedback.append(useful, notUseful);

    tooltip.append(category, reason, action, feedback);
    positionTooltip(tooltip, target);
    tooltip.classList.add("grhVisible");
  }

  function makeFeedbackButton(label, target, useful) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      recordFeedback(target.dataset.categoryKey || "signal", useful);
      setResult("Ranking updated");
      hideTooltip();
    });
    return button;
  }

  function ensureTooltip() {
    let tooltip = document.getElementById(tooltipId);
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = tooltipId;
      tooltip.setAttribute("role", "tooltip");
      document.documentElement.appendChild(tooltip);
    }

    return tooltip;
  }

  function positionTooltip(tooltip, target) {
    const rect = target.getBoundingClientRect();
    const width = 280;
    const margin = 12;
    const left = Math.min(
      Math.max(margin, rect.left + window.scrollX),
      window.scrollX + window.innerWidth - width - margin
    );
    const top = rect.bottom + window.scrollY + 8;

    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  function hideTooltip() {
    const tooltip = document.getElementById(tooltipId);
    if (tooltip) {
      tooltip.classList.remove("grhVisible");
    }
  }

  function recordFeedback(category, useful) {
    const current = Object.assign({}, signalStats[category] || {});
    current.useful = Number(current.useful || 0) + (useful ? 1 : 0);
    current.notUseful = Number(current.notUseful || 0) + (useful ? 0 : 1);
    signalStats[category] = current;

    getStorage({ [countKey]: fallbackCount, [signalKey]: {} }).then(function (state) {
      const count = Number(state[countKey] || 0) + 1;
      const storedStats = Object.assign({}, state[signalKey] || {});
      const storedCategory = Object.assign({}, storedStats[category] || {});
      storedCategory.useful = Number(storedCategory.useful || 0) + (useful ? 1 : 0);
      storedCategory.notUseful = Number(storedCategory.notUseful || 0) + (useful ? 0 : 1);
      storedStats[category] = storedCategory;
      fallbackCount = count;
      signalStats = storedStats;
      return setStorage({
        [countKey]: count,
        [signalKey]: storedStats
      });
    }).then(updateFeedbackCountLabel);
  }

  function loadSignalStats() {
    return getStorage({ [countKey]: 0, [signalKey]: {} }).then(function (state) {
      fallbackCount = Number(state[countKey] || 0);
      signalStats = state[signalKey] || {};
      updateFeedbackCountLabel();
    });
  }

  function updateFeedbackCountLabel() {
    const label = document.getElementById("grhSignalCount");
    if (label) {
      label.textContent = "Tuned with " + fallbackCount + " signals from your inbox.";
    }
  }

  function getStorage(defaults) {
    return new Promise(function (resolve) {
      if (!window.chrome || !chrome.storage || !chrome.storage.local) {
        resolve(defaults);
        return;
      }
      chrome.storage.local.get(defaults, resolve);
    });
  }

  function setStorage(values) {
    return new Promise(function (resolve) {
      if (!window.chrome || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      chrome.storage.local.set(values, resolve);
    });
  }

  function shouldSkipElement(element) {
    return Boolean(
      element.closest("#" + uiRootId) ||
      element.closest("#" + tooltipId) ||
      element.closest("." + highlightClass) ||
      element.closest("." + badgeClass) ||
      element.closest("." + summaryClass) ||
      element.closest("script, style, textarea, input, button, select, code, pre") ||
      element.isContentEditable
    );
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function setResult(message) {
    const result = document.getElementById(resultId);
    if (result) {
      result.textContent = message;
    }
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  window.inboxSignalStart = init;
  init();
})();
