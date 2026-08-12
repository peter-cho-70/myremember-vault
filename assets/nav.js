(function () {
  var sidebar = document.getElementById("sidebar");
  var overlay = document.getElementById("sidebar-overlay");
  var toggle = document.getElementById("sidebar-toggle");
  if (!sidebar || !overlay || !toggle) return;

  function open() {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  }

  function close() {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }

  toggle.addEventListener("click", function () {
    if (sidebar.classList.contains("open")) close();
    else open();
  });
  overlay.addEventListener("click", close);
  sidebar.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", close);
  });
})();
