/* Интерактивный терминал в hero главной страницы.
   Прогрессивное улучшение: без JS остаётся статичное окно терминала. */
(function () {
  "use strict";

  var SECTIONS = [
    { meta: "drwxr-xr-x", label: "windows/", url: "notes/windows/", desc: "DCOM, Office, 1С, службы, права доступа" },
    { meta: "drwxr-xr-x", label: "linux/", url: "notes/linux/", desc: "диски, процессы, systemd, SSH, сеть" },
    { meta: "drwxr-xr-x", label: "network/", url: "notes/network/", desc: "DNS, VPN, firewall, MikroTik, Juniper" },
    { meta: "drwxr-xr-x", label: "monitoring/", url: "notes/monitoring/", desc: "Zabbix, Prometheus, Grafana, алерты" },
    { meta: "drwxr-xr-x", label: "files/", url: "notes/files/", desc: "REG-файлы, скрипты, утилиты" },
    { meta: "lrwxrwxrwx", label: "tags/ ->", url: "tags/", desc: "заметки по технологиям и ошибкам" }
  ];

  var CD_ALIASES = {
    linux: "notes/linux/",
    windows: "notes/windows/",
    network: "notes/network/",
    "сети": "notes/network/",
    monitoring: "notes/monitoring/",
    "мониторинг": "notes/monitoring/",
    files: "notes/files/",
    "файлы": "notes/files/",
    tags: "tags/",
    "теги": "tags/"
  };

  function init() {
    var body = document.querySelector(".kb-term__body");
    var live = document.querySelector(".kb-cmd--live");
    if (!body || !live || body.dataset.kbLive) return;
    body.dataset.kbLive = "1";

    var input = document.createElement("input");
    input.className = "kb-term__input";
    input.type = "text";
    input.placeholder = "введите help";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Терминал: введите команду, например help");
    live.insertBefore(input, live.querySelector(".kb-cursor"));

    var history = [];
    var hIdx = -1;

    body.addEventListener("click", function (e) {
      if (window.getSelection().toString()) return;
      if (e.target.closest("a, button, input")) return;
      input.focus({ preventScroll: true });
    });

    input.addEventListener("keydown", function (e) {
      // Не отдаём клавиши хоткеям Material (поиск на «/», «s» и т.д.)
      e.stopPropagation();
      if (e.key === "Enter") {
        run(input.value);
        input.value = "";
        hIdx = -1;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length) {
          hIdx = Math.min(hIdx + 1, history.length - 1);
          input.value = history[history.length - 1 - hIdx];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        hIdx = Math.max(hIdx - 1, -1);
        input.value = hIdx === -1 ? "" : history[history.length - 1 - hIdx];
      }
    });

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    }

    function echo(cmdText) {
      var p = el("p", "kb-cmd kb-term__entry");
      p.appendChild(el("span", "kb-prompt", "➜ "));
      p.appendChild(el("span", "kb-path", "~/sysadmin-notes "));
      p.appendChild(el("span", "kb-faint", "$ "));
      p.appendChild(el("span", null, cmdText));
      body.insertBefore(p, live);
    }

    function out(node) {
      var wrap = el("div", "kb-term__out kb-term__entry");
      wrap.appendChild(node);
      body.insertBefore(wrap, live);
    }

    function textOut(lines) {
      out(el("pre", null, lines.join("\n")));
    }

    function linkList(items) {
      var d = el("div");
      items.forEach(function (it) {
        var row = el("p", "kb-term__row");
        if (it.meta) row.appendChild(el("span", "kb-faint", it.meta + "  "));
        var a = el("a", null, it.label);
        a.href = it.url;
        row.appendChild(a);
        if (it.desc) row.appendChild(el("span", "kb-term__desc", "  — " + it.desc));
        d.appendChild(row);
      });
      out(d);
    }

    var COMMANDS = {
      help: function () {
        textOut([
          "Доступные команды:",
          "",
          "  help          этот список",
          "  ls            разделы базы знаний",
          "  cd <раздел>   перейти в раздел (например: cd linux)",
          "  tail          последние заметки",
          "  pwd           где мы",
          "  whoami        кто здесь",
          "  contact       контакты",
          "  clear         очистить вывод",
          "",
          "История команд — стрелками ↑/↓."
        ]);
      },
      ls: function () {
        linkList(SECTIONS);
      },
      cd: function (arg) {
        if (!arg) {
          textOut(["cd: укажи раздел, например: cd linux (список — ls)"]);
          return;
        }
        var url = CD_ALIASES[arg];
        if (!url) {
          textOut(["cd: нет такого раздела: " + arg, "Список разделов — команда ls."]);
          return;
        }
        textOut(["Переходим в ./" + arg + " …"]);
        window.location.href = url;
      },
      tail: function () {
        var notes = [];
        document.querySelectorAll(".kb-log a").forEach(function (a) {
          var time = a.querySelector("time");
          var title = a.querySelector("strong");
          if (title) {
            notes.push({
              meta: time ? time.textContent : "",
              label: title.textContent,
              url: a.getAttribute("href")
            });
          }
        });
        if (notes.length) {
          linkList(notes);
        } else {
          textOut(["tail: лог пуст."]);
        }
      },
      pwd: function () {
        textOut(["/home/roman/sysadmin-notes"]);
      },
      whoami: function () {
        textOut(["roman", "# сисадмин; здесь — моя рабочая база знаний"]);
      },
      contact: function () {
        linkList([
          { label: "github.com/iamrlufe", url: "https://github.com/iamrlufe" },
          { label: "rlufe.kz", url: "/" }
        ]);
      },
      sudo: function () {
        textOut(["roman is not in the sudoers file. This incident will be reported."]);
      },
      clear: function () {
        body.querySelectorAll(".kb-term__entry").forEach(function (n) {
          n.remove();
        });
      }
    };

    function run(raw) {
      var cmdline = raw.trim();
      if (!cmdline) return;
      history.push(cmdline);
      echo(cmdline);

      var parts = cmdline.toLowerCase().split(/\s+/);
      var cmd = parts[0];
      var arg = parts.slice(1).join(" ");

      // «ls разделы», «ls -la» и т.п. работают как ls
      if (COMMANDS[cmd]) {
        COMMANDS[cmd](arg);
      } else {
        textOut(["bash: " + cmd + ": команда не найдена", "Введите help — покажу, что умею."]);
      }
      live.scrollIntoView({ block: "nearest" });
    }
  }

  // Material с navigation.instant подменяет DOM без перезагрузки —
  // инициализируемся через document$, иначе терминал оживёт только раз.
  if (typeof document$ !== "undefined") {
    document$.subscribe(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
