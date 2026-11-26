"use strict";

const zonedFormatters = new Map();
const legacyDeadlineZone = "Asia/Colombo";
const millisecondsPerDay = 86_400_000;

function zonedDateTime(instant, timeZone) {
  if (!zonedFormatters.has(timeZone)) {
    zonedFormatters.set(timeZone, new Intl.DateTimeFormat("en-GB", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }));
  }
  const parts = Object.fromEntries(zonedFormatters.get(timeZone).formatToParts(instant)
    .map(({ type, value }) => [type, value]));
  return {
    date: [parts.year.padStart(4, "0"), parts.month, parts.day].join("-"),
    time: [parts.hour, parts.minute, parts.second].join(":"),
  };
}

function localTimeToInstant(date, time, timeZone) {
  const fullTime = time.length === 5 ? time + ":00" : time;
  const wall = Date.parse(date + "T" + fullTime + "Z");
  const candidates = [-millisecondsPerDay, millisecondsPerDay].map((offset) => {
    const probe = wall + offset;
    const projected = zonedDateTime(probe, timeZone);
    const difference = Date.parse(projected.date + "T" + projected.time + "Z") - probe;
    return wall - difference;
  });

  // Postgres uses the later occurrence when the same clock time is repeated.
  candidates.sort((a, b) => b - a);
  return candidates.find((candidate) => {
    const local = zonedDateTime(candidate, timeZone);
    return local.date === date && local.time === fullTime;
  }) ?? null;
}

function taskDeadlineInstant(task) {
  if (!task.due_date || !task.due_time) return null;
  if (task.due_at) return Date.parse(task.due_at);
  return localTimeToInstant(task.due_date, task.due_time, task.due_zone || legacyDeadlineZone);
}
