(function () {
  var mergeBtn = document.getElementById("merge-btn");
  if (mergeBtn) {
    var sourcesSelect = document.getElementById("merge-sources");
    var targetInput = document.getElementById("merge-target");
    var statusEl = document.getElementById("merge-status");

    mergeBtn.addEventListener("click", function () {
      var sources = Array.prototype.map.call(sourcesSelect.selectedOptions, function (o) { return o.value; });
      var target = targetInput.value.trim();
      if (sources.length === 0) {
        statusEl.textContent = "합칠 태그를 하나 이상 선택하세요.";
        return;
      }
      if (!target) {
        statusEl.textContent = "합칠 대상 이름을 입력하세요.";
        return;
      }
      var confirmed = window.confirm(
        "#" + sources.join(", #") + " 를(을) #" + target + " (으)로 합칩니다.\n" +
        "관련된 모든 노트 파일이 실제로 수정됩니다. 계속할까요?"
      );
      if (!confirmed) return;

      mergeBtn.disabled = true;
      statusEl.textContent = "병합 중…";
      fetch("/api/merge-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: sources, target: target }),
      })
        .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
        .then(function (result) {
          if (!result.res.ok || !result.data.ok) throw new Error(result.data.error || "HTTP " + result.res.status);
          window.location.reload();
        })
        .catch(function (err) {
          mergeBtn.disabled = false;
          statusEl.textContent = "병합 실패 — scripts/preview.sh로 실행한 게 맞는지 확인하세요 (" + err.message + ")";
        });
    });
  }

  // ── 태그 관계 (상위/하위) — 태그를 하나 고르면 현재 상위 태그가 칩으로 보이고,
  // 추가/삭제할 때마다 바로 저장된다(멀티셀렉트로 여러 개를 Ctrl/Cmd+클릭해야 하는
  // 예전 방식이 너무 어렵다는 피드백을 받아, 한 번에 하나씩 고르고 즉시 반영되는
  // 칩 방식으로 바꿈 — 별도 "저장" 버튼 없이 클릭 한 번이 곧 저장).
  var relationSelect = document.getElementById("relation-tag-select");
  if (relationSelect) {
    var relations = window.MYREMEMBER_TAG_RELATIONS || {};
    var editor = document.getElementById("relation-editor");
    var chipsEl = document.getElementById("relation-chips");
    var chipsEmptyHint = document.getElementById("relation-empty-hint");
    var addSelect = document.getElementById("relation-add-select");
    var addBtn = document.getElementById("relation-add-btn");
    var relationStatus = document.getElementById("relation-status");
    var allTags = Array.prototype.map
      .call(relationSelect.options, function (o) { return o.value; })
      .filter(function (v) { return v; });

    var render = function () {
      var tag = relationSelect.value;
      if (!tag) {
        editor.style.display = "none";
        return;
      }
      editor.style.display = "";
      var parents = relations[tag] || [];

      chipsEl.innerHTML = "";
      parents.forEach(function (p) {
        var chip = document.createElement("span");
        chip.className = "chip";
        var text = document.createElement("span");
        text.textContent = "#" + p;
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "chip-remove";
        removeBtn.setAttribute("aria-label", "삭제");
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", function () {
          saveParents(parents.filter(function (x) { return x !== p; }));
        });
        chip.appendChild(text);
        chip.appendChild(removeBtn);
        chipsEl.appendChild(chip);
      });
      chipsEmptyHint.style.display = parents.length ? "none" : "";

      addSelect.innerHTML = "";
      var candidates = allTags.filter(function (t) { return t !== tag && parents.indexOf(t) === -1; });
      if (candidates.length === 0) {
        addSelect.disabled = true;
        addBtn.disabled = true;
        var noneOpt = document.createElement("option");
        noneOpt.textContent = "추가할 태그 없음";
        addSelect.appendChild(noneOpt);
      } else {
        addSelect.disabled = false;
        addBtn.disabled = false;
        candidates.forEach(function (t) {
          var opt = document.createElement("option");
          opt.value = t;
          opt.textContent = "#" + t;
          addSelect.appendChild(opt);
        });
      }
    };

    var saveParents = function (newParents) {
      var tag = relationSelect.value;
      relationStatus.textContent = "저장 중…";
      fetch("/api/set-tag-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tag, parents: newParents }),
      })
        .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
        .then(function (result) {
          if (!result.res.ok || !result.data.ok) throw new Error(result.data.error || "HTTP " + result.res.status);
          relations[tag] = result.data.parents;
          relationStatus.textContent = "저장됨";
          render();
          setTimeout(function () { relationStatus.textContent = ""; }, 2000);
        })
        .catch(function (err) {
          relationStatus.textContent = "실패 — " + err.message;
        });
    };

    relationSelect.addEventListener("change", render);
    addBtn.addEventListener("click", function () {
      if (!addSelect.value) return;
      saveParents((relations[relationSelect.value] || []).concat([addSelect.value]));
    });
  }
})();
