"use strict";

const planningBoard = el("planning-board");
const planStorageKey = "side-by-side:weekly-plans:v1";
const weekFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const planDrafts = new Map();
const planEditors = boardNames.map(createPlanEditor);

let currentPlanningWeek = sundayFor(currentBoardDate());
let planningWeek = currentPlanningWeek;
let planReadId = 0;

function sundayFor(date) {
  return shiftDate(date, -asCalendarDate(date).getUTCDay());
}

function draftsFor(week) {
  if (!planDrafts.has(week)) {
    planDrafts.set(week, boardNames.map(() => ({
      loaded: false, notes: "", savedNotes: "", revision: null,
      saving: false, conflict: null, message: "",
    })));
  }
  return planDrafts.get(week);
}

function createPlanEditor(name, index) {
  const panel = node("section", "panel planning-panel");
  const slot = index + 1;
  panel.dataset.slot = slot;
  const heading = node("div", "panel-heading");
  const avatar = node("span", "avatar", Array.from(name)[0]);
  avatar.setAttribute("aria-hidden", "true");
  const title = node("h3", "", name);
  title.id = "planning-name-" + slot;
  const person = node("div", "person");
  person.append(title);
  panel.setAttribute("aria-labelledby", title.id);
  heading.append(avatar, person);

  const form = node("form", "planning-form");
  const label = node("label", "field", "Planning notes");
  const input = node("textarea");
  input.rows = 7;
  input.maxLength = 6000;
  input.placeholder = "Add plans for the week…";
  label.append(input);
  const actions = node("div", "planning-actions");
  const status = node("p", "planning-status");
  status.setAttribute("aria-live", "polite");
  const latest = node("button", "secondary button", "Load latest");
  latest.type = "button";
  latest.hidden = true;
  const save = node("button", "planning-save button", "Save notes");
  save.type = "submit";
  actions.append(status, latest, save);
  form.append(label, actions);
  panel.append(heading, form);
  el("planning-columns").append(panel);

  input.addEventListener("input", () => {
    const draft = draftsFor(planningWeek)[index];
    draft.notes = input.value;
    draft.message = "";
    renderPlanEditor(index);
  });
  latest.addEventListener("click", () => {
    const draft = draftsFor(planningWeek)[index];
    adoptPlan(draft, draft.conflict);
    draft.message = "Latest notes loaded.";
    renderPlanEditor(index);
    input.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    savePlan(index);
  });

  return { input, status, latest, save };
}

function renderPlanEditor(index) {
  const { input, status, latest, save } = planEditors[index];
  const draft = draftsFor(planningWeek)[index];
  const dirty = draft.notes !== draft.savedNotes;
  if (input.value !== draft.notes) input.value = draft.notes;
  input.disabled = !draft.loaded || draft.saving;
  save.disabled = !draft.loaded || draft.saving || !dirty || Boolean(draft.conflict);
  latest.hidden = !draft.conflict;
  status.textContent = draft.conflict ? "Notes changed elsewhere. Load the latest to continue."
    : draft.saving ? "Saving…"
    : draft.message || (dirty ? "Unsaved changes" : "");
}

function adoptPlan(draft, row) {
  draft.loaded = true;
  draft.notes = draft.savedNotes = row?.notes ?? "";
  draft.revision = row?.revision ?? null;
  draft.conflict = null;
}

function localPlans() {
  return JSON.parse(localStorage.getItem(planStorageKey) || "[]");
}

function readPlans(week) {
  if (demoMode) return localPlans().filter((row) => row.week_start === week);
  return requestBoardRows("weekly_plans", {
    select: "owner_slot,notes,revision", week_start: "eq." + week,
  });
}

async function refreshPlans() {
  const week = planningWeek;
  const request = ++planReadId;
  try {
    const rows = await readPlans(week);
    if (request !== planReadId) return;
    for (const [index, draft] of draftsFor(week).entries()) {
      if (draft.saving) continue;
      const row = rows.find((item) => item.owner_slot === index + 1);
      if (draft.notes === draft.savedNotes) {
        adoptPlan(draft, row);
      } else if (draft.notes === row?.notes) {
        adoptPlan(draft, row);
        draft.message = "Notes saved.";
      } else if (draft.revision !== (row?.revision ?? null)) {
        draft.conflict = row ?? { notes: "", revision: null };
      }
      renderPlanEditor(index);
    }
    el("planning-error").hidden = true;
  } catch {
    if (request === planReadId) el("planning-error").hidden = false;
  }
}

