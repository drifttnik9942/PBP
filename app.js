(() => {
  "use strict";

  const STORAGE_KEY = "parking-session-v1";

  // ---------- DOM ----------
  const setupScreen = document.getElementById("setup-screen");
  const sessionScreen = document.getElementById("session-screen");
  const setupForm = document.getElementById("setup-form");
  const endTimeInput = document.getElementById("f-end-time");

  const sessionTitle = document.getElementById("session-title");
  const countdownBox = document.getElementById("countdown-box");
  const cHours = document.getElementById("c-hours");
  const cMinutes = document.getElementById("c-minutes");
  const cSeconds = document.getElementById("c-seconds");

  const dLocationId = document.getElementById("d-location-id");
  const dLocationName = document.getElementById("d-location-name");
  const dPlate = document.getElementById("d-plate");
  const dVehicle = document.getElementById("d-vehicle");
  const dExpires = document.getElementById("d-expires");
  const dDuration = document.getElementById("d-duration");

  const reminderToggle = document.getElementById("reminder-toggle");
  const permissionNote = document.getElementById("permission-note");

  const btnClose = document.getElementById("btn-close");
  const btnExtend = document.getElementById("btn-extend");
  const extendPanel = document.getElementById("extend-panel");

  let tickHandle = null;
  let reminderTimeoutHandle = null;

  // ---------- Storage ----------
  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ---------- Helpers ----------
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatClockTime(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${pad(m)} ${ampm}`;
  }

  function isSameDay(ts, ref) {
    const a = new Date(ts), b = new Date(ref);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function formatDuration(mins) {
    if (mins < 60) return `Parking for ${mins} mins`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `Parking for ${h} hr${h > 1 ? "s" : ""}`;
    return `Parking for ${h}h ${m}m`;
  }

  // ---------- Screens ----------
  function showSetup() {
    setupScreen.classList.add("active");
    sessionScreen.classList.remove("active");
  }

  function showSession() {
    sessionScreen.classList.add("active");
    setupScreen.classList.remove("active");
  }

  // ---------- Start session ----------
  setupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const locationName = document.getElementById("f-location-name").value.trim();
    const locationId = document.getElementById("f-location-id").value.trim();
    const plate = document.getElementById("f-plate").value.trim().toUpperCase();
    const vehicle = document.getElementById("f-vehicle").value.trim();

    const now = Date.now();
    const endTime = computeEndTime(endTimeInput.value, now);
    const durationMinutes = Math.max(1, Math.round((endTime - now) / 60000));

    const session = {
      locationName,
      locationId,
      plate,
      vehicle,
      durationMinutes,
      startTime: now,
      endTime,
      remindersOn: false,
    };
    saveSession(session);
    setupForm.reset();
    endTimeInput.value = "15:40";
    renderSession(session);
    showSession();
  });

  // Given a "HH:MM" time-of-day string, returns the next timestamp matching
  // that time (today if it's still ahead, otherwise tomorrow).
  function computeEndTime(timeStr, now) {
    const [h, m] = timeStr.split(":").map(Number);
    const end = new Date(now);
    end.setHours(h, m, 0, 0);
    if (end.getTime() <= now) {
      end.setDate(end.getDate() + 1);
    }
    return end.getTime();
  }

  // ---------- Render session details ----------
  function renderSession(session) {
    sessionTitle.textContent = session.locationName || "Parking";
    dLocationId.textContent = session.locationId || "\u2014";
    dLocationName.textContent = session.locationName || "";
    dPlate.textContent = session.plate || "\u2014";
    dVehicle.textContent = session.vehicle || "";

    const now = Date.now();
    const dayLabel = isSameDay(session.endTime, now) ? "today" : new Date(session.endTime).toLocaleDateString(undefined, { weekday: "long" });
    dExpires.textContent = `Expires ${dayLabel}, ${formatClockTime(session.endTime)}`;
    dDuration.textContent = formatDuration(session.durationMinutes);

    reminderToggle.checked = !!session.remindersOn;
    updatePermissionNote();

    startTicking(session);
    scheduleReminder(session);
  }

  // ---------- Countdown ticking ----------
  function startTicking(session) {
    if (tickHandle) clearInterval(tickHandle);

    function tick() {
      const remainingMs = session.endTime - Date.now();
      if (remainingMs <= 0) {
        cHours.textContent = "0";
        cMinutes.textContent = "00";
        cSeconds.textContent = "00";
        countdownBox.classList.add("is-expiring");
        clearInterval(tickHandle);
        notifyExpired();
        return;
      }
      const totalSeconds = Math.floor(remainingMs / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      cHours.textContent = String(h);
      cMinutes.textContent = pad(m);
      cSeconds.textContent = pad(s);
      countdownBox.classList.toggle("is-expiring", remainingMs <= 5 * 60 * 1000);
    }

    tick();
    tickHandle = setInterval(tick, 1000);
  }

  // ---------- Reminders (local notifications, no SMS/server) ----------
  function updatePermissionNote() {
    if (!("Notification" in window)) {
      permissionNote.textContent = "Notifications aren't supported in this browser.";
      return;
    }
    if (reminderToggle.checked && Notification.permission === "denied") {
      permissionNote.textContent = "Notifications are blocked for this site in your browser settings.";
    } else {
      permissionNote.textContent = "";
    }
  }

  reminderToggle.addEventListener("change", async () => {
    const session = loadSession();
    if (!session) return;

    if (reminderToggle.checked && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        reminderToggle.checked = false;
      }
    }
    session.remindersOn = reminderToggle.checked;
    saveSession(session);
    updatePermissionNote();
    scheduleReminder(session);
  });

  function scheduleReminder(session) {
    if (reminderTimeoutHandle) clearTimeout(reminderTimeoutHandle);
    if (!session.remindersOn) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const REMINDER_LEAD_MS = 5 * 60 * 1000; // 5 minutes before expiry
    const fireAt = session.endTime - REMINDER_LEAD_MS;
    const delay = fireAt - Date.now();

    if (delay <= 0) return; // too late for a lead-time reminder

    reminderTimeoutHandle = setTimeout(() => {
      new Notification("Parking expiring soon", {
        body: `${session.locationName || "Your session"} expires at ${formatClockTime(session.endTime)}.`,
        icon: "icons/icon-192.png",
      });
    }, delay);
  }

  function notifyExpired() {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Parking session expired", {
        body: "Your parking session has ended.",
        icon: "icons/icon-192.png",
      });
    }
  }

  // ---------- Extend ----------
  btnExtend.addEventListener("click", () => {
    extendPanel.hidden = !extendPanel.hidden;
  });

  extendPanel.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip[data-add]");
    if (!btn) return;
    const session = loadSession();
    if (!session) return;
    const addMinutes = Number(btn.dataset.add);
    session.endTime += addMinutes * 60 * 1000;
    session.durationMinutes += addMinutes;
    saveSession(session);
    renderSession(session);
    extendPanel.hidden = true;
  });

  // ---------- Close / end session ----------
  btnClose.addEventListener("click", () => {
    const ok = window.confirm("End this parking session? This can't be undone.");
    if (!ok) return;
    if (tickHandle) clearInterval(tickHandle);
    if (reminderTimeoutHandle) clearTimeout(reminderTimeoutHandle);
    clearSession();
    showSetup();
  });

  // ---------- Boot ----------
  function boot() {
    const existing = loadSession();
    if (existing) {
      renderSession(existing);
      showSession();
    } else {
      showSetup();
    }
  }

  boot();

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        /* offline support just won't be available */
      });
    });
  }
})();
