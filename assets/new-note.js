(function () {
  var saveBtn = document.getElementById("new-note-save");
  if (!saveBtn) return;
  var titleInput = document.getElementById("new-note-title");
  var contentInput = document.getElementById("new-note-content");
  var statusEl = document.getElementById("new-note-status");

  titleInput.focus();

  saveBtn.addEventListener("click", function () {
    var title = titleInput.value.trim();
    var content = contentInput.value;
    if (!title) { statusEl.textContent = "제목을 입력하세요."; return; }
    if (!content.trim()) { statusEl.textContent = "내용을 입력하세요."; return; }

    saveBtn.disabled = true;
    statusEl.textContent = "저장 중…";
    fetch("/api/create-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, content: content }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { res: res, data: data }; });
      })
      .then(function (result) {
        if (!result.res.ok || !result.data.ok) throw new Error(result.data.error || "HTTP " + result.res.status);
        window.location.href = "/" + result.data.url;
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        statusEl.textContent = "저장 실패 — scripts/preview.sh로 실행한 게 맞는지 확인하세요 (" + err.message + ")";
      });
  });
})();
