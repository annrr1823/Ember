(() => {
  "use strict";

  const CODE = "0120528";
  const ROUND_SECONDS = 2;
  const START_RATE = 63;
  const PENALTY = 21;

  const INTRO_LINES = [
    "Wait. George sent you?",
    "Unbelievable. He actually doesn't trust me. Seriously?",
    "Whatever. I guess I shouldn't be surprised.",
    "Look, I do need your help. And honestly, I have no idea how you managed to find your way here, but I'm not going to question it.",
    "That code you've got? It's the key to everything. If it's wrong, we're done. If it's right, we might actually get George out of here.",
    "Listen carefully. From this point on, things are going to move fast. Really fast.",
    (name) =>
      `I need you to stay sharp, ${name}. Follow my instructions, and don't waste a second.`,
    "Ready?",
    (name) => `Good. Stay with me, ${name}. Let's get George out.`,
  ];

  const WIN_SCRIPT = [
    { type: "countdown", from: 5, stopAt: 3, label: "EXTRACTION WINDOW", sub: "HOLD THE LINE" },
    { type: "line", speaker: "MAX", text: "George! Move, move, move!" },
    { type: "system", text: "CONNECTION LOST." },
    { type: "blackout", silence: 2000, shake: true },
    { type: "restore" },
    { type: "line", speaker: "MAX", text: "...Hello? You still there?" },
    { type: "line", speaker: "MAX", text: "Yeah. We're out." },
    { type: "line", speaker: "MAX", text: "George is safe." },
    {
      type: "line",
      speaker: "GEORGE",
      text: "Max, did you seriously make someone hack into the FIA just to prove you were right?",
    },
    { type: "line", speaker: "MAX", text: "Oh, come on. You're welcome, by the way." },
    { type: "line", speaker: "GEORGE", text: "I didn't say thank you." },
    { type: "line", speaker: "MAX", text: "Yeah, well. You will." },
    { type: "line", speaker: "MAX", text: (name) => `Alright. ${name}, good work.` },
    { type: "line", speaker: "MAX", text: "Couldn't have done it without you." },
    {
      type: "line",
      speaker: "GEORGE",
      text: "Max! Seriously? Is that how you thank someone who just saved our lives?",
    },
    { type: "line", speaker: "MAX", text: "What? I said she did a good job!" },
    {
      type: "line",
      speaker: "GEORGE",
      text: "Yeah, and you somehow made it sound like you were doing her a favor.",
    },
    {
      type: "line",
      speaker: "GEORGE",
      text: (name) => `Anyway, jokes aside... thank you, ${name}. Really.`,
    },
    {
      type: "line",
      speaker: "GEORGE",
      text: "I don't know how you found us, or how you managed to pull this off, but you gave us a way out when we had almost none left.",
    },
    { type: "line", speaker: "GEORGE", text: "We owe you one. Both of us." },
    { type: "line", speaker: "MAX", text: "...Yeah. What he said." },
    { type: "line", speaker: "GEORGE", text: "Was that so hard?" },
    { type: "line", speaker: "MAX", text: "Don't push it." },
    { type: "noise", level: "light" },
    {
      type: "line",
      speaker: "MAX",
      text: "One last thing. Do us a favor and forget you ever saw any of this.",
      corrupt: 0.12,
    },
    { type: "line", speaker: "GEORGE", text: "Max!", corrupt: 0.18 },
    { type: "line", speaker: "MAX", text: "What? It's classified!", corrupt: 0.22 },
    { type: "terminate-prompt" },
  ];

  const LOSE_SCRIPT = [
    { type: "countdown", from: 5, stopAt: 0, label: "EXTRACTION WINDOW", sub: "SIGNAL CRITICAL", failFlash: true },
    { type: "chaos" },
    { type: "line", speaker: "MAX", text: "No, no, no! What the hell happened?" },
    {
      type: "line",
      speaker: "MAX",
      text: "Fuck! Talk to me! Fuck! This fucking door is now fucking closing!",
    },
    { type: "noise-burst" },
    { type: "terminated" },
  ];

  const $ = (id) => document.getElementById(id);

  const stages = {
    boot: $("stage-boot"),
    intro: $("stage-intro"),
    dialogue: $("stage-dialogue"),
    game: $("stage-game"),
    countdown: $("stage-countdown"),
    blackout: $("stage-blackout"),
    final: $("stage-final"),
  };

  const els = {
    bootBtn: $("btn-boot"),
    introLog: $("intro-log"),
    namePanel: $("name-panel"),
    nameInput: $("player-name"),
    nameBtn: $("btn-name"),
    continueBtn: $("btn-continue"),
    dialogueChannel: $("dialogue-channel"),
    playerChip: $("player-chip"),
    dialogueSpeaker: $("dialogue-speaker"),
    dialogueText: $("dialogue-text"),
    nextLineBtn: $("btn-next-line"),
    terminateBtn: $("btn-terminate"),
    rateDisplay: $("rate-display"),
    codeTrack: $("code-track"),
    digitPos: $("digit-pos"),
    timerBar: $("timer-bar"),
    timerNum: $("timer-num"),
    keypad: $("keypad"),
    feedback: $("feedback"),
    countdownWrap: $("countdown-wrap"),
    countdownLabel: $("countdown-label"),
    countdownNum: $("countdown-num"),
    countdownSub: $("countdown-sub"),
    blackoutMsg: $("blackout-msg"),
    finalContent: $("final-content"),
    replayBtn: $("btn-replay"),
    fxFlash: $("fx-flash"),
  };

  const state = {
    playerName: "",
    mode: "intro", // intro | ending
    script: INTRO_LINES,
    lineIndex: 0,
    typing: false,
    typeTimer: null,
    fullLine: "",
    digitIndex: 0,
    rate: START_RATE,
    locked: false,
    roundRaf: null,
    roundEndsAt: 0,
    advancing: false,
    noiseLevel: 0,
  };

  function showStage(name) {
    Object.entries(stages).forEach(([key, el]) => {
      el.classList.toggle("stage--hidden", key !== name);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function formatTime(sec) {
    const s = Math.max(0, sec);
    return `00:${String(s).padStart(2, "0")}`;
  }

  function corruptText(text, intensity = 0.35) {
    const glyphs = "#@$%&*01░▒▓/?!";
    return [...text]
      .map((ch) => {
        if (ch === " " || ch === "\n" || Math.random() > intensity) return ch;
        return glyphs[(Math.random() * glyphs.length) | 0];
      })
      .join("");
  }

  function clearFx() {
    document.body.classList.remove("is-shaking", "is-blackout", "is-noisy");
    els.fxFlash.classList.remove("is-on", "is-chaos");
    state.noiseLevel = 0;
  }

  function appendCommLine(who, message, { glitchWho = false, corrupt = false } = {}) {
    const line = document.createElement("div");
    line.className = "comm-line";

    const whoEl = document.createElement("span");
    whoEl.className = "who" + (glitchWho ? " is-glitch" : "");
    whoEl.textContent = who;

    const msgEl = document.createElement("span");
    msgEl.className = "msg" + (corrupt ? " is-corrupt" : "");
    msgEl.textContent = message;

    line.append(whoEl, msgEl);
    els.introLog.appendChild(line);
    return msgEl;
  }

  async function typeInto(el, text, speed = 28) {
    el.textContent = "";
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      await sleep(speed + ((Math.random() * 18) | 0));
    }
  }

  async function runBootInterference() {
    clearFx();
    showStage("intro");
    els.introLog.innerHTML = "";
    els.namePanel.classList.add("stage--hidden");
    els.continueBtn.classList.add("stage--hidden");

    const ghost = appendCommLine("***", "", { glitchWho: true, corrupt: true });
    const burst = corruptText("████ SIGNAL BREACH ████ HANDSHAKE FAILED ████", 0.55);
    await typeInto(ghost, burst, 16);
    await sleep(420);

    const line2 = appendCommLine("***", "", { glitchWho: true, corrupt: true });
    await typeInto(line2, corruptText("who… are… y0u———", 0.5), 40);
    await sleep(500);

    const clear = appendCommLine("***", "", { glitchWho: true });
    clear.classList.remove("is-corrupt");
    await typeInto(clear, "Fuck, who the hell are you?", 32);

    els.namePanel.classList.remove("stage--hidden");
    els.nameInput.focus();
  }

  function resolveText(text) {
    return typeof text === "function" ? text(state.playerName) : text;
  }

  function clearTypeTimer() {
    if (state.typeTimer) {
      clearInterval(state.typeTimer);
      state.typeTimer = null;
    }
  }

  function setSpeaker(speaker) {
    const label = speaker || "MAX";
    els.dialogueSpeaker.textContent = label;
    els.dialogueSpeaker.classList.toggle("is-system", label === "SYSTEM" || label === "PLAYER TERMINAL");
    els.dialogueSpeaker.classList.toggle("is-george", label === "GEORGE");
    els.dialogueChannel.textContent =
      label === "GEORGE"
        ? "UPLINK · GEORGE"
        : label === "PLAYER TERMINAL" || label === "SYSTEM"
          ? "LOCAL TERMINAL"
          : "UPLINK · MAX";
  }

  function typeLine(text, { corrupt = 0 } = {}) {
    clearTypeTimer();
    const display = corrupt > 0 ? corruptText(text, corrupt) : text;
    state.fullLine = display;
    state.typing = true;
    els.dialogueText.innerHTML = "";
    els.nextLineBtn.disabled = false;

    let i = 0;
    const caret = document.createElement("span");
    caret.className = "caret";

    state.typeTimer = setInterval(() => {
      if (i >= display.length) {
        clearTypeTimer();
        state.typing = false;
        caret.remove();
        return;
      }
      els.dialogueText.append(document.createTextNode(display[i]));
      els.dialogueText.appendChild(caret);
      i += 1;
    }, 22);
  }

  function renderIntroLine() {
    const entry = INTRO_LINES[state.lineIndex];
    const text = resolveText(entry);
    setSpeaker("MAX");
    els.nextLineBtn.textContent =
      state.lineIndex >= INTRO_LINES.length - 1 ? "Begin Mission" : "Continue";
    els.nextLineBtn.classList.remove("stage--hidden");
    typeLine(text);
  }

  function skipOrAdvanceIntro() {
    if (state.typing) {
      clearTypeTimer();
      state.typing = false;
      els.dialogueText.textContent = state.fullLine;
      return;
    }

    state.lineIndex += 1;
    if (state.lineIndex >= INTRO_LINES.length) {
      startGame();
      return;
    }
    renderIntroLine();
  }

  async function runCountdown({ from, stopAt, label, sub, failFlash }) {
    showStage("countdown");
    els.nextLineBtn.classList.add("stage--hidden");
    els.countdownLabel.textContent = label;
    els.countdownSub.textContent = sub;
    els.countdownWrap.classList.remove("is-critical");
    els.fxFlash.classList.add("is-on");
    document.body.classList.add("is-shaking");

    for (let t = from; t >= stopAt; t--) {
      els.countdownNum.textContent = formatTime(t);
      if (t <= 5) els.countdownWrap.classList.add("is-critical");
      await sleep(t <= 5 ? 420 : 520);
    }

    if (failFlash) {
      els.fxFlash.classList.remove("is-on");
      els.fxFlash.classList.add("is-chaos");
      document.body.classList.add("is-shaking");
      await sleep(1600);
    } else {
      els.fxFlash.classList.remove("is-on");
      document.body.classList.remove("is-shaking");
      await sleep(350);
    }
  }

  async function runBlackout({ silence, shake }) {
    showStage("blackout");
    els.blackoutMsg.textContent = "CONNECTION LOST.";
    document.body.classList.add("is-blackout");
    if (shake) document.body.classList.add("is-shaking");
    els.fxFlash.classList.remove("is-on", "is-chaos");
    await sleep(silence);
    document.body.classList.remove("is-shaking");
  }

  async function runNoiseBurst() {
    showStage("dialogue");
    setSpeaker("MAX");
    els.nextLineBtn.classList.add("stage--hidden");
    document.body.classList.add("is-noisy", "is-shaking");
    els.fxFlash.classList.add("is-chaos");

    const bursts = [
      "F̷u̷c̷k̷——",
      "████ fuck ████ signal——",
      "f̸u̸c̸k̸ the door—— MAX?!",
      "FUCK—FUCK—NO——",
      "░▒▓ CONNECTION DEGRADING ▓▒░",
      corruptText("fuck... don't... close...", 0.55),
    ];

    for (const burst of bursts) {
      els.dialogueText.textContent = burst;
      await sleep(420 + ((Math.random() * 280) | 0));
    }

    await sleep(500);
    clearFx();
  }

  function showCredits() {
    clearFx();
    stages.dialogue.classList.remove("is-void");
    els.terminateBtn.classList.add("stage--hidden");
    els.terminateBtn.classList.remove("is-visible");
    showStage("final");
    els.finalContent.className = "final-screen is-credits";
    els.finalContent.innerHTML = `
      <p class="final-meta">AUTHOR NOTE</p>
      <h2 class="final-title">作者有话说</h2>
      <p class="final-body">
        感谢游玩！<br /><br />
        竟然真的有人会玩到这里吗？欢迎来1058350923这个qq群里面继续找我玩。<br />
        虽然最后这个小游戏有些过于简陋了但是我已经燃尽了，这段数字其实是他们的三次相同圈速里面的一个，不知道有没有人注意到哈哈。<br />
        最后给他们安排了一个好结局，不知道他俩逃出来以后准备干什么但是反正干坏事的坏蛋都要完蛋啦。<br />
        — RR
      </p>
    `;
    els.replayBtn.classList.add("stage--hidden");
  }

  async function showTerminatePrompt() {
    clearFx();
    showStage("dialogue");
    document.body.classList.remove("is-blackout", "is-noisy", "is-shaking");
    stages.dialogue.classList.add("is-void");
    els.dialogueSpeaker.textContent = "";
    els.dialogueText.textContent = "";
    els.nextLineBtn.classList.add("stage--hidden");
    els.terminateBtn.classList.remove("stage--hidden", "is-visible");
    await sleep(480);
    els.terminateBtn.classList.add("is-visible");
    els.terminateBtn.focus();
  }

  function showTerminated() {
    clearFx();
    showStage("final");
    els.finalContent.className = "final-screen is-terminated";
    els.finalContent.innerHTML = `
      <p class="final-meta">CARRIER DROP · 0%</p>
      <h2 class="final-title">COMMUNICATION TERMINATED</h2>
      <p class="final-body">
        No further packets received.<br />
        The channel is dead.
      </p>
    `;
    els.replayBtn.classList.add("stage--hidden");
  }

  async function playEndingStep() {
    if (state.advancing) return;
    state.advancing = true;

    try {
      while (state.lineIndex < state.script.length) {
        const step = state.script[state.lineIndex];

        if (step.type === "countdown") {
          await runCountdown(step);
          state.lineIndex += 1;
          continue;
        }

        if (step.type === "chaos") {
          els.fxFlash.classList.add("is-chaos");
          document.body.classList.add("is-shaking");
          await sleep(900);
          state.lineIndex += 1;
          continue;
        }

        if (step.type === "system") {
          showStage("dialogue");
          setSpeaker("PLAYER TERMINAL");
          els.nextLineBtn.classList.add("stage--hidden");
          typeLine(step.text);
          await waitTypingDone();
          await sleep(700);
          state.lineIndex += 1;
          continue;
        }

        if (step.type === "blackout") {
          await runBlackout(step);
          state.lineIndex += 1;
          continue;
        }

        if (step.type === "restore") {
          document.body.classList.remove("is-blackout", "is-shaking");
          showStage("dialogue");
          setSpeaker("MAX");
          els.dialogueText.textContent = "";
          els.nextLineBtn.classList.add("stage--hidden");
          await sleep(400);
          state.lineIndex += 1;
          continue;
        }

        if (step.type === "noise") {
          document.body.classList.add("is-noisy");
          state.noiseLevel = 1;
          state.lineIndex += 1;
          continue;
        }

        if (step.type === "noise-burst") {
          await runNoiseBurst();
          state.lineIndex += 1;
          continue;
        }

        if (step.type === "terminate-prompt") {
          await showTerminatePrompt();
          state.lineIndex += 1;
          return;
        }

        if (step.type === "terminated") {
          showTerminated();
          return;
        }

        if (step.type === "line") {
          showStage("dialogue");
          document.body.classList.remove("is-blackout");
          setSpeaker(step.speaker);
          els.nextLineBtn.textContent = "Continue";
          els.nextLineBtn.classList.remove("stage--hidden");
          typeLine(resolveText(step.text), { corrupt: step.corrupt || 0 });
          state.lineIndex += 1;
          return;
        }

        state.lineIndex += 1;
      }
    } finally {
      state.advancing = false;
    }
  }

  function waitTypingDone() {
    return new Promise((resolve) => {
      const check = () => {
        if (!state.typing) {
          resolve();
          return;
        }
        setTimeout(check, 40);
      };
      check();
    });
  }

  function skipOrAdvanceEnding() {
    if (state.advancing) return;

    if (state.typing) {
      clearTypeTimer();
      state.typing = false;
      els.dialogueText.textContent = state.fullLine;
      return;
    }

    playEndingStep();
  }

  function startEnding(won) {
    stopRoundTimer();
    clearTypeTimer();
    clearFx();
    stages.dialogue.classList.remove("is-void");
    els.terminateBtn.classList.add("stage--hidden");
    els.terminateBtn.classList.remove("is-visible");
    state.mode = "ending";
    state.script = won ? WIN_SCRIPT : LOSE_SCRIPT;
    state.lineIndex = 0;
    state.typing = false;
    state.advancing = false;
    els.replayBtn.classList.add("stage--hidden");
    els.playerChip.textContent = `OPERATIVE: ${state.playerName.toUpperCase()}`;
    playEndingStep();
  }

  function buildCodeTrack() {
    els.codeTrack.innerHTML = "";
    for (let i = 0; i < CODE.length; i++) {
      const slot = document.createElement("div");
      slot.className = "code-slot";
      slot.dataset.index = String(i);
      slot.textContent = "·";
      els.codeTrack.appendChild(slot);
    }
  }

  function updateRateUI() {
    els.rateDisplay.textContent = `Rescue Chance ${state.rate}%`;
    els.rateDisplay.classList.toggle("is-low", state.rate <= 27);
  }

  function buildKeypad() {
    els.keypad.innerHTML = "";
    for (let n = 0; n <= 9; n++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.textContent = String(n);
      btn.dataset.digit = String(n);
      btn.addEventListener("click", () => onDigitPick(String(n), btn));
      els.keypad.appendChild(btn);
    }
  }

  function setKeysEnabled(enabled) {
    els.keypad.querySelectorAll(".key").forEach((btn) => {
      btn.disabled = !enabled;
      btn.classList.remove("is-correct", "is-miss");
    });
  }

  function stopRoundTimer() {
    if (state.roundRaf) {
      cancelAnimationFrame(state.roundRaf);
      state.roundRaf = null;
    }
  }

  function startRoundTimer() {
    stopRoundTimer();
    state.roundEndsAt = performance.now() + ROUND_SECONDS * 1000;
    els.timerBar.classList.remove("is-critical");
    els.timerBar.style.transform = "scaleX(1)";

    const tick = (now) => {
      const left = Math.max(0, state.roundEndsAt - now);
      const ratio = left / (ROUND_SECONDS * 1000);
      els.timerBar.style.transform = `scaleX(${ratio})`;
      els.timerNum.textContent = (left / 1000).toFixed(1);
      if (ratio < 0.35) els.timerBar.classList.add("is-critical");

      if (left <= 0) {
        onTimeout();
        return;
      }
      state.roundRaf = requestAnimationFrame(tick);
    };

    state.roundRaf = requestAnimationFrame(tick);
  }

  function highlightActiveSlot() {
    els.codeTrack.querySelectorAll(".code-slot").forEach((slot, i) => {
      slot.classList.toggle(
        "is-active",
        i === state.digitIndex && !slot.classList.contains("is-filled")
      );
    });
    els.digitPos.textContent = String(state.digitIndex + 1);
  }

  function startGame() {
    state.mode = "game";
    state.digitIndex = 0;
    state.rate = START_RATE;
    state.locked = false;
    clearFx();
    showStage("game");
    buildCodeTrack();
    buildKeypad();
    updateRateUI();
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    beginRound();
  }

  function beginRound() {
    state.locked = false;
    setKeysEnabled(true);
    highlightActiveSlot();
    els.feedback.textContent = "Syncing… select the correct digit";
    els.feedback.className = "feedback";
    startRoundTimer();
  }

  function applyPenalty(reason) {
    state.rate = Math.max(0, state.rate - PENALTY);
    updateRateUI();
    els.feedback.textContent = `${reason} · Chance -${PENALTY}%`;
    els.feedback.className = "feedback is-bad";

    const active = els.codeTrack.children[state.digitIndex];
    if (active) {
      active.classList.add("is-wrong-flash");
      setTimeout(() => active.classList.remove("is-wrong-flash"), 400);
    }

    if (state.rate <= 0) {
      stopRoundTimer();
      setKeysEnabled(false);
      setTimeout(() => startEnding(false), 700);
      return true;
    }
    return false;
  }

  function onTimeout() {
    if (state.locked) return;
    state.locked = true;
    stopRoundTimer();
    setKeysEnabled(false);
    const failed = applyPenalty("Signal timeout");
    if (!failed) {
      setTimeout(() => {
        state.locked = false;
        beginRound();
      }, 650);
    }
  }

  function onDigitPick(digit, btn) {
    if (state.locked) return;
    state.locked = true;
    stopRoundTimer();
    setKeysEnabled(false);

    const expected = CODE[state.digitIndex];
    if (digit === expected) {
      btn.classList.add("is-correct");
      const slot = els.codeTrack.children[state.digitIndex];
      slot.textContent = digit;
      slot.classList.add("is-filled");
      slot.classList.remove("is-active");
      els.feedback.textContent = "Checksum OK";
      els.feedback.className = "feedback is-good";

      state.digitIndex += 1;
      if (state.digitIndex >= CODE.length) {
        setTimeout(() => startEnding(true), 700);
        return;
      }
      setTimeout(() => beginRound(), 480);
      return;
    }

    btn.classList.add("is-miss");
    const failed = applyPenalty("Wrong digit");
    if (!failed) {
      setTimeout(() => beginRound(), 650);
    }
  }

  function submitName() {
    const name = els.nameInput.value.trim();
    if (!name) {
      els.nameInput.focus();
      els.nameInput.style.borderColor = "var(--fail)";
      setTimeout(() => {
        els.nameInput.style.borderColor = "";
      }, 500);
      return;
    }

    state.playerName = name.slice(0, 14);
    els.namePanel.classList.add("stage--hidden");

    const confirm = appendCommLine("***", "");
    typeInto(confirm, `…${state.playerName}? Hold on.`, 30).then(async () => {
      await sleep(400);
      const reveal = appendCommLine("Max", "");
      await typeInto(reveal, `Alright, ${state.playerName}. Channel's clearer now.`, 28);
      els.continueBtn.classList.remove("stage--hidden");
      els.continueBtn.focus();
    });
  }

  function enterDialogue() {
    state.mode = "intro";
    state.lineIndex = 0;
    els.playerChip.textContent = `OPERATIVE: ${state.playerName.toUpperCase()}`;
    showStage("dialogue");
    renderIntroLine();
  }

  function onDialogueAdvance() {
    if (state.mode === "ending") {
      skipOrAdvanceEnding();
      return;
    }
    skipOrAdvanceIntro();
  }

  function resetAll() {
    stopRoundTimer();
    clearTypeTimer();
    clearFx();
    state.playerName = "";
    state.mode = "intro";
    state.lineIndex = 0;
    state.digitIndex = 0;
    state.rate = START_RATE;
    state.locked = false;
    state.advancing = false;
    els.nameInput.value = "";
    els.introLog.innerHTML = "";
    els.replayBtn.classList.add("stage--hidden");
    els.nextLineBtn.classList.remove("stage--hidden");
    els.terminateBtn.classList.add("stage--hidden");
    els.terminateBtn.classList.remove("is-visible");
    stages.dialogue.classList.remove("is-void");
    showStage("boot");
  }

  els.bootBtn.addEventListener("click", () => {
    runBootInterference();
  });

  els.nameBtn.addEventListener("click", submitName);
  els.nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitName();
  });

  els.continueBtn.addEventListener("click", enterDialogue);
  els.nextLineBtn.addEventListener("click", onDialogueAdvance);

  document.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    if (stages.dialogue.classList.contains("stage--hidden")) return;
    if (els.nextLineBtn.classList.contains("stage--hidden")) return;
    e.preventDefault();
    onDialogueAdvance();
  });

  els.replayBtn.addEventListener("click", resetAll);
  els.terminateBtn.addEventListener("click", () => {
    showCredits();
  });
})();
