// 클라우드(읽기 전용) '외국어 학습' 페이지 — 최근 5일치 학습자료를 날짜별로 보고 모바일에서도 듣는다.
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  var lessons = JSON.parse($("lc-data").textContent || "[]");
  var audio = $("lc-audio"), listEl = $("lc-list"), daysEl = $("lc-days"), infoEl = $("lc-info");
  var LANG_NAMES = { en: "영어", zh: "중국어", ja: "일본어", fr: "프랑스어", es: "스페인어", de: "독일어", ko: "한국어" };
  var KIND_NAMES = { word: "단어", example: "예문", sentence: "회화 문장" };
  var KIND_ORDER = ["word", "example", "sentence"];
  var LANG_ORDER = ["en", "zh", "ja", "fr", "es", "de", "ko"];
  var SPEEDS = [["0.6", "0.6×"], ["0.75", "0.75×"], ["0.9", "0.9× (기본)"], ["1", "1×"], ["1.25", "1.25×"]];
  var SPEED_KEY = "lang-speed-", DAY_KEY = "lc-day";
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  ["lc-repeat", "lc-gap"].forEach(function (id) {
    var v = store(id); if (v) $(id).value = v;
    $(id).addEventListener("change", function () { store(id, $(id).value); });
  });
  function repeatCount() { var n = parseInt($("lc-repeat").value, 10); return Math.max(1, Math.min(20, isNaN(n) ? 1 : n)); }
  function gapMs() { var s = parseFloat($("lc-gap").value); return Math.max(0, isNaN(s) ? 0 : s) * 1000; }
  function speedOf(lg) { var r = parseFloat(store(SPEED_KEY + lg)); return isNaN(r) || r <= 0 ? 0.9 : r; }
  function applySpeed(lg) { var r = speedOf(lg); audio.defaultPlaybackRate = r; audio.playbackRate = r; audio.preservesPitch = true; audio.webkitPreservesPitch = true; }

  // 일본어·중국어는 단어 단위로 띄어 보여 준다 (표시만 바뀜)
  var segs = {};
  function spacedText(it) {
    if (it.spaced) return it.spaced;
    var lg = it.language;
    if ((lg !== "ja" && lg !== "zh") || it.kind === "word" || !window.Intl || !Intl.Segmenter) return it.text;
    try {
      var sg = segs[lg] || (segs[lg] = new Intl.Segmenter(lg, { granularity: "word" })), out = "", pw = false;
      Array.from(sg.segment(it.text)).forEach(function (x) {
        var w = x.segment; if (!w.trim()) return;
        if (x.isWordLike) { out += (out && (pw || !/[「『（(“"‘]$/.test(out)) ? " " : "") + w; pw = true; } else { out += w; pw = false; }
      });
      return out || it.text;
    } catch (e) { return it.text; }
  }

  var queue = [], timer = null, current = null, curLang = "";
  function clearPlayback() {
    queue = []; if (timer) { clearTimeout(timer); timer = null; }
    audio.pause(); if (current) { current.classList.remove("playing"); current = null; } infoEl.textContent = "";
  }
  function playEntry(e) {
    if (current) current.classList.remove("playing");
    current = e.li; curLang = e.item.language; e.li.classList.add("playing");
    infoEl.textContent = "재생 중 " + e.rep + "/" + e.total + "회 · 남은 " + queue.length + "개";
    audio.src = e.item.audio; applySpeed(curLang);
    audio.play().catch(function () {});
  }
  function advance() {
    if (!queue.length) { if (current) { current.classList.remove("playing"); current = null; } infoEl.textContent = ""; return; }
    var n = queue.shift(), ms = gapMs();
    if (ms > 0) timer = setTimeout(function () { timer = null; playEntry(n); }, ms); else playEntry(n);
  }
  audio.addEventListener("ended", advance); audio.addEventListener("error", advance);
  $("lc-stop").addEventListener("click", clearPlayback);
  function playList(entries) {
    var ready = entries.filter(function (e) { return e.item.audio; });
    clearPlayback(); if (!ready.length) return;
    var n = repeatCount(), seq = [];
    ready.forEach(function (e) { for (var r = 1; r <= n; r++) seq.push({ item: e.item, li: e.li, rep: r, total: n }); });
    queue = seq.slice(1); playEntry(seq[0]);
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  var day = store(DAY_KEY);
  if (!lessons.some(function (l) { return l.date === day; })) day = lessons.length ? lessons[0].date : "";

  function render() {
    clearPlayback(); daysEl.innerHTML = ""; listEl.innerHTML = "";
    if (!lessons.length) { listEl.appendChild(el("p", "empty-hint", "등록된 학습자료가 없습니다.")); return; }
    lessons.forEach(function (l) {
      var b = el("button", "btn btn-secondary" + (l.date === day ? " sel" : ""), l.date.slice(5));
      b.type = "button"; b.addEventListener("click", function () { day = l.date; store(DAY_KEY, day); render(); });
      daysEl.appendChild(b);
    });
    var lesson = lessons.filter(function (l) { return l.date === day; })[0];
    var langs = LANG_ORDER.filter(function (lg) { return lesson.items.some(function (i) { return i.language === lg; }); });
    lesson.items.forEach(function (i) { if (langs.indexOf(i.language) < 0) langs.push(i.language); });
    langs = langs.filter(function (v, i, a) { return a.indexOf(v) === i; });
    langs.forEach(function (lg) {
      var sec = el("section", "lc-sec"), head = el("div", "lc-head"), entries = [];
      head.appendChild(el("span", "lc-title", LANG_NAMES[lg] || lg));
      var sp = el("select"); SPEEDS.forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; sp.appendChild(op); });
      sp.value = String(speedOf(lg)); if (sp.value !== String(speedOf(lg))) sp.value = "0.9";
      sp.title = "재생 속도 (언어별로 기억)";
      sp.addEventListener("change", function () { store(SPEED_KEY + lg, sp.value); if (current && curLang === lg) applySpeed(lg); });
      var all = el("button", "btn btn-secondary", "▶ 전체"); all.type = "button";
      all.addEventListener("click", function () { playList(entries); });
      head.appendChild(sp); head.appendChild(all); sec.appendChild(head);
      KIND_ORDER.forEach(function (kind) {
        var its = lesson.items.filter(function (i) { return i.language === lg && i.kind === kind; });
        if (!its.length) return;
        sec.appendChild(el("div", "lc-kind", KIND_NAMES[kind] + " " + its.length + "개"));
        var wrap = sec; if (kind === "word") { wrap = el("div", "lc-words"); sec.appendChild(wrap); }
        its.forEach(function (it) {
          var li = el("div", "lc-item"), btn = el("button", "btn-icon", "▶"); btn.type = "button"; btn.disabled = !it.audio;
          btn.addEventListener("click", function () { playList([{ item: it, li: li }]); });
          var box = el("div"); box.appendChild(el("div", "lc-text", spacedText(it)));
          var sub = [it.meaning, it.extra].filter(Boolean).join("  ·  "); if (sub) box.appendChild(el("div", "lc-sub", sub));
          li.appendChild(btn); li.appendChild(box); wrap.appendChild(li);
          entries.push({ item: it, li: li });
        });
      });
      listEl.appendChild(sec);
    });
  }
  render();
})();
