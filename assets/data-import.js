(function () {
  // 유튜브 시청기록(watch-history.json)/카카오톡 대화 내보내기(.txt)를 웹 화면에서 바로
  // 선택하면, 서버가 그 자리에서 분석 스크립트를 실행하고 페이지를 새로고침한다 — 예전엔
  // 터미널에서 파일을 경로에 직접 넣고 스크립트를 수동으로 돌려야 했다.
  function wireImport(inputId, statusId, endpoint) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var status = document.getElementById(statusId);

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (status) status.textContent = "'" + file.name + "' 분석 중…";

      file.text()
        .then(function (content) {
          return fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: content }),
          });
        })
        .then(function (res) {
          return res.json().then(function (data) { return { res: res, data: data }; });
        })
        .then(function (result) {
          if (!result.res.ok || !result.data.ok) throw new Error(result.data.error || "HTTP " + result.res.status);
          window.location.reload();
        })
        .catch(function (err) {
          input.value = "";
          if (status) {
            status.textContent =
              "가져오기 실패 — scripts/preview.sh로 실행한 게 맞는지 확인하세요 (" + err.message + ")";
          }
        });
    });
  }

  wireImport("import-youtube-input", "import-youtube-status", "/api/import-youtube");
  wireImport("import-kakao-input", "import-kakao-status", "/api/import-kakao");
})();
