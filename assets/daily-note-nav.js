(function () {
  // 사이드바 "오늘 노트" 버튼 — scripts/webviewer/server.py로 띄웠을 때만 동작한다.
  // base.html에 있어서 모든 페이지에서 보이므로, 어느 페이지 깊이에서 클릭해도 항상 올바른
  // 절대경로로 이동하도록 반환된 url 앞에 "/"를 붙인다(상대경로면 현재 페이지 위치에 따라
  // 깨짐 — 예: /tags/manage.html에서 "daily/2026-08-12.html"은 /tags/daily/... 로 잘못 감).
  var btn = document.getElementById("daily-note-nav-btn");
  if (!btn) return;

  btn.addEventListener("click", function () {
    btn.disabled = true;
    fetch("/api/create-daily-note", { method: "POST" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.error || "알 수 없는 오류");
        window.location.href = "/" + data.url;
      })
      .catch(function (err) {
        btn.disabled = false;
        window.alert("오늘 노트 열기 실패 — scripts/preview.sh로 실행한 게 맞는지 확인하세요 (" + err.message + ")");
      });
  });
})();
