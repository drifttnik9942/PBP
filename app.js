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

  const endTimeSheet = document.getElementById("end-time-sheet");
  const sheetBackdrop = document.getElementById("sheet-backdrop");
  const sheetPanel = document.getElementById("sheet-panel");
  const sheetHandle = document.getElementById("sheet-handle");
  const btnSheetClose = document.getElementById("btn-sheet-close");
  const wheelDateEl = document.getElementById("wheel-date");
  const wheelHourEl = document.getElementById("wheel-hour");
  const wheelMinuteEl = document.getElementById("wheel-minute");
  const wheelAmpmEl = document.getElementById("wheel-ampm");
  const btnConfirmEndTime = document.getElementById("btn-confirm-end-time");

  const WHEEL_ITEM_HEIGHT = 32;
  const WHEEL_VISIBLE_ROWS = 7; // must match .wheel-picker / .wheel-col height (224px)

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
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `Parking for ${m} min${m !== 1 ? "s" : ""}`;
    if (m === 0) return `Parking for ${h} hr${h !== 1 ? "s" : ""}`;
    return `Parking for ${h} hr${h !== 1 ? "s" : ""} ${m} min${m !== 1 ? "s" : ""}`;
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
      remindersOn: true,
    };
    saveSession(session);
    setupForm.reset();
    endTimeInput.value = "00:00";
    renderSession(session);
    showSession();
  });

  // Given a "HH:MM" time-of-day string, returns today's timestamp at that time.
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
    const dayLabel = isSameDay(session.endTime, now) ? "Today" : "Tomorrow";
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

  // ---------- Set end time sheet ----------
  function formatDateLabel(d) {
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const month = d.toLocaleDateString(undefined, { month: "short" });
    return `${weekday}, ${month} ${d.getDate()}`;
  }

  function buildWheelColumn(container, items, renderLabel) {
    container.innerHTML = "";
    const topPad = document.createElement("div");
    topPad.className = "wheel-pad";
    container.appendChild(topPad);

    items.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "wheel-item";
      el.dataset.index = String(i);
      el.textContent = renderLabel(item);
      container.appendChild(el);
    });

    const bottomPad = document.createElement("div");
    bottomPad.className = "wheel-pad";
    container.appendChild(bottomPad);
  }

  function getWheelSelectedIndex(container) {
    const raw = container.scrollTop / WHEEL_ITEM_HEIGHT;
    return Math.max(0, Math.min(container.children.length - 3, Math.round(raw)));
  }

  function setWheelSelectedIndex(container, index) {
    container.scrollTop = index * WHEEL_ITEM_HEIGHT;
  }

  function applyWheelVisuals(container) {
    const rawIndex = container.scrollTop / WHEEL_ITEM_HEIGHT;
    const selectedIndex = Math.round(rawIndex);
    container.querySelectorAll(".wheel-item").forEach((el) => {
      const i = Number(el.dataset.index);
      const delta = i - rawIndex;
      const angle = Math.max(-78, Math.min(78, delta * 30)); // curves like a rotating wheel
      const opacity = Math.max(0.3, 1 - Math.min(1, Math.abs(delta) * 0.2));
      el.style.transform = `rotateX(${angle}deg)`;
      el.style.opacity = String(opacity);
      el.classList.toggle("is-selected", i === selectedIndex);
    });
  }

  let sheetDateItems = [];
  const HOUR_BASE = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
  const MINUTE_BASE = Array.from({ length: 60 }, (_, i) => i); // 0-59
  const HOUR_REPEATS = 21;
  const MINUTE_REPEATS = 21;

  function buildLoopedValues(base, repeats) {
    const out = [];
    for (let r = 0; r < repeats; r++) out.push(...base);
    return out;
  }

  // Repeated many times over so scrolling past 12 continues into 1 (and
  // scrolling above 1 continues into 12), simulating an endless wheel.
  const sheetHourItems = buildLoopedValues(HOUR_BASE, HOUR_REPEATS);
  const sheetMinuteItems = buildLoopedValues(MINUTE_BASE, MINUTE_REPEATS);
  const sheetAmpmItems = ["AM", "PM"];

  function getWheelSelection() {
    const dateItem = sheetDateItems[getWheelSelectedIndex(wheelDateEl)];
    const hour12 = sheetHourItems[getWheelSelectedIndex(wheelHourEl)];
    const minute = sheetMinuteItems[getWheelSelectedIndex(wheelMinuteEl)];
    const ampm = sheetAmpmItems[getWheelSelectedIndex(wheelAmpmEl)];
    if (!dateItem) return null;

    let hour24 = hour12 % 12;
    if (ampm === "PM") hour24 += 12;

    const d = new Date(dateItem.year, dateItem.month, dateItem.date, hour24, minute, 0, 0);
    return d.getTime();
  }

  function updateConfirmButtonState() {
    const session = loadSession();
    const candidate = getWheelSelection();
    const isActive = !!session && candidate != null && candidate > session.endTime;
    btnConfirmEndTime.disabled = !isActive;
    btnConfirmEndTime.classList.toggle("is-active", isActive);
  }

  [wheelDateEl, wheelHourEl, wheelMinuteEl, wheelAmpmEl].forEach((col) => {
    let scrollTimeout = null;
    col.addEventListener("scroll", () => {
      // Live, every-frame update so the curvature tracks the finger/drag smoothly.
      applyWheelVisuals(col);
      // Heavier check (reads storage) only once scrolling settles.
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateConfirmButtonState, 80);
    });
  });

  function openEndTimeSheet() {
    const session = loadSession();
    if (!session) return;

    // Show the sheet first so the wheel columns have real layout before we
    // set their scrollTop — assigning scrollTop while display:none is a no-op.
    sheetPanel.style.transition = "";
    sheetPanel.style.transform = "";
    endTimeSheet.hidden = false;

    const endDate = new Date(session.endTime);

    // Build the date column starting from the day the parking currently
    // ends (not today) — you can only extend forward from there, and the
    // first option should be exactly the day/time it's set to end.
    sheetDateItems = [];
    const base = new Date(session.endTime);
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      sheetDateItems.push({ year: d.getFullYear(), month: d.getMonth(), date: d.getDate(), label: formatDateLabel(d) });
    }
    buildWheelColumn(wheelDateEl, sheetDateItems, (item) => item.label);
    buildWheelColumn(wheelHourEl, sheetHourItems, (h) => pad(h));
    buildWheelColumn(wheelMinuteEl, sheetMinuteItems, (m) => pad(m));
    buildWheelColumn(wheelAmpmEl, sheetAmpmItems, (v) => v);

    // Position wheels to match the current end time.
    const dateIndex = sheetDateItems.findIndex(
      (item) => item.year === endDate.getFullYear() && item.month === endDate.getMonth() && item.date === endDate.getDate()
    );
    let hour24 = endDate.getHours();
    const ampm = hour24 >= 12 ? "PM" : "AM";
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;

    setWheelSelectedIndex(wheelDateEl, Math.max(0, dateIndex));
    const hourMiddleRepeat = Math.floor(HOUR_REPEATS / 2);
    const minuteMiddleRepeat = Math.floor(MINUTE_REPEATS / 2);
    setWheelSelectedIndex(wheelHourEl, hourMiddleRepeat * HOUR_BASE.length + HOUR_BASE.indexOf(hour12));
    setWheelSelectedIndex(wheelMinuteEl, minuteMiddleRepeat * MINUTE_BASE.length + MINUTE_BASE.indexOf(endDate.getMinutes()));
    setWheelSelectedIndex(wheelAmpmEl, sheetAmpmItems.indexOf(ampm));

    [wheelDateEl, wheelHourEl, wheelMinuteEl, wheelAmpmEl].forEach(applyWheelVisuals);
    updateConfirmButtonState();
  }

  function closeEndTimeSheet() {
    endTimeSheet.hidden = true;
  }

  btnExtend.addEventListener("click", openEndTimeSheet);
  btnSheetClose.addEventListener("click", closeEndTimeSheet);
  sheetBackdrop.addEventListener("click", closeEndTimeSheet);

  // Drag handle: tap to close, or swipe down to dismiss.
  (function setupHandleDrag() {
    const DISMISS_THRESHOLD = 70; // px dragged down before it counts as a dismiss
    let dragging = false;
    let startY = 0;
    let currentY = 0;
    let moved = false;

    sheetHandle.addEventListener("pointerdown", (e) => {
      dragging = true;
      moved = false;
      startY = e.clientY;
      currentY = 0;
      sheetPanel.style.transition = "none";
      sheetHandle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    sheetHandle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      currentY = Math.max(0, e.clientY - startY);
      if (currentY > 3) moved = true;
      sheetPanel.style.transform = `translateY(${currentY}px)`;
      e.preventDefault();
    });

    function endDrag(dismiss) {
      if (!dragging) return;
      dragging = false;
      sheetPanel.style.transition = "transform 0.25s ease";
      if (dismiss) {
        closeEndTimeSheet();
      }
      sheetPanel.style.transform = "";
    }

    sheetHandle.addEventListener("pointerup", (e) => {
      const wasTap = !moved;
      const shouldDismiss = wasTap || currentY > DISMISS_THRESHOLD;
      endDrag(shouldDismiss);
      e.preventDefault();
    });
    sheetHandle.addEventListener("pointercancel", () => endDrag(false));
  })();

  btnConfirmEndTime.addEventListener("click", () => {
    if (btnConfirmEndTime.disabled) return;
    const session = loadSession();
    if (!session) return;
    const candidate = getWheelSelection();
    if (candidate == null || candidate <= session.endTime) return;

    session.endTime = candidate;
    session.durationMinutes = Math.max(1, Math.round((candidate - session.startTime) / 60000));
    saveSession(session);
    renderSession(session);
    closeEndTimeSheet();
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
