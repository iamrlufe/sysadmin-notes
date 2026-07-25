/* Тетрис в модальном окне терминала.

   Всплывает сам один раз — при первом визите на сайт; при следующих
   заходах молчит. Позже игру можно позвать руками: команда `tetris` в
   терминале на главной или window.kbTetris.open() из консоли.

   Модалка живёт в <body> и переживает instant-навигацию Material —
   создаётся один раз за загрузку страницы, а не на каждый document$. */
(function () {
  "use strict";

  var SEEN_KEY = "kb-tetris-seen";
  var BEST_KEY = "kb-tetris-best";
  var AUTO_OPEN_DELAY = 900;

  var W = 10;
  var H = 18;

  // Фигуры — в зелёных оттенках, чтобы не выпадать из палитры терминала.
  var SHAPES = {
    i: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    o: [[1, 1], [1, 1]],
    t: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    s: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    j: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    l: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  var KEYS = ["i", "o", "t", "s", "z", "j", "l"];

  // Сдвиги, которыми пробуем «отжать» фигуру от стены при повороте.
  var KICKS = [0, -1, 1, -2, 2];

  /* ---------- хранилище ----------

     Выбор темы Material держит в localStorage под ключом вида
     "<база сайта>.<имя>" — на rlufe.kz это "/.__palette". База берётся
     из __md_scope, то есть корня сайта, а не текущей страницы, поэтому
     ключ один на весь сайт. Отметку о показе игры кладём туда же и в
     том же формате (значение — JSON): если настройка темы пережила
     перезаход, переживёт и она.

     Схему повторяем, а не зовём __md_get/__md_set: те молча глотают
     отказ хранилища, а нам важно об этом узнать. В приватном режиме
     Safari setItem бросает, и без запасного пути окно всплывало бы на
     каждой странице — ровно то, чего быть не должно. */

  function storageKey(key) {
    var scope = typeof __md_scope !== "undefined" && __md_scope;
    return (scope && scope.pathname ? scope.pathname : "/") + "." + key;
  }

  function localGet(key) {
    try {
      var raw = window.localStorage.getItem(storageKey(key));
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null; // хранилище закрыто или в ключе мусор
    }
  }

  function localSet(key, value) {
    try {
      window.localStorage.setItem(storageKey(key), JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function cookieGet(key) {
    var name = encodeURIComponent(storageKey(key)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    if (!m) return null;
    try {
      return JSON.parse(decodeURIComponent(m[1]));
    } catch (e) {
      return null;
    }
  }

  function cookieSet(key, value) {
    document.cookie = encodeURIComponent(storageKey(key)) + "=" +
      encodeURIComponent(JSON.stringify(value)) +
      ";path=/;max-age=31536000;samesite=lax";
  }

  function readFlag(key) {
    var v = localGet(key);
    return v === null ? cookieGet(key) : v;
  }

  function writeFlag(key, value) {
    if (!localSet(key, value)) cookieSet(key, value);
  }

  /* ---------- разметка ---------- */

  function buildModal() {
    var root = document.createElement("div");
    root.className = "kb-modal";
    root.id = "kb-tetris";
    root.hidden = true;
    root.innerHTML =
      '<div class="kb-modal__backdrop" data-kb-close="1"></div>' +
      '<section class="kb-term kb-term--modal" role="dialog" aria-modal="true"' +
      ' aria-label="Тетрис в терминале" tabindex="-1">' +
      '<div class="kb-term__bar">' +
      "<i></i><i></i><i></i>" +
      "<span>roman@rlufe: ~/games/tetris</span>" +
      '<button type="button" class="kb-modal__close" data-kb-close="1"' +
      ' aria-label="Закрыть игру">✕</button>' +
      "</div>" +
      '<div class="kb-term__body">' +
      '<p class="kb-cmd"><span class="kb-prompt">➜</span> ' +
      '<span class="kb-path">~/games</span> ' +
      '<span class="kb-faint">$</span> ./tetris</p>' +
      '<div class="kb-tetris">' +
      '<pre class="kb-tetris__screen">загрузка…</pre>' +
      '<div class="kb-tetris__side">' +
      '<p class="kb-tetris__label">next</p>' +
      '<pre class="kb-tetris__next"></pre>' +
      '<p class="kb-tetris__stat"></p>' +
      "</div>" +
      "</div>" +
      '<p class="kb-tetris__msg"></p>' +
      '<div class="kb-tetris__pad">' +
      '<button type="button" data-kb-act="left" aria-label="Влево">◀</button>' +
      '<button type="button" data-kb-act="rotate" aria-label="Повернуть">⟳</button>' +
      '<button type="button" data-kb-act="right" aria-label="Вправо">▶</button>' +
      '<button type="button" data-kb-act="drop" aria-label="Сбросить">▼</button>' +
      "</div>" +
      '<p class="kb-snake__hint">← → двигать · ↑ поворот · ↓ вниз · пробел — сброс · ' +
      "P пауза · R заново · Esc закрыть</p>" +
      "</div>" +
      "</section>";
    document.body.appendChild(root);
    return root;
  }

  /* ---------- игра ---------- */

  function init() {
    if (window.kbTetris) return;

    var root = buildModal();
    var dialog = root.querySelector(".kb-term--modal");
    var screen = root.querySelector(".kb-tetris__screen");
    var nextEl = root.querySelector(".kb-tetris__next");
    var statEl = root.querySelector(".kb-tetris__stat");
    var msgEl = root.querySelector(".kb-tetris__msg");

    var board, piece, nextKey, bag;
    var score, lines, level, timer, state; // idle | run | pause | over
    var lastFocused = null;
    var storedBest = readFlag(BEST_KEY);
    var best = typeof storedBest === "number" ? storedBest : 0;

    function newShape(key) {
      return SHAPES[key].map(function (row) { return row.slice(); });
    }

    function takeKey() {
      // Мешок из семи фигур: не даёт выпасть одной и той же пять раз подряд.
      if (!bag || !bag.length) {
        bag = KEYS.slice();
        for (var i = bag.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
        }
      }
      return bag.pop();
    }

    function spawn() {
      var key = nextKey || takeKey();
      nextKey = takeKey();
      var shape = newShape(key);
      piece = {
        key: key,
        shape: shape,
        x: Math.floor((W - shape[0].length) / 2),
        y: -1
      };
      if (collides(piece.shape, piece.x, piece.y)) gameOver();
    }

    function eachCell(shape, fn) {
      for (var y = 0; y < shape.length; y++) {
        for (var x = 0; x < shape[y].length; x++) {
          if (shape[y][x]) fn(x, y);
        }
      }
    }

    function collides(shape, px, py) {
      var hit = false;
      eachCell(shape, function (x, y) {
        var bx = px + x;
        var by = py + y;
        // Выше поля — ещё не столкновение: фигура въезжает сверху.
        if (bx < 0 || bx >= W || by >= H) hit = true;
        else if (by >= 0 && board[by][bx]) hit = true;
      });
      return hit;
    }

    function rotate(shape) {
      var size = shape.length;
      var out = [];
      for (var y = 0; y < size; y++) {
        out.push([]);
        for (var x = 0; x < size; x++) out[y].push(shape[size - 1 - x][y]);
      }
      return out;
    }

    function tryRotate() {
      var turned = rotate(piece.shape);
      for (var i = 0; i < KICKS.length; i++) {
        if (!collides(turned, piece.x + KICKS[i], piece.y)) {
          piece.shape = turned;
          piece.x += KICKS[i];
          return;
        }
      }
    }

    function move(dx) {
      if (!collides(piece.shape, piece.x + dx, piece.y)) piece.x += dx;
    }

    function softDrop() {
      if (collides(piece.shape, piece.x, piece.y + 1)) {
        lock();
      } else {
        piece.y += 1;
        score += 1;
      }
    }

    function hardDrop() {
      while (!collides(piece.shape, piece.x, piece.y + 1)) {
        piece.y += 1;
        score += 2;
      }
      lock();
    }

    function ghostY() {
      var y = piece.y;
      while (!collides(piece.shape, piece.x, y + 1)) y += 1;
      return y;
    }

    function lock() {
      var toppedOut = false;
      eachCell(piece.shape, function (x, y) {
        var by = piece.y + y;
        if (by < 0) toppedOut = true;
        else board[by][piece.x + x] = piece.key;
      });
      if (toppedOut) return gameOver();

      clearLines();
      spawn();
    }

    function clearLines() {
      var cleared = 0;
      for (var y = H - 1; y >= 0; y--) {
        var full = board[y].every(function (cell) { return cell; });
        if (!full) continue;
        board.splice(y, 1);
        board.unshift(new Array(W).fill(null));
        cleared += 1;
        y += 1; // строки сдвинулись вниз — проверяем эту же позицию заново
      }
      if (!cleared) return;

      score += [0, 100, 300, 500, 800][cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      if (score > best) {
        best = score;
        writeFlag(BEST_KEY, best);
      }
      restartTimer();
    }

    function delay() {
      return Math.max(90, 800 - (level - 1) * 70);
    }

    function restartTimer() {
      if (state !== "run") return;
      clearInterval(timer);
      timer = setInterval(tick, delay());
    }

    function tick() {
      if (collides(piece.shape, piece.x, piece.y + 1)) lock();
      else piece.y += 1;
      draw();
    }

    /* ---------- отрисовка ---------- */

    function cellSpan(key, glyph) {
      return '<span class="kb-tet kb-tet--' + key + '">' + glyph + "</span>";
    }

    function draw() {
      var cells = board.map(function (row) { return row.slice(); });

      if (piece && state !== "over") {
        var gy = ghostY();
        eachCell(piece.shape, function (x, y) {
          var by = gy + y;
          if (by >= 0 && by < H && !cells[by][piece.x + x]) {
            cells[by][piece.x + x] = "ghost";
          }
        });
      }
      if (piece) {
        eachCell(piece.shape, function (x, y) {
          var by = piece.y + y;
          if (by >= 0 && by < H) cells[by][piece.x + x] = piece.key;
        });
      }

      var bar = new Array(W * 2 + 1).join("─");
      var out = ["┌" + bar + "┐"];
      for (var y = 0; y < H; y++) {
        var row = "│";
        for (var x = 0; x < W; x++) {
          var k = cells[y][x];
          if (!k) row += "· ";
          else if (k === "ghost") row += cellSpan("ghost", "▒▒");
          else row += cellSpan(k, "██");
        }
        out.push(row + "│");
      }
      out.push("└" + bar + "┘");
      screen.innerHTML = out.join("\n");

      drawNext();
      statEl.innerHTML =
        "score " + score + "\nbest  " + best + "\nlines " + lines + "\nlevel " + level;

      if (state === "over") {
        msgEl.textContent = "*** game over — счёт: " + score + " *** нажми R";
      } else if (state === "pause") {
        msgEl.textContent = "[пауза] — пробел или P продолжить";
      } else if (state === "idle") {
        msgEl.textContent = "нажми любую стрелку, чтобы начать";
      } else {
        msgEl.textContent = "";
      }
    }

    function drawNext() {
      var shape = SHAPES[nextKey];
      var rows = [];
      for (var y = 0; y < shape.length; y++) {
        var row = "";
        for (var x = 0; x < shape[y].length; x++) {
          row += shape[y][x] ? cellSpan(nextKey, "██") : "  ";
        }
        rows.push(row);
      }
      nextEl.innerHTML = rows.join("\n");
    }

    /* ---------- состояние ---------- */

    function reset() {
      board = [];
      for (var y = 0; y < H; y++) board.push(new Array(W).fill(null));
      score = 0;
      lines = 0;
      level = 1;
      bag = null;
      nextKey = null;
      state = "idle";
      clearInterval(timer);
      spawn();
      draw();
    }

    function start() {
      if (state === "run" || state === "over") return;
      state = "run";
      clearInterval(timer);
      timer = setInterval(tick, delay());
      draw();
    }

    function pause() {
      if (state !== "run") return;
      state = "pause";
      clearInterval(timer);
      draw();
    }

    function gameOver() {
      state = "over";
      clearInterval(timer);
      if (score > best) {
        best = score;
        writeFlag(BEST_KEY, best);
      }
    }

    /* ---------- управление ---------- */

    var MOVES = {
      arrowleft: "left", a: "left", "ф": "left",
      arrowright: "right", d: "right", "в": "right",
      arrowup: "rotate", w: "rotate", "ц": "rotate",
      arrowdown: "down", s: "down", "ы": "down"
    };

    function act(name) {
      if (state === "over") return;
      if (state === "idle" || state === "pause") start();
      if (name === "left") move(-1);
      else if (name === "right") move(1);
      else if (name === "rotate") tryRotate();
      else if (name === "down") softDrop();
      else if (name === "drop") hardDrop();
      draw();
    }

    function onKey(e) {
      if (root.hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      var k = e.key.toLowerCase();
      var move = MOVES[k];

      // Автоповтор годится только для движения вбок и мягкого спуска.
      // Зажатый пробел иначе ссыпал бы фигуры пачкой до game over,
      // а зажатая стрелка вверх крутила бы фигуру волчком.
      if (e.repeat && move !== "left" && move !== "right" && move !== "down") {
        e.preventDefault();
        return;
      }

      if (e.key === "Escape") {
        close();
      } else if (move) {
        act(move);
      } else if (e.key === " ") {
        if (state === "pause") start();
        else act("drop");
      } else if (k === "p" || k === "з") {
        if (state === "pause") start();
        else pause();
      } else if (k === "r" || k === "к") {
        reset();
      } else {
        return;
      }
      e.preventDefault();
      // Иначе стрелки уедут в терминал на главной, а «/» и «s» — в хоткеи Material
      e.stopPropagation();
    }

    function onVis() {
      if (document.hidden) pause();
    }

    /* ---------- открытие и закрытие ---------- */

    function open() {
      if (!root.hidden) return;
      // Отметку ставим здесь, а не при загрузке: иначе визит, закрытый
      // раньше, чем окно успело всплыть, считался бы показанным.
      writeFlag(SEEN_KEY, true);
      lastFocused = document.activeElement;
      root.hidden = false;
      document.body.classList.add("kb-modal-open");
      reset();
      dialog.focus({ preventScroll: true });
    }

    function close() {
      if (root.hidden) return;
      clearInterval(timer);
      state = "idle";
      root.hidden = true;
      document.body.classList.remove("kb-modal-open");
      if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
      lastFocused = null;
    }

    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-kb-close]")) {
        close();
        return;
      }
      var act_ = e.target.closest("[data-kb-act]");
      if (act_) {
        e.preventDefault();
        act(act_.dataset.kbAct);
      }
    });

    // capture, чтобы перехватить клавиши раньше терминала и хоткеев Material
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("visibilitychange", onVis);

    window.kbTetris = { open: open, close: close };

    // Первый визит: показываем сами. Если вкладку открыли в фоне —
    // ждём, пока на неё посмотрят, иначе визит сгорит вхолостую.
    if (!readFlag(SEEN_KEY)) {
      if (document.hidden) {
        document.addEventListener("visibilitychange", function onShow() {
          if (document.hidden) return;
          document.removeEventListener("visibilitychange", onShow);
          setTimeout(open, AUTO_OPEN_DELAY);
        });
      } else {
        setTimeout(open, AUTO_OPEN_DELAY);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
