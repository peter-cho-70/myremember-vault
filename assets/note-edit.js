(function () {
  var toggleBtn = document.getElementById("note-edit-toggle");
  if (!toggleBtn) return;

  var viewEl = document.getElementById("note-view");
  var editorEl = document.getElementById("note-editor");
  var textarea = document.getElementById("note-editor-textarea");
  var saveBtn = document.getElementById("note-edit-save");
  var cancelBtn = document.getElementById("note-edit-cancel");
  var statusEl = document.getElementById("note-edit-status");
  var path = toggleBtn.dataset.path;

  function showEditor() {
    viewEl.style.display = "none";
    editorEl.style.display = "";
    textarea.focus();
  }

  function showView() {
    editorEl.style.display = "none";
    viewEl.style.display = "";
  }

  toggleBtn.addEventListener("click", showEditor);
  cancelBtn.addEventListener("click", showView);

  saveBtn.addEventListener("click", function () {
    saveBtn.disabled = true;
    if (statusEl) statusEl.textContent = "저장 중…";
    fetch("/api/save-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path, content: textarea.value }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { res: res, data: data }; });
      })
      .then(function (result) {
        if (!result.res.ok || !result.data.ok) throw new Error(result.data.error || "HTTP " + result.res.status);
        window.location.reload();
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        if (statusEl) {
          statusEl.textContent =
            "저장 실패 — scripts/preview.sh로 실행한 게 맞는지 확인하세요 (" + err.message + ")";
        }
      });
  });
})();
