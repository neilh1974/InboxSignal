(function () {
  "use strict";

  const categoryMeta = {
    money: {
      label: "Money",
      action: "Check whether the amount, owner, and timing are correct."
    },
    deadline: {
      label: "Deadline",
      action: "Add the date to your calendar or confirm the timing."
    },
    obligation: {
      label: "Obligation",
      action: "Confirm who owns this and what counts as complete."
    },
    penalty: {
      label: "Penalty",
      action: "Review the cost or consequence before agreeing."
    },
    risky: {
      label: "Risky wording",
      action: "Read the surrounding sentence before accepting the term."
    },
    required: {
      label: "Required action",
      action: "Decide whether you need to reply, sign, send, or confirm."
    },
    request: {
      label: "Follow up request",
      action: "Decide whether this needs a reply or follow up."
    },
    missing: {
      label: "Missing detail",
      action: "Ask for the missing number, date, owner, or evidence."
    },
    contradiction: {
      label: "Contradiction",
      action: "Compare this against the earlier message or agreement."
    }
  };

  const ruleDefinitions = [
    {
      category: "money",
      reason: "This is a concrete amount that could affect payment, pricing, or exposure.",
      score: 7,
      pattern: /\b(?:USD|CAD|EUR|GBP)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:dollars|usd|cad|eur|gbp)\b/gi
    },
    {
      category: "money",
      reason: "This looks like a payment request or billing item.",
      score: 7,
      pattern: /\b(?:invoice|payment due|past due|wire|ach|reimbursement|receipt|expense report|billing|renewal fee)\b/gi
    },
    {
      category: "deadline",
      reason: "This phrase sets a time limit or date for action.",
      score: 5,
      pattern: /\b(?:by|before|due by|due on|no later than|deadline is|expires on|must be received by|must be completed by|reply by|sign by|pay by)\s+(?:today|tomorrow|eod|end of day|close of business|monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?)/gi
    },
    {
      category: "deadline",
      reason: "This relative deadline could require near term action.",
      score: 7,
      pattern: /\b(?:within|in the next)\s+\d{1,2}\s+(?:business\s+)?(?:day|days|week|weeks|hour|hours)\b/gi
    },
    {
      category: "obligation",
      reason: "This creates or assigns a specific responsibility.",
      score: 6,
      pattern: /\b(?:must|is required to|are required to|required to|shall|responsible for|obligated to|agrees to|commits to)\s+(?:pay|sign|send|provide|submit|complete|return|deliver|approve|confirm|notify|maintain|renew|cancel)\b/gi
    },
    {
      category: "penalty",
      reason: "This names a cost, loss, or adverse consequence.",
      score: 8,
      pattern: /\b(?:late fee|penalty|forfeit|forfeited|non refundable|nonrefundable|default interest|interest charge|liquidated damages|termination fee|cancellation fee|loss of access|service suspension)\b/gi
    },
    {
      category: "risky",
      reason: "This phrase can affect rights, exit, liability, or control.",
      score: 6,
      pattern: /\b(?:automatic renewal|auto renew|without notice|sole discretion|material breach|indemnify|indemnification|waive all|waiver of|exclusive remedy|limitation of liability|termination for cause|cancellation notice)\b/gi
    },
    {
      category: "required",
      reason: "This is a direct action request.",
      score: 7,
      pattern: /\b(?:signature required|action required|approval required|please confirm|please sign|please provide|please submit|complete and return|send us|provide us)\b/gi
    },
    {
      category: "request",
      reason: "This asks for a response or follow up.",
      score: 6,
      pattern: /\b(?:following up|follow up|checking in|can you|could you|please review|please reply|please respond|let me know|need your input|waiting on you|circling back)\b/gi
    },
    {
      category: "missing",
      reason: "A needed detail appears absent or unresolved.",
      score: 6,
      pattern: /\b(?:(?:owner|amount|date|deadline|approval|signature|security review|payment terms|implementation date)\s+(?:is\s+)?(?:missing|not provided|unknown|tbd|to be determined|pending confirmation)|(?:missing|not provided|pending confirmation):\s?(?:owner|amount|date|deadline|approval|signature|security review|payment terms))\b/gi
    },
    {
      category: "contradiction",
      reason: "This explicitly flags conflict with another statement.",
      score: 7,
      pattern: /\b(?:but previously|inconsistent with|conflicts with|contradicts|contrary to|different from what we agreed)\b/gi
    }
  ];

  const minimumScore = 5;
  const actionCategories = {
    deadline: true,
    obligation: true,
    penalty: true,
    required: true,
    request: true,
    missing: true,
    contradiction: true
  };
  const actionPriority = {
    required: 1,
    deadline: 2,
    request: 3,
    obligation: 4,
    missing: 5,
    penalty: 6,
    contradiction: 7
  };

  function getRules() {
    return ruleDefinitions.map(function (rule) {
      return Object.assign({}, rule, {
        label: categoryMeta[rule.category].label,
        action: categoryMeta[rule.category].action
      });
    });
  }

  function findSignals(text) {
    const matches = [];

    getRules().forEach(function (rule) {
      let match;
      rule.pattern.lastIndex = 0;

      while ((match = rule.pattern.exec(text)) !== null) {
        const value = match[0].trim();
        if (value.length < 2) {
          continue;
        }

        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          category: rule.category,
          label: rule.label,
          reason: rule.reason,
          action: rule.action,
          score: rule.score
        });
      }
    });

    return dedupeMatches(matches).filter(function (match) {
      return match.score >= minimumScore;
    });
  }

  function summarizeSignals(text, signals) {
    const rankedSignals = (signals || []).slice().sort(function (a, b) {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.start - b.start;
    });

    if (rankedSignals.length === 0) {
      return null;
    }

    const money = findMoneySignal(rankedSignals);
    const deadline = findByCategory(rankedSignals, "deadline");
    const penalty = findByCategory(rankedSignals, "penalty");
    const required = findByCategory(rankedSignals, "required");
    const request = findByCategory(rankedSignals, "request");
    const missing = findByCategory(rankedSignals, "missing");
    const top = rankedSignals[0];
    const summary = makeSummaryLine(text, {
      money: money,
      deadline: deadline,
      penalty: penalty,
      required: required,
      request: request,
      missing: missing,
      top: top
    });
    const actions = makeActionItems(rankedSignals);

    return {
      summary: summary,
      actions: actions
    };
  }

  function makeSummaryLine(text, groups) {
    if (groups.money && groups.deadline) {
      return "Money due: " + cleanSnippet(groups.money.text) + " by " + cleanDeadline(groups.deadline.text);
    }
    if (groups.required) {
      return "Action needed: " + cleanSnippet(groups.required.text);
    }
    if (groups.penalty) {
      return "Risk: " + cleanSnippet(groups.penalty.text);
    }
    if (groups.request) {
      return "Reply needed: " + cleanSnippet(groups.request.text);
    }
    if (groups.deadline) {
      return "Deadline: " + cleanSnippet(groups.deadline.text);
    }
    if (groups.missing) {
      return "Missing detail: " + cleanSnippet(groups.missing.text);
    }
    return categoryMeta[groups.top.category].label + ": " + cleanSnippet(groups.top.text || text);
  }

  function makeActionItems(signals) {
    const actions = [];
    signals.slice().sort(function (a, b) {
      const aPriority = actionPriority[a.category] || 99;
      const bPriority = actionPriority[b.category] || 99;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return b.score - a.score;
    }).forEach(function (signal) {
      if (!actionCategories[signal.category]) {
        return;
      }
      const item = actionText(signal);
      if (item && !actions.includes(item)) {
        actions.push(item);
      }
    });
    return actions.slice(0, 2);
  }

  function actionText(signal) {
    const value = cleanSnippet(signal.text);
    if (signal.category === "deadline") {
      return "Calendar or confirm " + cleanDeadline(signal.text);
    }
    if (signal.category === "required") {
      return "Do: " + value;
    }
    if (signal.category === "request") {
      return "Reply: " + value;
    }
    if (signal.category === "penalty") {
      return "Review risk: " + value;
    }
    if (signal.category === "missing") {
      return "Ask for " + value;
    }
    if (signal.category === "obligation") {
      return "Confirm owner for " + value;
    }
    if (signal.category === "contradiction") {
      return "Compare against prior thread";
    }
    return "";
  }

  function findByCategory(signals, category) {
    return signals.find(function (signal) {
      return signal.category === category;
    });
  }

  function findMoneySignal(signals) {
    return signals.find(function (signal) {
      return signal.category === "money" && /\d/.test(signal.text);
    }) || findByCategory(signals, "money");
  }

  function cleanSnippet(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.?!,;:]+$/g, "")
      .slice(0, 54);
  }

  function cleanDeadline(value) {
    return cleanSnippet(value)
      .replace(/^(?:by|before|due by|due on|no later than|deadline is|reply by|sign by|pay by)\s+/i, "");
  }

  function dedupeMatches(matches) {
    return matches
      .sort(function (a, b) {
        if (a.start !== b.start) {
          return a.start - b.start;
        }
        return b.end - b.start - (a.end - a.start);
      })
      .reduce(function (accepted, candidate) {
        const overlaps = accepted.some(function (current) {
          return candidate.start < current.end && candidate.end > current.start;
        });

        if (!overlaps) {
          accepted.push(candidate);
        }

        return accepted;
      }, [])
      .slice(0, 80);
  }

  window.inboxSignalRules = {
    findSignals: findSignals,
    summarizeSignals: summarizeSignals
  };
})();
