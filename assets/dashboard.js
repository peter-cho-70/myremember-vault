(function () {
  var WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
  var pad2 = function (n) { return String(n).padStart(2, "0"); };
  var toDateStr = function (d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
  var fromDateStr = function (s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  var toKoreanLabel = function (s) { var d = fromDateStr(s); return s + " (" + WEEKDAY_KO[d.getDay()] + ")"; };
  var TODAY_STR = toDateStr(new Date());

  var dashDateDesc = document.getElementById("dash-date-desc");
  if (dashDateDesc) dashDateDesc.textContent = toKoreanLabel(TODAY_STR);

  // ── Gmail/캘린더/관심종목 탭 (오른쪽 고정폭 열) ──
  var sideTabs = document.querySelectorAll(".side-tab");
  if (sideTabs.length) {
    var sidePanels = document.querySelectorAll(".side-tab-panel");
    sideTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        sideTabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle("active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
        sidePanels.forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== name;
        });
      });
    });
  }

  // ── "노트 가져오기" — 기존 .md/.html/.pdf 파일을 골라서 topics/에 등록 ──
  var importInput = document.getElementById("import-note-input");
  if (importInput) {
    var importStatus = document.getElementById("import-note-status");
    var importDefaultText = importStatus ? importStatus.textContent : "";
    var keepOriginalBox = document.getElementById("import-keep-original");

    // PDF는 바이너리라 file.text()로는 못 읽는다 — base64로 감싸서 보내고, 서버가
    // pdftotext로 텍스트를 뽑아낸다. .md/.html/.txt는 기존처럼 텍스트 그대로 보낸다.
    var isPdf = function (file) {
      return /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    };
    var arrayBufferToBase64 = function (buf) {
      var bytes = new Uint8Array(buf);
      var binary = "";
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return window.btoa(binary);
    };

    importInput.addEventListener("change", function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      if (importStatus) importStatus.textContent = "'" + file.name + "' 가져오는 중…";

      var readContent = isPdf(file) ? file.arrayBuffer().then(arrayBufferToBase64) : file.text();

      readContent
        .then(function (content) {
          return fetch("/api/import-note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              content: content,
              keep_original: !!(keepOriginalBox && keepOriginalBox.checked),
            }),
          });
        })
        .then(function (res) {
          return res.json().then(function (data) { return { res: res, data: data }; });
        })
        .then(function (result) {
          if (!result.res.ok || !result.data.ok) throw new Error(result.data.error || "HTTP " + result.res.status);
          window.location.href = result.data.url;
        })
        .catch(function (err) {
          importInput.value = "";
          if (importStatus) {
            importStatus.textContent =
              "가져오기 실패 — scripts/preview.sh로 실행한 게 맞는지 확인하세요 (" + err.message + ")";
          }
        });
    });
  }

  // ── 할 일 (날짜별, localStorage, vault 파일과 무관) ──
  var todoList = document.getElementById("todo-list");
  if (todoList) {
    var todoEmpty = document.getElementById("todo-empty");
    var todoInput = document.getElementById("todo-input");
    var todoAddBtn = document.getElementById("todo-add");
    var todoDatePicker = document.getElementById("todo-date-picker");
    var todoDateLabel = document.getElementById("todo-date-label");
    var todoPrevBtn = document.getElementById("todo-prev-day");
    var todoNextBtn = document.getElementById("todo-next-day");
    var todoTodayBtn = document.getElementById("todo-today-btn");
    var statTodo = document.getElementById("stat-todo");
    var currentDate = TODAY_STR;

    var loadTodos = function (dateStr) {
      try { return JSON.parse(localStorage.getItem("myremember-todo-" + dateStr) || "[]"); }
      catch (e) { return []; }
    };
    var saveTodos = function (dateStr, list) {
      localStorage.setItem("myremember-todo-" + dateStr, JSON.stringify(list));
    };
    var checkSvg = function () {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    };
    var buildRow = function (todo) {
      var row = document.createElement("div");
      row.className = "todo-row" + (todo.done ? " done" : "");
      row.dataset.id = todo.id;
      row.innerHTML =
        '<span class="todo-box">' + checkSvg() + "</span>" +
        '<span class="todo-title"></span>' +
        '<button type="button" class="btn-icon todo-edit" aria-label="수정">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>' +
        '<button type="button" class="btn-icon todo-remove" aria-label="삭제">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
      row.querySelector(".todo-title").textContent = todo.text;
      return row;
    };
    var startEdit = function (row, todo) {
      var titleEl = row.querySelector(".todo-title");
      var input = document.createElement("input");
      input.type = "text";
      input.className = "todo-edit-input";
      input.value = todo.text;
      titleEl.replaceWith(input);
      input.focus();
      input.select();

      var done = false;
      var finish = function (save) {
        if (done) return;
        done = true;
        if (save) {
          var newText = input.value.trim();
          if (newText) {
            var list = loadTodos(currentDate);
            var t = list.find(function (x) { return x.id === todo.id; });
            if (t) {
              t.text = newText;
              saveTodos(currentDate, list);
            }
          }
        }
        renderTodos();
      };

      input.addEventListener("click", function (e) { e.stopPropagation(); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        else if (e.key === "Escape") { e.preventDefault(); finish(false); }
      });
      input.addEventListener("blur", function () { finish(true); });
    };
    var renderTodos = function () {
      todoList.innerHTML = "";
      var list = loadTodos(currentDate);
      list.forEach(function (todo) { todoList.appendChild(buildRow(todo)); });
      todoEmpty.style.display = list.length ? "none" : "";
      if (todoDateLabel) {
        todoDateLabel.textContent = currentDate === TODAY_STR ? "· 오늘 · " + toKoreanLabel(currentDate) : "· " + toKoreanLabel(currentDate);
      }
      if (todoDatePicker) todoDatePicker.value = currentDate;
      if (statTodo) statTodo.textContent = loadTodos(TODAY_STR).filter(function (t) { return !t.done; }).length;
    };
    var addTodo = function (text) {
      text = text.trim();
      if (!text) return;
      var list = loadTodos(currentDate);
      list.push({ id: "todo-" + Date.now(), text: text, done: false });
      saveTodos(currentDate, list);
      renderTodos();
    };
    var goToDate = function (dateStr) {
      currentDate = dateStr;
      renderTodos();
    };

    renderTodos();

    todoList.addEventListener("click", function (e) {
      var editBtn = e.target.closest(".todo-edit");
      var removeBtn = e.target.closest(".todo-remove");
      var row = e.target.closest(".todo-row");
      if (!row) return;
      var list = loadTodos(currentDate);
      if (editBtn) {
        var editTodo = list.find(function (t) { return t.id === row.dataset.id; });
        if (editTodo) startEdit(row, editTodo);
        return;
      }
      if (removeBtn) {
        list = list.filter(function (t) { return t.id !== row.dataset.id; });
        saveTodos(currentDate, list);
        renderTodos();
        return;
      }
      var todo = list.find(function (t) { return t.id === row.dataset.id; });
      if (todo) {
        todo.done = !todo.done;
        saveTodos(currentDate, list);
        renderTodos();
      }
    });

    todoAddBtn.addEventListener("click", function () { addTodo(todoInput.value); todoInput.value = ""; todoInput.focus(); });
    todoInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addTodo(todoInput.value); todoInput.value = ""; }
    });
    todoDatePicker.addEventListener("change", function () { if (todoDatePicker.value) goToDate(todoDatePicker.value); });
    todoPrevBtn.addEventListener("click", function () { var d = fromDateStr(currentDate); d.setDate(d.getDate() - 1); goToDate(toDateStr(d)); });
    todoNextBtn.addEventListener("click", function () { var d = fromDateStr(currentDate); d.setDate(d.getDate() + 1); goToDate(toDateStr(d)); });
    todoTodayBtn.addEventListener("click", function () { goToDate(TODAY_STR); });
  }

  // ── 빠른 메모 (단일 스크래치 메모, localStorage, vault 파일과 무관) ──
  var memo = document.getElementById("memo");
  if (memo) {
    var memoStatus = document.getElementById("memo-status");
    var memoSave = document.getElementById("memo-save");
    var MEMO_KEY = "myremember-quick-memo";

    memo.value = localStorage.getItem(MEMO_KEY) || "";

    var saveMemo = function () {
      localStorage.setItem(MEMO_KEY, memo.value);
      var now = new Date();
      memoStatus.textContent = "저장됨 · " + pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    };
    memoSave.addEventListener("click", saveMemo);
    memo.addEventListener("blur", saveMemo);
  }
})();
