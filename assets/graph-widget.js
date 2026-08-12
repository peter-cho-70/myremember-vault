(function () {
  var svg = document.getElementById("graph-widget-svg");
  if (!svg) return;

  var legendEl = document.getElementById("graph-widget-legend");
  var emptyEl = document.getElementById("graph-widget-empty");
  var hintEl = document.getElementById("graph-widget-hint");
  var root = window.MYREMEMBER_ROOT || "";
  var data = window.MYREMEMBER_GRAPH || { nodes: [], edges: [], tagParents: {} };

  var SVGNS = "http://www.w3.org/2000/svg";
  var W = 600, H = 240, PAD = 22;
  // 노트가 많아지면 미리보기 위젯 하나로는 감당이 안 되니 상한을 두고 초과분은 생략만 한다
  // (별도 "전체 화면" 페이지는 이번 범위 밖 — 필요해지면 나중에 추가).
  var MAX_NODES = 150;

  if (!data.nodes || data.nodes.length === 0) {
    svg.style.display = "none";
    if (emptyEl) emptyEl.style.display = "";
    return;
  }

  var notes = data.nodes.slice(0, MAX_NODES).map(function (n) {
    return {
      kind: "note",
      id: n.id,
      title: n.title,
      url: n.url,
      tags: n.tags || [],
      dirType: n.dir_type,
      x: PAD + Math.random() * (W - 2 * PAD),
      y: PAD + Math.random() * (H - 2 * PAD),
      vx: 0,
      vy: 0,
    };
  });
  var noteById = {};
  notes.forEach(function (n) { noteById[n.id] = n; });

  var noteEdges = (data.edges || [])
    .map(function (e) { return { source: noteById[e.source], target: noteById[e.target] }; })
    .filter(function (e) { return e.source && e.target; });

  // ── 태그별 색상 배정: 이 노트 집합 안에서 등장 빈도가 높은 태그부터 series-1~8을
  // 고정 순서로 배정(순환하지 않음). 9번째 이후 태그와 태그 없는 노트는 전부 회색(기타)
  // — 범례와 hover 툴팁에 항상 태그 이름이 같이 나오므로 색만으로 구분하지 않아도 된다.
  var tagCounts = {};
  notes.forEach(function (n) {
    n.tags.forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  });
  var tagsByFreq = Object.keys(tagCounts).sort(function (a, b) {
    return tagCounts[b] - tagCounts[a] || a.localeCompare(b);
  });
  var SERIES_VARS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6", "--series-7", "--series-8"];
  var tagColorVar = {};
  tagsByFreq.slice(0, SERIES_VARS.length).forEach(function (tag, i) { tagColorVar[tag] = SERIES_VARS[i]; });

  var OTHER_COLOR = "rgb(var(--muted-foreground))";
  function colorForTag(tag) {
    return tagColorVar[tag] ? "rgb(var(" + tagColorVar[tag] + "))" : OTHER_COLOR;
  }

  notes.forEach(function (n) {
    // 이 노트가 가진 태그 중 색이 배정된(=가장 흔한) 태그를 대표 태그로 쓴다.
    var best = null;
    n.tags.forEach(function (t) {
      if (tagColorVar[t] && (!best || tagCounts[t] > tagCounts[best])) best = t;
    });
    n.primaryTag = best;
    n.color = colorForTag(best);
  });

  // ── 태그 허브 노드: 색이 배정된 태그(상위 8개) + 관계(상위/하위)가 설정된 태그는 전부
  // 허브를 만든다 — 드문 태그라도 계층 관계가 있으면 눈에 보여야 의미가 있다. 노트는
  // 더 이상 같은 태그의 다른 노트와 직접 당기지 않고, 자기 대표 태그의 허브 쪽으로
  // 끌린다(허브-스포크 구조) — 상위/하위 태그끼리는 허브끼리 서로 당긴다.
  var tagParents = data.tagParents || {};
  var hubTags = {};
  Object.keys(tagColorVar).forEach(function (t) { hubTags[t] = true; });
  Object.keys(tagParents).forEach(function (child) {
    hubTags[child] = true;
    (tagParents[child] || []).forEach(function (p) { hubTags[p] = true; });
  });

  var hubs = Object.keys(hubTags).map(function (tag) {
    return {
      kind: "hub",
      tag: tag,
      color: colorForTag(tag),
      x: W / 2 + (Math.random() - 0.5) * 40,
      y: H / 2 + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    };
  });
  var hubByTag = {};
  hubs.forEach(function (h) { hubByTag[h.tag] = h; });
  notes.forEach(function (n) { n.hub = n.primaryTag ? hubByTag[n.primaryTag] : null; });

  var tagEdges = [];
  Object.keys(tagParents).forEach(function (child) {
    (tagParents[child] || []).forEach(function (parent) {
      if (hubByTag[child] && hubByTag[parent]) tagEdges.push({ child: hubByTag[child], parent: hubByTag[parent] });
    });
  });

  // ── 아주 단순한 힘-기반 레이아웃: 전부(노트+허브) 서로 밀어내고(중첩 방지),
  // [[링크]]로 연결된 노트는 강하게, 노트는 자기 대표 태그 허브 쪽으로, 하위 태그 허브는
  // 상위 태그 허브 쪽으로 당긴다. 매 프레임 다시 계산하는 대신 고정 횟수만 미리 돌려서
  // 한 번에 그린다 — 미리보기 위젯이라 지속적인 애니메이션은 불필요하고 CPU만 먹는다.
  var all = notes.concat(hubs);
  var REPULSE_K = 9000;
  var NOTE_HUB_K = 0.03, NOTE_HUB_IDEAL = 40;
  var TAG_EDGE_K = 0.05, TAG_EDGE_IDEAL = 55;
  var EDGE_SPRING_K = 0.09, EDGE_IDEAL = 65;
  var CENTER_K = 0.012;
  var DAMPING = 0.82;
  var ITERATIONS = all.length > 60 ? 120 : 260;

  for (var iter = 0; iter < ITERATIONS; iter++) {
    all.forEach(function (n) { n.fx = 0; n.fy = 0; });

    for (var i = 0; i < all.length; i++) {
      for (var j = i + 1; j < all.length; j++) {
        var a = all[i], b = all[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var distSq = Math.max(dx * dx + dy * dy, 4);
        var dist = Math.sqrt(distSq);
        var rep = REPULSE_K / distSq;
        var ux = dx / dist, uy = dy / dist;
        a.fx -= ux * rep; a.fy -= uy * rep;
        b.fx += ux * rep; b.fy += uy * rep;
      }
    }

    notes.forEach(function (n) {
      if (!n.hub) return;
      var dx = n.hub.x - n.x, dy = n.hub.y - n.y;
      var dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      var pull = (dist - NOTE_HUB_IDEAL) * NOTE_HUB_K;
      var ux = dx / dist, uy = dy / dist;
      n.fx += ux * pull; n.fy += uy * pull;
      n.hub.fx -= ux * pull; n.hub.fy -= uy * pull;
    });

    tagEdges.forEach(function (e) {
      var dx = e.parent.x - e.child.x, dy = e.parent.y - e.child.y;
      var dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      var pull = (dist - TAG_EDGE_IDEAL) * TAG_EDGE_K;
      var ux = dx / dist, uy = dy / dist;
      e.child.fx += ux * pull; e.child.fy += uy * pull;
      e.parent.fx -= ux * pull; e.parent.fy -= uy * pull;
    });

    noteEdges.forEach(function (e) {
      var dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
      var dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      var pull = (dist - EDGE_IDEAL) * EDGE_SPRING_K;
      var ux = dx / dist, uy = dy / dist;
      e.source.fx += ux * pull; e.source.fy += uy * pull;
      e.target.fx -= ux * pull; e.target.fy -= uy * pull;
    });

    all.forEach(function (n) {
      n.fx += (W / 2 - n.x) * CENTER_K;
      n.fy += (H / 2 - n.y) * CENTER_K;
      n.vx = (n.vx + n.fx) * DAMPING;
      n.vy = (n.vy + n.fy) * DAMPING;
      n.x = Math.min(W - PAD, Math.max(PAD, n.x + n.vx));
      n.y = Math.min(H - PAD, Math.max(PAD, n.y + n.vy));
    });
  }

  // ── 렌더링 ──
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  function drawLine(a, b, cls) {
    var line = document.createElementNS(SVGNS, "line");
    line.setAttribute("class", cls);
    line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
    svg.appendChild(line);
  }

  noteEdges.forEach(function (e) { drawLine(e.source, e.target, "graph-edge"); });
  tagEdges.forEach(function (e) { drawLine(e.child, e.parent, "graph-tag-edge"); });

  notes.forEach(function (n) {
    var a = document.createElementNS(SVGNS, "a");
    a.setAttribute("class", "graph-node-link");
    a.setAttribute("href", root + n.url);

    var tooltip = document.createElementNS(SVGNS, "title");
    tooltip.textContent = n.tags.length ? n.title + " · #" + n.tags.join(" #") : n.title;
    a.appendChild(tooltip);

    var hit = document.createElementNS(SVGNS, "circle");
    hit.setAttribute("class", "graph-node-hit");
    hit.setAttribute("cx", n.x); hit.setAttribute("cy", n.y); hit.setAttribute("r", 11);
    a.appendChild(hit);

    var dot = document.createElementNS(SVGNS, "circle");
    dot.setAttribute("class", "graph-node-dot");
    dot.setAttribute("cx", n.x); dot.setAttribute("cy", n.y); dot.setAttribute("r", 5);
    dot.setAttribute("fill", n.color);
    a.appendChild(dot);

    svg.appendChild(a);
  });

  hubs.forEach(function (h) {
    var a = document.createElementNS(SVGNS, "a");
    a.setAttribute("class", "graph-node-link");
    a.setAttribute("href", root + "tags/" + h.tag + ".html");

    var tooltip = document.createElementNS(SVGNS, "title");
    tooltip.textContent = "#" + h.tag;
    a.appendChild(tooltip);

    var hit = document.createElementNS(SVGNS, "circle");
    hit.setAttribute("class", "graph-node-hit");
    hit.setAttribute("cx", h.x); hit.setAttribute("cy", h.y); hit.setAttribute("r", 13);
    a.appendChild(hit);

    var dot = document.createElementNS(SVGNS, "circle");
    dot.setAttribute("class", "graph-hub-dot");
    dot.setAttribute("cx", h.x); dot.setAttribute("cy", h.y); dot.setAttribute("r", 7);
    dot.setAttribute("fill", h.color);
    a.appendChild(dot);

    var label = document.createElementNS(SVGNS, "text");
    label.setAttribute("class", "graph-hub-label");
    label.setAttribute("x", h.x);
    label.setAttribute("y", h.y - 11);
    label.setAttribute("text-anchor", "middle");
    label.textContent = h.tag;
    a.appendChild(label);

    svg.appendChild(a);
  });

  // ── 범례: 색이 배정된 태그 + (해당되면) 기타 ──
  if (legendEl) {
    var hasOther = notes.some(function (n) { return !n.primaryTag; });
    tagsByFreq.slice(0, SERIES_VARS.length).forEach(function (tag) {
      legendEl.appendChild(buildLegendItem(colorForTag(tag), tag));
    });
    if (hasOther || tagsByFreq.length > SERIES_VARS.length) {
      legendEl.appendChild(buildLegendItem(OTHER_COLOR, "기타"));
    }
  }

  if (hintEl && noteEdges.length === 0 && tagEdges.length === 0) {
    hintEl.textContent = "아직 노트끼리 [[링크]]나 태그 상위/하위 관계가 없어서 점들이 태그 색으로만 묶여 있습니다.";
    hintEl.style.display = "";
  }

  function buildLegendItem(color, label) {
    var item = document.createElement("span");
    item.className = "graph-legend-item";
    var dot = document.createElement("span");
    dot.className = "graph-legend-dot";
    dot.style.background = color;
    var text = document.createElement("span");
    text.textContent = label;
    item.appendChild(dot);
    item.appendChild(text);
    return item;
  }
})();
