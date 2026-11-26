"use strict";

const config = window.SIDE_BY_SIDE_CONFIG;
const demoMode = !config.supabaseUrl && !config.supabasePublishableKey;
const sharedBoardConfigured = config.supabaseUrl && config.supabasePublishableKey.startsWith("sb_publishable_");
const demoStorageKey = "side-by-side:demo:v1";
const boardNames = ["Lakindu", "Milanka"];
const taskLocations = config.taskLocations;
const fullDate = new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "short", day: "numeric" });
const taskSelect = "id,owner_slot,title,notes,planned_date,due_date,due_time,due_at,due_zone,estimated_minutes,completed,created_at";
const el = (id) => document.getElementById(id);

const board = el("board");
const columns = el("columns");
const taskDialog = el("task-dialog");
const taskForm = el("task-form");
const deleteDialog = el("delete-dialog");
const dateInput = el("date-input");
const pendingTasks = new Set();

let today = currentBoardDate();
let localDates = taskLocations.map(({ timeZone }) => currentBoardDate(timeZone));
let activeDate = today;
let showingToday = true;
let demoTasks;
let tasks = [];
let taskDialogEntry;
let deleteDialogEntry;
let refreshId = 0;

function icon(name) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const use = document.createElementNS(namespace, "use");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "#i-" + name);
  svg.append(use);
  return svg;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function control(className, iconName, label) {
  const button = node("button", className);
  button.type = "button";
  button.append(icon(iconName));
  if (label) button.append(label);
  return button;
}

function setMessage(element, message = "") {
  element.textContent = message;
  element.hidden = !message;
}

function announce(message) {
  el("announcement").textContent = message;
}

function showBoardError(message = "") {
  el("board-error-text").textContent = message;
  el("board-error").hidden = !message;
}

function asCalendarDate(date) {
  return new Date(date + "T12:00:00Z");
}

function currentBoardDate(timeZone = config.timeZone) {
  return zonedDateTime(Date.now(), timeZone).date;
}

function shiftDate(value, days) {
  const date = asCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderDate() {
  const splitToday = showingToday && localDates[0] !== localDates[1];
  el("day-label").textContent = splitToday
    ? taskLocations.map(({ city }, index) => shortDate.format(asCalendarDate(localDates[index])) + " in " + city).join(" · ")
    : fullDate.format(asCalendarDate(dateForSlot(1)));
  el("date-picker-label").textContent = showingToday ? "Today" : shortDate.format(asCalendarDate(activeDate));
  el("today-button").hidden = showingToday;
  el("previous-day").disabled = activeDate === dateInput.min;
  el("next-day").disabled = activeDate === dateInput.max;
  dateInput.value = activeDate;
}

function dateForSlot(slot) {
  return showingToday ? localDates[slot - 1] : activeDate;
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  return (hours % 12 || 12) + ":" + String(minutes).padStart(2, "0") + " " + suffix;
}

function deadlineInZone(task, timeZone) {
  const instant = taskDeadlineInstant(task);
  if (instant === null) return { date: task.due_date, time: task.due_time };
  return zonedDateTime(instant, timeZone);
}

function describeDeadline(task) {
  const owner = task.owner_slot - 1;
  const location = taskLocations[owner];
  const local = deadlineInZone(task, location.timeZone);
  const dueDate = local.date === localDates[owner] ? "today" : shortDate.format(asCalendarDate(local.date));
  if (!local.time) return "Due " + dueDate;

  const other = taskLocations[1 - owner];
  const converted = deadlineInZone(task, other.timeZone);
  const day = converted.date === local.date ? "" : " (" + shortDate.format(asCalendarDate(converted.date)) + ")";
  return "Due " + dueDate + " at " + formatTime(local.time) + " " + location.city +
    " · " + formatTime(converted.time) + " " + other.city + day;
}

function seedDemoTasks() {
  const examples = [
    [0, "Review this week’s priorities", 30, "10:30", false],
    [0, "Pick up groceries", 25, "17:30", false],
    [0, "Go for an evening walk", 40, "19:00", false],
    [0, "Reply to emails", 20, "09:00", true],
    [1, "Finish the presentation slides", 60, "13:00", false],
    [1, "Book a table for Friday", 10, "18:00", false],
    [1, "Try the new pasta recipe", 45, "20:00", false],
    [1, "Water the plants", 10, "09:30", true],
  ];

  return examples.map(([member, title, minutes, dueTime, completed], index) => ({
    id: "example-" + index,
    owner_slot: member + 1,
    title,
    notes: null,
    planned_date: localDates[member],
    estimated_minutes: minutes,
    due_date: localDates[member],
    due_time: dueTime,
    due_zone: taskLocations[member].timeZone,
    completed,
    created_at: new Date().toISOString(),
  }));
}

function loadDemoTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(demoStorageKey));
    if (Array.isArray(stored)) {
      return stored.map(({ owner_id, ...task }) => ({
        ...task,
        owner_slot: task.owner_slot ?? (owner_id === "demo-partner" ? 2 : 1),
      }));
    }
  } catch {
    announce("Demo data is unavailable in browser storage.");
  }

  const sample = seedDemoTasks();
  storeDemoTasks(sample);
  return sample;
}

