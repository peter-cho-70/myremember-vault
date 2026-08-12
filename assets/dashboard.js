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
  // 데이터 모델: "myremember-todo-{날짜}"는 그날의 실제 항목 배열
  // {id, text, done, recurring, templateId, carriedFrom}. "매일" 항목은 별도
  // 템플릿 목록(myremember-todo-recurring-templates, {id, text}만 저장 — done은
  // 날짜마다 다르므로 템플릿엔 없음)에서 그날 화면에 처음 뜰 때 그 날짜 배열로
  // "복제"(materialize)된다. 완료 못한 일반 항목은 다음날 화면을 열 때 전날 배열을
  // 보고 같은 방식으로 하루치만 복제된다(연쇄적으로 여러 날을 건너뛰어도 계속
  // 넘어가려면 중간 날짜들을 다 열어봐야 함 — 정적 localStorage라 백그라운드 처리가
  // 없어서 "본 날짜만 이어진다"는 게 자연스러운 한계).
  var todoList = document.getElementById("todo-list");
  if (todoList) {
    var todoEmpty = document.getElementById("todo-empty");
    var todoInput = document.getElementById("todo-input");
    var todoRecurringBox = document.getElementById("todo-recurring");
    var todoAddBtn = document.getElementById("todo-add");
    var todoDatePicker = document.getElementById("todo-date-picker");
    var todoDateLabel = document.getElementById("todo-date-label");
    var todoPrevBtn = document.getElementById("todo-prev-day");
    var todoNextBtn = document.getElementById("todo-next-day");
    var todoTodayBtn = document.getElementById("todo-today-btn");
    var statTodo = document.getElementById("stat-todo");
    var currentDate = TODAY_STR;
    var RECURRING_KEY = "myremember-todo-recurring-templates";

    var loadRawTodos = function (dateStr) {
      try { return JSON.parse(localStorage.getItem("myremember-todo-" + dateStr) || "[]"); }
      catch (e) { return []; }
    };
    var saveRawTodos = function (dateStr, list) {
      localStorage.setItem("myremember-todo-" + dateStr, JSON.stringify(list));
    };
    var loadRecurringTemplates = function () {
      try { return JSON.parse(localStorage.getItem(RECURRING_KEY) || "[]"); }
      catch (e) { return []; }
    };
    var saveRecurringTemplates = function (list) {
      localStorage.setItem(RECURRING_KEY, JSON.stringify(list));
    };
    // 그날 배열에 "매일" 템플릿과 전날의 미완료 항목을 복제해 넣는다(이미 있으면
    // 건너뜀). 전날은 원시 읽기만 한다 — 재귀적으로 계속 materialize하면 한 번도
    // 안 열어본 날짜까지 무한히 거슬러 올라갈 수 있어서, 딱 하루 앞만 본다.
    var ensureMaterialized = function (dateStr) {
      var list = loadRawTodos(dateStr);
      var changed = false;

      loadRecurringTemplates().forEach(function (tpl) {
        var exists = list.some(function (t) { return t.templateId === tpl.id; });
        if (!exists) {
          list.push({ id: "rec-" + tpl.id + "-" + dateStr, text: tpl.text, done: false, recurring: true, templateId: tpl.id });
          changed = true;
        }
      });

      var prevDate = fromDateStr(dateStr);
      prevDate.setDate(prevDate.getDate() - 1);
      var prevList = loadRawTodos(toDateStr(prevDate));
      prevList.forEach(function (t) {
        if (t.done || t.recurring) return;
        var origId = t.carriedFrom || t.id;
        var exists = list.some(function (x) { return (x.carriedFrom || x.id) === origId; });
        if (!exists) {
          list.push({ id: "carry-" + origId + "-" + dateStr, text: t.text, done: false, recurring: false, carriedFrom: origId });
          changed = true;
        }
      });

      if (changed) saveRawTodos(dateStr, list);
      return list;
    };
    var checkSvg = function () {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    };
    var buildRow = function (todo) {
      var row = document.createElement("div");
      row.className = "todo-row" + (todo.done ? " done" : "");
      row.dataset.id = todo.id;
      var badge = todo.recurring ? '<span class="todo-badge">매일</span>' : (todo.carriedFrom ? '<span class="todo-badge">이월</span>' : "");
      row.innerHTML =
        '<span class="todo-box">' + checkSvg() + "</span>" +
        '<span class="todo-title"></span>' +
        badge +
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
            var list = loadRawTodos(currentDate);
            var t = list.find(function (x) { return x.id === todo.id; });
            if (t) {
              t.text = newText;
              saveRawTodos(currentDate, list);
            }
            if (todo.templateId) {
              var templates = loadRecurringTemplates();
              var tpl = templates.find(function (x) { return x.id === todo.templateId; });
              if (tpl) {
                tpl.text = newText;
                saveRecurringTemplates(templates);
              }
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
      var list = ensureMaterialized(currentDate);
      list.forEach(function (todo) { todoList.appendChild(buildRow(todo)); });
      todoEmpty.style.display = list.length ? "none" : "";
      if (todoDateLabel) {
        todoDateLabel.textContent = currentDate === TODAY_STR ? "· 오늘 · " + toKoreanLabel(currentDate) : "· " + toKoreanLabel(currentDate);
      }
      if (todoDatePicker) todoDatePicker.value = currentDate;
      if (statTodo) statTodo.textContent = ensureMaterialized(TODAY_STR).filter(function (t) { return !t.done; }).length;
    };
    var addTodo = function (text, recurring) {
      text = text.trim();
      if (!text) return;
      var list = loadRawTodos(currentDate);
      if (recurring) {
        var templates = loadRecurringTemplates();
        var tplId = "tpl-" + Date.now();
        templates.push({ id: tplId, text: text });
        saveRecurringTemplates(templates);
        list.push({ id: "rec-" + tplId + "-" + currentDate, text: text, done: false, recurring: true, templateId: tplId });
      } else {
        list.push({ id: "todo-" + Date.now(), text: text, done: false });
      }
      saveRawTodos(currentDate, list);
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
      var list = loadRawTodos(currentDate);
      if (editBtn) {
        var editTodo = list.find(function (t) { return t.id === row.dataset.id; });
        if (editTodo) startEdit(row, editTodo);
        return;
      }
      if (removeBtn) {
        var removeTodo = list.find(function (t) { return t.id === row.dataset.id; });
        if (removeTodo && removeTodo.templateId) {
          saveRecurringTemplates(loadRecurringTemplates().filter(function (t) { return t.id !== removeTodo.templateId; }));
        }
        list = list.filter(function (t) { return t.id !== row.dataset.id; });
        saveRawTodos(currentDate, list);
        renderTodos();
        return;
      }
      var todo = list.find(function (t) { return t.id === row.dataset.id; });
      if (todo) {
        todo.done = !todo.done;
        saveRawTodos(currentDate, list);
        renderTodos();
      }
    });

    var addFromInput = function () {
      addTodo(todoInput.value, !!(todoRecurringBox && todoRecurringBox.checked));
      todoInput.value = "";
      if (todoRecurringBox) todoRecurringBox.checked = false;
    };
    todoAddBtn.addEventListener("click", function () { addFromInput(); todoInput.focus(); });
    todoInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addFromInput(); }
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
