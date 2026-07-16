/* Змейка в терминале — страница /snake/. Чистый JS, без зависимостей. */
(function () {
  "use strict";

  function init() {
    var root = document.getElementById("kb-snake");
    if (!root || root.dataset.kbInit) return;
    root.dataset.kbInit = "1";

    // При instant-навигации убираем хвосты прошлой игры
    if (window.__kbSnakeCleanup) window.__kbSnakeCleanup();

    var W = 26;
    var H = 14;
    var screen = root.querySelector("#kb-snake-screen");
    var scoreEl = root.querySelector("#kb-snake-score");
    var msgEl = root.querySelector("#kb-snake-msg");

    var snake, dir, nextDir, food, score, timer, delay, state; // idle | run | pause | over
    var best = parseInt(localStorage.getItem("kb-snake-best") || "0", 10);

    function rand(n) {
      return Math.floor(Math.random() * n);
    }

    function placeFood() {
      do {
        food = { x: rand(W), y: rand(H) };
      } while (snake.some(function (s) { return s.x === food.x && s.y === food.y; }));
    }

    function reset() {
      snake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }];
      dir = { x: 1, y: 0 };
      nextDir = dir;
      score = 0;
      delay = 140;
      state = "idle";
      clearInterval(timer);
      placeFood();
      draw();
    }

    function start() {
      if (state === "run") return;
      state = "run";
      clearInterval(timer);
      timer = setInterval(tick, delay);
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
      draw();
    }

    function tick() {
      dir = nextDir;
      var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      var hitWall = head.x < 0 || head.x >= W || head.y < 0 || head.y >= H;
      var hitSelf = snake.some(function (s) { return s.x === head.x && s.y === head.y; });
      if (hitWall || hitSelf) return gameOver();

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        if (score > best) {
          best = score;
          localStorage.setItem("kb-snake-best", String(best));
        }
        if (delay > 70) {
          delay -= 4;
          clearInterval(timer);
          timer = setInterval(tick, delay);
        }
        placeFood();
      } else {
        snake.pop();
      }
      draw();
    }

    function draw() {
      var grid = [];
      for (var y = 0; y < H; y++) {
        var row = [];
        for (var x = 0; x < W; x++) row.push(" ");
        grid.push(row);
      }
      grid[food.y][food.x] = '<span class="kb-snake__food">✱</span>';
      snake.forEach(function (s, i) {
        grid[s.y][s.x] = '<span class="kb-snake__body">' + (i === 0 ? "█" : "▓") + "</span>";
      });

      var bar = new Array(W + 1).join("─");
      var lines = ["┌" + bar + "┐"];
      grid.forEach(function (row) {
        lines.push("│" + row.join("") + "│");
      });
      lines.push("└" + bar + "┘");
      screen.innerHTML = lines.join("\n");

      scoreEl.textContent = "score: " + score + "   best: " + best + (state === "pause" ? "   [пауза]" : "");
      if (state === "over") {
        msgEl.textContent = "*** segmentation fault (core dumped) — счёт: " + score + " ***  нажми R";
      } else if (state === "idle") {
        msgEl.textContent = "нажми стрелку или W/A/S/D, чтобы начать";
      } else {
        msgEl.textContent = "";
      }
    }

    var KEYMAP = {
      arrowup: { x: 0, y: -1 }, arrowdown: { x: 0, y: 1 }, arrowleft: { x: -1, y: 0 }, arrowright: { x: 1, y: 0 },
      w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
      "ц": { x: 0, y: -1 }, "ы": { x: 0, y: 1 }, "ф": { x: -1, y: 0 }, "в": { x: 1, y: 0 }
    };

    function turn(nd) {
      // Разворот на 180° запрещён
      if (snake.length > 1 && nd.x === -dir.x && nd.y === -dir.y) return;
      nextDir = nd;
    }

    function onKey(e) {
      if (e.target && e.target.closest && e.target.closest("input, textarea")) return;
      var k = e.key.toLowerCase();
      if (KEYMAP[k]) {
        e.preventDefault();
        if (state === "over") return;
        turn(KEYMAP[k]);
        if (state !== "run") start();
      } else if (e.key === " ") {
        e.preventDefault();
        if (state === "run") pause();
        else if (state === "pause") start();
      } else if (k === "r" || k === "к") {
        e.preventDefault();
        reset();
      }
    }

    function onVis() {
      if (document.hidden) pause();
    }

    var tx = 0, ty = 0;
    function onTouchStart(e) {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
    }
    function onTouchEnd(e) {
      var dx = e.changedTouches[0].clientX - tx;
      var dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        if (state === "over") reset();
        else if (state !== "run") start();
        return;
      }
      turn(Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 });
      if (state === "idle" || state === "pause") start();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchend", onTouchEnd);

    window.__kbSnakeCleanup = function () {
      clearInterval(timer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      window.__kbSnakeCleanup = null;
    };

    reset();
  }

  if (typeof document$ !== "undefined") {
    document$.subscribe(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
