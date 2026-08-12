(function () {
  var input = document.getElementById("search-input");
  var results = document.getElementById("search-results");
  var hint = document.getElementById("search-hint");
  var notes = window.MYREMEMBER_NOTES || [];
  var root = window.MYREMEMBER_ROOT || "";

  function render(list, query) {
    results.innerHTML = "";
    if (!query) {
      hint.style.display = "";
      return;
    }
    hint.style.display = "none";
    if (list.length === 0) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "검색 결과 없음: " + query;
      results.appendChild(empty);
      return;
    }
    list.forEach(function (note) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = root + note.url;
      a.textContent = note.title;
      li.appendChild(a);
      if (note.tags && note.tags.length) {
        var tagsEl = document.createElement("span");
        tagsEl.className = "tags";
        tagsEl.textContent = " " + note.tags.map(function (t) { return "#" + t; }).join(" ");
        li.appendChild(tagsEl);
      }
      results.appendChild(li);
    });
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    return notes.filter(function (n) {
      return (
        n.title.toLowerCase().indexOf(q) !== -1 ||
        n.body.toLowerCase().indexOf(q) !== -1 ||
        n.tags.some(function (t) { return t.toLowerCase().indexOf(q) !== -1; })
      );
    });
  }

  input.addEventListener("input", function () {
    render(search(input.value), input.value.trim());
  });
})();