function storeDemoTasks(next) {
  demoTasks = next;
  try {
    localStorage.setItem(demoStorageKey, JSON.stringify(next));
  } catch {
    el("board-note").textContent = "Demo storage is unavailable. Changes last until you close or reload this page.";
  }
}

function renderTask(task) {
  const row = node("li", "task" + (task.completed ? " completed" : ""));
  row.dataset.taskId = task.id;
  const completionLabel = task.completed ? "Task completed" : "Mark complete";
  const check = control("task-completion button", "check", completionLabel);
  check.setAttribute("role", "checkbox");
  check.setAttribute("aria-checked", String(task.completed));
  check.setAttribute("aria-label", completionLabel + " for " + task.title);
  check.addEventListener("click", () => toggleTask(task));

  const body = node("div", "task-body");
  body.append(node("p", "task-title", task.title));
  const meta = node("div", "task-meta");
  if (task.estimated_minutes) {
    const duration = node("span");
    duration.append(icon("clock"), task.estimated_minutes + " min");
    meta.append(duration);
  }
  if (task.due_date) {
    const deadline = node("span");
    deadline.append(icon("flag"), describeDeadline(task));
    meta.append(deadline);
  }
  if (meta.childElementCount) body.append(meta);
  if (task.notes) body.append(node("p", "task-notes", task.notes));
  body.append(check);
  row.append(body);

  const menu = node("details", "task-menu");
  const summary = node("summary", "icon-button");
  summary.setAttribute("aria-label", "Actions for " + task.title);
  summary.append(icon("more"));
  summary.addEventListener("click", () => closeMenus(menu));
  const actions = node("div", "menu-content");
  const edit = control("quiet button", "edit", "Edit");
  edit.addEventListener("click", () => {
    menu.open = false;
    summary.focus();
    openTaskDialog(task.owner_slot, task);
  });
  const remove = control("quiet button delete-action", "trash", "Delete");
  remove.addEventListener("click", () => {
    menu.open = false;
    summary.focus();
    deleteDialogEntry = task;
    el("delete-task-name").textContent = task.title;
    setMessage(el("delete-error"));
    deleteDialog.showModal();
  });
  actions.append(edit, remove);
  menu.append(summary, actions);
  row.append(menu);

  return row;
}