async function writePlan(week, slot, previous, data) {
  const row = { week_start: week, owner_slot: slot, ...data };
  if (demoMode) {
    const records = localPlans();
    const matching = records.findIndex((item) => item.week_start === week && item.owner_slot === slot);
    if ((records[matching]?.revision ?? null) !== previous) return false;
    if (matching === -1) records.push(row);
    else records[matching] = row;
    localStorage.setItem(planStorageKey, JSON.stringify(records));
    return true;
  }

  if (previous === null) {
    try {
      await requestBoardRows("weekly_plans", {}, { method: "POST", data: row });
      return true;
    } catch (error) {
      if (error.code === "23505") return false;
      throw error;
    }
  }

  const updated = await requestBoardRows("weekly_plans", {
    week_start: "eq." + week, owner_slot: "eq." + slot, revision: "eq." + previous, select: "revision",
  }, { method: "PATCH", data, returnRows: true });
  return updated.length > 0;
}

async function savePlan(index) {
  const week = planningWeek;
  const draft = draftsFor(week)[index];
  if (!draft.loaded || draft.saving || draft.conflict || draft.notes === draft.savedNotes) return;
  const data = { notes: draft.notes, revision: crypto.randomUUID() };
  draft.saving = true;
  draft.message = "";
  renderPlanEditor(index);
  let refresh = false;
  try {
    if (await writePlan(week, index + 1, draft.revision, data)) {
      adoptPlan(draft, data);
      draft.message = "Notes saved.";
    } else {
      draft.message = "Checking for newer notes…";
      refresh = true;
    }
  } catch {
    draft.message = "Couldn’t save notes. Try again.";
  } finally {
    draft.saving = false;
    if (week === planningWeek) {
      ++planReadId;
      renderPlanEditor(index);
      if (refresh) refreshPlans();
    }
  }
}

function selectPlanningWeek(week) {
  planningWeek = week;
  el("planning-week-label").textContent = weekFormat.formatRange(asCalendarDate(week), asCalendarDate(shiftDate(week, 6)));
  planEditors.forEach((_editor, index) => renderPlanEditor(index));
  el("planning-error").hidden = true;
  refreshPlans();
}

function refreshVisiblePlanning() {
  if (planningBoard.hidden || document.hidden) return;
  const sunday = sundayFor(currentBoardDate());
  const wasCurrent = planningWeek === currentPlanningWeek;
  currentPlanningWeek = sunday;
  if (wasCurrent && planningWeek !== sunday) selectPlanningWeek(sunday);
  else refreshPlans();
}

function selectBoardView() {
  const planning = location.hash === "#planning";
  board.hidden = planning;
  planningBoard.hidden = !planning;
  el("hero-period").textContent = planning ? "week." : "day.";
  el("hero-description").textContent = planning
    ? "Write your weekly plans and read both sets of notes."
    : "Add tasks, set deadlines, and track what’s done.";
  const current = el(planning ? "planning-tab" : "tasks-tab");
  const other = el(planning ? "tasks-tab" : "planning-tab");
  current.setAttribute("aria-current", "page");
  other.removeAttribute("aria-current");
  if (planning) {
    const sunday = sundayFor(currentBoardDate());
    const week = planningWeek === currentPlanningWeek ? sunday : planningWeek;
    currentPlanningWeek = sunday;
    selectPlanningWeek(week);
  } else {
    refreshWhenVisible();
  }
}

el("previous-week").addEventListener("click", () => selectPlanningWeek(shiftDate(planningWeek, -7)));
el("next-week").addEventListener("click", () => selectPlanningWeek(shiftDate(planningWeek, 7)));
el("current-week").addEventListener("click", () => selectPlanningWeek(sundayFor(currentBoardDate())));
el("planning-retry").addEventListener("click", refreshPlans);
window.addEventListener("hashchange", selectBoardView);
window.addEventListener("focus", refreshVisiblePlanning);
document.addEventListener("visibilitychange", refreshVisiblePlanning);
window.addEventListener("storage", (event) => {
  if (demoMode && event.key === planStorageKey) refreshVisiblePlanning();
});
setInterval(refreshVisiblePlanning, 15_000);
selectBoardView();
