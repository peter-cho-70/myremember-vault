(function () {
  // 클라우드 배포용 비밀번호 게이트. **진짜 보안이 아니다** — 이 페이지는 정적 파일이라
  // 서버측 인증이 없고, view-source나 JS를 꺼서 우회할 수 있다. 검색엔진 노출·우연한
  // 방문 정도만 막는 캐주얼한 장벽으로만 쓸 것. 평문 비밀번호는 어디에도 저장하지 않고
  // SHA-256 해시만 비교한다(scripts/build-cloud-site.py가 빌드 시점에 해시를 만들어
  // assets/gate-hash.js에 넣는다).
  var hash = window.MYREMEMBER_GATE_HASH;
  var root = document.documentElement;

  if (!hash) {
    root.classList.remove("gate-locked");
    return;
  }

  var STORAGE_KEY = "myremember-cloud-unlocked";
  if (sessionStorage.getItem(STORAGE_KEY) === hash) {
    root.classList.remove("gate-locked");
    return;
  }

  function sha256Hex(text) {
    var enc = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", enc).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  function showGate() {
    var overlay = document.createElement("div");
    overlay.id = "gate-overlay";

    var form = document.createElement("form");
    form.id = "gate-form";

    var title = document.createElement("p");
    title.className = "gate-title";
    title.textContent = "비밀번호가 필요합니다";

    var input = document.createElement("input");
    input.id = "gate-input";
    input.type = "password";
    input.autocomplete = "off";
    input.placeholder = "비밀번호";

    var submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn";
    submitBtn.textContent = "확인";

    var errorEl = document.createElement("p");
    errorEl.className = "gate-error";
    errorEl.hidden = true;
    errorEl.textContent = "비밀번호가 올바르지 않습니다.";

    form.appendChild(title);
    form.appendChild(input);
    form.appendChild(submitBtn);
    form.appendChild(errorEl);
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    input.focus();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sha256Hex(input.value).then(function (entered) {
        if (entered === hash) {
          sessionStorage.setItem(STORAGE_KEY, hash);
          root.classList.remove("gate-locked");
          overlay.remove();
        } else {
          errorEl.hidden = false;
          input.value = "";
          input.focus();
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showGate);
  } else {
    showGate();
  }
})();