function renderPanel(slot) {
  const name = boardNames[slot - 1];
  const canEdit = demoMode || sharedBoardConfigured;
  const list = tasks.filter((task) => task.owner_slot === slot);
  const completed = list.filter((task) => task.completed).length;

  const panel = node("section", "panel");
  panel.dataset.slot = slot;
  panel.setAttribute("aria-labelledby", "panel-title-" + slot);
  const heading = node("div", "panel-heading");
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() || "?";
  const avatar = node("span", "avatar", initial);
  avatar.setAttribute("aria-hidden", "true");
  const person = node("div", "person");
  const title = node("h3", "", name);
  title.id = "panel-title-" + slot;
  person.append(title, node("p", "", taskLocations[slot - 1].city + " · " + completed + " of " + list.length + " complete"));
  heading.append(avatar, person);
  if (canEdit) {
    const add = control("add-task button", "plus", "Add task");
    add.setAttribute("aria-label", "Add task for " + name);
    add.addEventListener("click", () => openTaskDialog(slot));
    heading.append(add);
  }

  const progress = node("div", "progress");
  progress.setAttribute("aria-hidden", "true");
  const fill = node("span");
  fill.style.width = (list.length ? completed / list.length * 100 : 0) + "%";
  progress.append(fill);
  panel.append(heading, progress);

  if (list.length) {
    const taskList = node("ul", "task-list");
    for (const task of list) taskList.append(renderTask(task));
    panel.append(taskList);
  } else {
    const empty = node("div", "empty-state");
    const emptyIcon = node("span", "empty-icon");
    emptyIcon.append(icon("list"));
    empty.append(emptyIcon, node("strong", "", "No tasks planned"), node("span", "", canEdit ? "Add a task when you’re ready." : "Tasks will appear here."));
    panel.append(empty);
  }

  return panel;
}

function renderColumns() {
  const focused = document.activeElement;
  const row = focused.closest(".task");
  const oldPanel = columns.contains(focused) && focused.closest(".panel");
  columns.replaceChildren(renderPanel(1), renderPanel(2));
  if (!oldPanel) return;

  const panel = columns.querySelector('[data-slot="' + oldPanel.dataset.slot + '"]');
  const newRow = row && Array.from(panel.querySelectorAll(".task")).find((item) => item.dataset.taskId === row.dataset.taskId);
  const action = focused.matches(".task-completion") ? ".task-completion" : "summary";
  (newRow?.querySelector(action) || panel.querySelector(".add-task"))?.focus({ preventScroll: true });
}

