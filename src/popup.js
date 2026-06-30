(function () {
  "use strict";

  const countKey = "inboxSignalFeedbackCount";

  function render(count) {
    const label = document.getElementById("signalCount");
    if (label) {
      label.textContent = "Tuned with " + Number(count || 0) + " signals from your inbox.";
    }
  }

  function loadCount() {
    if (!window.chrome || !chrome.storage || !chrome.storage.local) {
      render(0);
      return;
    }

    chrome.storage.local.get({ [countKey]: 0 }, function (state) {
      render(state[countKey]);
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes[countKey]) {
        render(changes[countKey].newValue);
      }
    });
  }

  loadCount();
})();
