(function () {
  // 이벤트 위임: .note-delete-btn은 노트 목록(vault.html/tag.html/daily 아카이브)과
  // 노트 상세 페이지(note.html) 양쪽에 다 나올 수 있어서, 페이지별로 따로 바인딩하지 않고
  // document 레벨에서 한 번만 처리한다.
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".note-delete-btn");
    if (!btn || btn.disabled) return;
    e.preventDefault();

    var path = btn.dataset.path;
    if (!path) return;
    var title = btn.dataset.title || path;
    if (!window.confirm("'" + title + "' 노트를 삭제할까요?\n되돌릴 수 없습니다.")) return;

    btn.disabled = true;
    fetch("/api/delete-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { res: res, data: data }; });
      })
      .then(function (result) {
        if (!result.res.ok || !result.data.ok) throw new Error(result.data.error || "HTTP " + result.res.status);
        var redirect = btn.dataset.redirect;
        if (redirect) window.location.href = redirect;
        else window.location.reload();
      })
      .catch(function (err) {
        btn.disabled = false;
        window.alert(
          "삭제 실패 — scripts/preview.sh로 실행한 게 맞는지 확인하세요.\n(" + err.message + ")"
        );
      });
  });
})();