function sortedTasks(list) {
  const dueKeys = new Map(list.map((task) => {
    const local = deadlineInZone(task, taskLocations[task.owner_slot - 1].timeZone);
    return [task.id, local.date ? local.date + "T" + (local.time || "23:59:59") : "9999"];
  }));
  return list.sort((a, b) =>
    Number(a.completed) - Number(b.completed) ||
    dueKeys.get(a.id).localeCompare(dueKeys.get(b.id)) ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

async function requestBoardRows(table, query, { method = "GET", data, returnRows = false } = {}) {
  const url = new URL("/rest/v1/" + table, config.supabaseUrl);
  url.search = new URLSearchParams(query).toString();
  const headers = { apikey: config.supabasePublishableKey };
  if (data) headers["Content-Type"] = "application/json";
  if (returnRows) headers.Prefer = "return=representation";

  const response = await fetch(url, {
    method, headers, body: data ? JSON.stringify(data) : undefined, cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Object.assign(new Error("Board request failed."), { code: error.code });
  }
  if (method === "GET" || returnRows) return response.json();
}

function requestTasks(query, options) {
  return requestBoardRows("daily_tasks", query, options);
}

async function refreshTasks(force = false) {
  const request = ++refreshId;
  const dates = taskLocations.map((_location, index) => dateForSlot(index + 1));
  let next;

  if (demoMode) {
    next = demoTasks.filter((task) => task.planned_date === dates[task.owner_slot - 1]);
  } else {
    if (!sharedBoardConfigured) {
      showBoardError("The shared board is missing its Supabase settings.");
      return;
    }
    try {
      const filter = dates[0] === dates[1]
        ? { planned_date: "eq." + dates[0] }
        : { or: "(" + dates.map((date, index) => "and(owner_slot.eq." + (index + 1) + ",planned_date.eq." + date + ")").join(",") + ")" };
      next = await requestTasks({ select: taskSelect, ...filter });
    } catch {
      if (request === refreshId) showBoardError("Couldn’t load tasks for this day.");
      return;
    }
    if (request !== refreshId) return;
  }

  showBoardError();
  sortedTasks(next);
  if (force || JSON.stringify(tasks) !== JSON.stringify(next)) {
    tasks = next;
    renderColumns();
  }
}

async function selectDate(date, { localToday = date === today && localDates.every((value) => value === date), force = false } = {}) {
  if (!force && date === activeDate && localToday === showingToday) return;
  activeDate = date;
  showingToday = localToday;
  renderDate();
  tasks = [];
  renderColumns();
  showBoardError();
  await refreshTasks(true);
}

function refreshToday() {
  const date = currentBoardDate();
  const dates = taskLocations.map(({ timeZone }) => currentBoardDate(timeZone));
  if (date === today && dates.every((value, index) => value === localDates[index])) return;
  today = date;
  localDates = dates;
  if (showingToday) selectDate(today, { localToday: true, force: true });
  else {
    renderDate();
    renderColumns();
  }
}

async function saveChanges(task, patch, isNew = false) {
  if (demoMode) {
    const next = isNew
      ? [...demoTasks, { ...task, ...patch, completed: false, created_at: new Date().toISOString() }]
      : demoTasks.map((item) => item.id === task.id ? { ...item, ...patch } : item);
    storeDemoTasks(next);
    return;
  }

  if (isNew) {
    try {
      await requestTasks({}, { method: "POST", data: { ...task, ...patch } });
      return;
    } catch (error) {
      if (error.code !== "23505") throw error;
      // Retry the same task if the server saved it before the connection dropped.
    }
  }

  const rows = await requestTasks({ id: "eq." + task.id, select: "id" }, {
    method: "PATCH", data: patch, returnRows: true,
  });
  if (!rows.length) throw new Error("Task is no longer available.");
}

async function toggleTask(task) {
  if (pendingTasks.has(task.id)) return;
  pendingTasks.add(task.id);
  try {
    await saveChanges(task, { completed: !task.completed });
    await refreshTasks();
    announce(task.completed ? "Task marked incomplete." : "Task completed.");
  } catch {
    showBoardError("Couldn’t update the task. Try again.");
  } finally {
    pendingTasks.delete(task.id);
  }
}

function openTaskDialog(slot, task) {
  const location = taskLocations[slot - 1];
  const original = task ? deadlineInZone(task, location.timeZone) : { date: null, time: null };
  const originalDue = { date: original.date, time: original.time?.slice(0, 5) ?? null };
  taskDialogEntry = { task: task || { id: crypto.randomUUID(), owner_slot: slot }, isNew: !task, location, originalDue };
  taskForm.reset();
  for (const field of ["title", "estimated_minutes", "notes"]) {
    taskForm.elements.namedItem(field).value = task?.[field] ?? "";
  }
  taskForm.elements.planned_date.value = task?.planned_date || dateForSlot(slot);
  taskForm.elements.due_date.value = originalDue.date ?? "";
  taskForm.elements.due_time.value = originalDue.time ?? "";
  el("task-dialog-title").textContent = task ? "Edit task" : "Add a task";
  el("task-dialog-person").textContent = boardNames[slot - 1] + " · " + location.city + " time";
  el("save-task").textContent = task ? "Save changes" : "Add task";
  setMessage(el("task-error"));
  taskDialog.showModal();
  if (matchMedia("(min-width: 601px) and (pointer: fine)").matches) taskForm.elements.title.focus();
}

async function submitTask(event) {
  event.preventDefault();
  const { task, isNew, location, originalDue } = taskDialogEntry;
  const data = new FormData(taskForm);
  const title = data.get("title").trim();
  if (!title) {
    setMessage(el("task-error"), "Enter a task name.");
    taskForm.elements.title.focus();
    return;
  }
  const plannedDate = data.get("planned_date");
  const dueTime = data.get("due_time") || null;
  const dueDate = data.get("due_date") || (dueTime ? plannedDate : null);
  const patch = {
    title,
    planned_date: plannedDate,
    estimated_minutes: Number(data.get("estimated_minutes")) || null,
    notes: data.get("notes").trim() || null,
  };
  if (isNew || dueDate !== originalDue.date || dueTime !== originalDue.time) {
    if (dueTime && localTimeToInstant(dueDate, dueTime, location.timeZone) === null) {
      setMessage(el("task-error"), "That time is skipped when the clocks change in " + location.city + ". Choose another time.");
      taskForm.elements.due_time.focus();
      return;
    }
    Object.assign(patch, { due_date: dueDate, due_time: dueTime, due_zone: location.timeZone });
  }

  el("save-task").disabled = true;
  setMessage(el("task-error"));
  try {
    await saveChanges(task, patch, isNew);
    taskDialog.close();
    if (plannedDate === dateForSlot(task.owner_slot)) await refreshTasks();
    else {
      await selectDate(plannedDate);
      el("board-title").focus();
    }
    const message = isNew ? "Task added" : "Task saved";
    announce(message + ".");
  } catch {
    setMessage(el("task-error"), "Couldn’t save the task. Check your connection and try again.");
  } finally {
    el("save-task").disabled = false;
  }
}

async function submitDelete(event) {
  event.preventDefault();
  const button = event.submitter;
  const { id } = deleteDialogEntry;
  button.disabled = true;
  setMessage(el("delete-error"));
  try {
    if (demoMode) {
      storeDemoTasks(demoTasks.filter((task) => task.id !== id));
    } else {
      await requestTasks({ id: "eq." + id }, { method: "DELETE" });
    }
    deleteDialog.close();
    await refreshTasks();
    announce("Task deleted.");
  } catch {
    setMessage(el("delete-error"), "Couldn’t delete the task. Try again.");
  } finally {
    button.disabled = false;
  }
}

function closeMenus(except) {
  for (const menu of columns.querySelectorAll(".task-menu[open]")) {
    if (menu !== except) menu.open = false;
  }
}

function start() {
  if (demoMode) {
    el("board-note").textContent = "Demo tasks are saved in this browser.";
    demoTasks = loadDemoTasks();
  } else {
    el("board-note").textContent = "Today follows each list’s local date. Timed deadlines show both time zones.";
  }

  board.hidden = false;
  el("mode-label").textContent = demoMode ? "Demo mode" : "Shared board";
  el("mode-badge").hidden = false;
  renderDate();
  renderColumns();
  refreshTasks();
}

el("previous-day").addEventListener("click", () => selectDate(shiftDate(activeDate, -1)));
el("next-day").addEventListener("click", () => selectDate(shiftDate(activeDate, 1)));
el("today-button").addEventListener("click", () => {
  refreshToday();
  selectDate(today, { localToday: true });
});
dateInput.addEventListener("change", () => {
  if (dateInput.validity.valid) selectDate(dateInput.value);
  else dateInput.value = activeDate;
});
el("board-retry").addEventListener("click", () => refreshTasks(true));
taskForm.addEventListener("click", (event) => {
  const shortcut = event.target.closest("[data-day-offset]");
  if (!shortcut) return;
  const { dateField } = shortcut.closest("[data-date-field]").dataset;
  const localDate = currentBoardDate(taskDialogEntry.location.timeZone);
  taskForm.elements.namedItem(dateField).value = shiftDate(localDate, Number(shortcut.dataset.dayOffset));
});
taskForm.addEventListener("submit", submitTask);
el("delete-form").addEventListener("submit", submitDelete);

for (const dialog of [taskDialog, deleteDialog]) {
  const submit = dialog.querySelector('[type="submit"]');
  for (const button of dialog.querySelectorAll(".dialog-close")) {
    button.addEventListener("click", () => {
      if (!submit.disabled) dialog.close();
    });
  }
  dialog.addEventListener("cancel", (event) => {
    if (submit.disabled) event.preventDefault();
  });
}
document.addEventListener("click", (event) => {
  if (!event.target.closest(".task-menu")) closeMenus();
});
document.addEventListener("keydown", (event) => {
  const menu = event.target.closest(".task-menu[open]");
  if (event.key === "Escape" && menu) {
    menu.open = false;
    menu.querySelector("summary").focus();
  }
});
window.addEventListener("storage", (event) => {
  if (demoMode && event.key === demoStorageKey) {
    demoTasks = loadDemoTasks();
    refreshTasks();
  }
});
function refreshWhenVisible() {
  if (document.hidden) return;
  refreshToday();
  if (!demoMode && !board.hidden) refreshTasks();
}
document.addEventListener("visibilitychange", refreshWhenVisible);
window.addEventListener("focus", refreshWhenVisible);
setInterval(refreshWhenVisible, 15_000);

start();
