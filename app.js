(() => {
  "use strict";

  const STORAGE_KEY = "parking-session-v1";

  // ---------- DOM ----------
  const setupScreen = document.getElementById("setup-screen");
  const sessionScreen = document.getElementById("session-screen");
  const setupForm = document.getElementById("setup-form");
  const endTimeInput = document.getElementById("f-end-time");
  const vehiclePresetSelect = document.getElementById("f-vehicle-preset");
  const locationNameInput = document.getElementById("f-location-name");
  const locationIdInput = document.getElementById("f-location-id");
  const plateInput = document.getElementById("f-plate");
  const vehicleInput = document.getElementById("f-vehicle");

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

  // ---------- Vehicle presets ----------
  const VEHICLE_PRESETS = {
    tacoma: {
      locationName: "Imperial Parking",
      locationId: "28650",
      plate: "BTN23G",
      vehicle: "White Toyota Tacoma 2013",
    },
    impreza: {
      locationName: "Imperial Parking",
      locationId: "28650",
      plate: "AJL31H",
      vehicle: "Gray Subaru Impreza 2019",
    },
    sportage: {
      locationName: "Imperial Parking",
      locationId: "28650",
      plate: "CCYE378",
      vehicle: "Black Kia Sportage 2024",
    },
    crv: {
      locationName: "Imperial Parking",
      locationId: "28650",
      plate: "K23PEV",
      vehicle: "Gray Honda CR-V Touring AWD",
    },
    mustang: {
      locationName: "Imperial Parking",
      locationId: "28650",
      plate: "XXXXX",
      vehicle: "Black Ford Mustang",
    },
  };

  function applyVehiclePreset(key) {
    const preset = VEHICLE_PRESETS[key];
    if (!preset) return;
    locationNameInput.value = preset.locationName;
    locationIdInput.value = preset.locationId;
    plateInput.value = preset.plate;
    vehicleInput.value = preset.vehicle;
  }

  vehiclePresetSelect.addEventListener("change", () => {
    applyVehiclePreset(vehiclePresetSelect.value);
  });

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

  // Given a "HH:MM" time-of-day string, returns today's timestamp at that time.
  function computeEndTime(timeStr, now) {
    const [h, m] = timeStr.split(":").map(Number);
    const end = new Date(now);
    end.setHours(h, m, 0, 0);
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
    const dayLabel = "today";
    dExpires.textContent = `Expires ${dayLabel}, ${formatClockTime(session.endTime)}`;
    dDuration.textContent = "Parking for 9h";

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

  // ---------- Reminders (toggle kept in UI; notifications disabled) ----------
  function updatePermissionNote() {
    permissionNote.textContent = "";
  }

  reminderToggle.addEventListener("change", () => {
    const session = loadSession();
    if (!session) return;

    session.remindersOn = reminderToggle.checked;
    saveSession(session);
    updatePermissionNote();
    scheduleReminder(session);
  });

  function scheduleReminder(session) {
    // Notifications are disabled; toggle state is still saved above, but no
    // browser/phone notification is requested or fired.
    if (reminderTimeoutHandle) clearTimeout(reminderTimeoutHandle);
  }

  function notifyExpired() {
    // Notifications are disabled; intentionally a no-op.
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
    applyVehiclePreset(vehiclePresetSelect.value);
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
