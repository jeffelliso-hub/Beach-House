// Netlify Function: reads private Google Calendar iCal feed(s) and returns
// events in a +/- 31 day window as simple JSON. No sign-in, nothing expires.
//
// Setup: Netlify → Site configuration → Environment variables →
//   ICAL_URL = your calendar's "Secret address in iCal format"
//   (comma-separate multiple feed URLs to merge calendars)
// Optional: CAL_TZ (IANA timezone for all-day/floating events, default America/New_York)

var CAL_TZ = process.env.CAL_TZ || 'America/New_York';
var DAY = 86400000;
var WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
var MAX_ITER = 100000;

exports.handler = async function () {
  var urls = (process.env.ICAL_URL || '')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!urls.length) return resp({ error: 'ICAL_URL not set' });
  var now = Date.now();
  var winStart = now - 31 * DAY, winEnd = now + 31 * DAY;
  try {
    var events = [];
    for (var i = 0; i < urls.length; i++) {
      var r = await fetch(urls[i], { redirect: 'follow' });
      if (!r.ok) return resp({ error: 'Calendar feed error (HTTP ' + r.status + ')' });
      events = events.concat(parseICS(await r.text(), winStart, winEnd));
    }
    // All-day first, then by start time (client filters per day, order is kept)
    events.sort(function (a, b) {
      return (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.start - b.start;
    });
    return resp({ events: events });
  } catch (e) {
    return resp({ error: String((e && e.message) || e) });
  }
};

function resp(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

// ─────────────────────────── ICS parsing ───────────────────────────

function parseICS(text, winStart, winEnd) {
  // Normalize newlines, then unfold continuation lines (RFC 5545 §3.1)
  var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '').split('\n');

  var vevents = [], cur = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line === 'BEGIN:VEVENT') { cur = []; continue; }
    if (line === 'END:VEVENT') { if (cur) vevents.push(cur); cur = null; continue; }
    if (cur && line) cur.push(parseProp(line));
  }

  var masters = [], overrides = {}; // overrides[uid][recurrenceTs] = ev
  for (var v = 0; v < vevents.length; v++) {
    var ev = buildEvent(vevents[v]);
    if (!ev) continue;
    if (ev.recurrenceId != null) {
      if (!overrides[ev.uid]) overrides[ev.uid] = {};
      overrides[ev.uid][ev.recurrenceId] = ev;
    } else {
      masters.push(ev);
    }
  }

  var out = [];
  for (var m = 0; m < masters.length; m++) {
    var ms = masters[m];
    if (ms.cancelled || ms.start == null) continue;
    var dur = ms.end != null ? Math.max(0, ms.end - ms.start) : (ms.allDay ? DAY : 0);
    var starts = ms.rrule
      ? expandRRule(ms, winStart - dur, winEnd)
      : [ms.start];
    var ovr = overrides[ms.uid] || {};
    for (var s = 0; s < starts.length; s++) {
      var st = starts[s];
      if (ms.exdates && ms.exdates.indexOf(st) !== -1) continue;
      if (ovr[st] !== undefined) continue; // replaced (or cancelled) by an override below
      if (st >= winEnd || st + dur <= winStart) continue;
      out.push({ title: ms.title, start: st, end: st + dur, allDay: ms.allDay });
    }
  }
  // Emit overrides (moved/edited single instances) that land in the window
  for (var uid in overrides) {
    for (var k in overrides[uid]) {
      var o = overrides[uid][k];
      if (o.cancelled || o.start == null) continue;
      var oe = o.end != null ? o.end : o.start + (o.allDay ? DAY : 0);
      if (o.start < winEnd && oe > winStart) {
        out.push({ title: o.title, start: o.start, end: oe, allDay: o.allDay });
      }
    }
  }
  return out;
}

// "NAME;PARAM=x;PARAM2="q:z":value" → { name, params, value } (quote-aware)
function parseProp(line) {
  var inQ = false, colon = -1;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ':' && !inQ) { colon = i; break; }
  }
  if (colon === -1) return { name: line.toUpperCase(), params: {}, value: '' };
  var head = line.slice(0, colon).split(';');
  var params = {};
  for (var p = 1; p < head.length; p++) {
    var eq = head[p].indexOf('=');
    if (eq > -1) params[head[p].slice(0, eq).toUpperCase()] = head[p].slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: head[0].toUpperCase(), params: params, value: line.slice(colon + 1) };
}

function buildEvent(props) {
  var ev = { uid: '', title: 'Untitled', start: null, end: null, allDay: false,
             rrule: null, exdates: [], recurrenceId: null, cancelled: false, comps: null, tzid: null, utc: false };
  for (var i = 0; i < props.length; i++) {
    var p = props[i];
    switch (p.name) {
      case 'UID': ev.uid = p.value; break;
      case 'SUMMARY': ev.title = unescapeText(p.value); break;
      case 'STATUS': if (p.value.toUpperCase() === 'CANCELLED') ev.cancelled = true; break;
      case 'RRULE': ev.rrule = parseRRule(p.value); break;
      case 'DTSTART': {
        var d = parseDT(p.value, p.params);
        if (!d) return null;
        ev.start = d.ts; ev.allDay = d.allDay; ev.comps = d.comps; ev.tzid = d.tzid; ev.utc = d.utc;
        break;
      }
      case 'DTEND': {
        var e = parseDT(p.value, p.params);
        if (e) ev.end = e.ts;
        break;
      }
      case 'EXDATE': {
        var vals = p.value.split(',');
        for (var x = 0; x < vals.length; x++) {
          var xd = parseDT(vals[x], p.params);
          if (xd) ev.exdates.push(xd.ts);
        }
        break;
      }
      case 'RECURRENCE-ID': {
        var rid = parseDT(p.value, p.params);
        if (rid) ev.recurrenceId = rid.ts;
        break;
      }
    }
  }
  return ev.start != null ? ev : null;
}

function unescapeText(s) {
  return s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
}

// Parse an ICS date/date-time into { ts (UTC ms), allDay, comps, tzid, utc }
function parseDT(val, params) {
  val = val.trim();
  var m;
  if ((params && params.VALUE === 'DATE') || /^\d{8}$/.test(val)) {
    m = /^(\d{4})(\d{2})(\d{2})/.exec(val);
    if (!m) return null;
    var c0 = { y: +m[1], mo: +m[2], d: +m[3], h: 0, mi: 0, s: 0 };
    return { ts: zonedToUtc(c0, CAL_TZ), allDay: true, comps: c0, tzid: CAL_TZ, utc: false };
  }
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(val);
  if (!m) return null;
  var c = { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] };
  if (m[7] === 'Z') {
    return { ts: Date.UTC(c.y, c.mo - 1, c.d, c.h, c.mi, c.s), allDay: false, comps: c, tzid: null, utc: true };
  }
  var tz = (params && params.TZID) || CAL_TZ;
  return { ts: zonedToUtc(c, tz), allDay: false, comps: c, tzid: tz, utc: false };
}

// Convert wall-clock components in a timezone to a UTC timestamp (DST-safe)
function zonedToUtc(c, tz) {
  var guess = Date.UTC(c.y, c.mo - 1, c.d, c.h, c.mi, c.s);
  var off = tzOffsetMs(guess, tz);
  off = tzOffsetMs(guess - off, tz);
  return guess - off;
}

function tzOffsetMs(ts, tz) {
  var dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, era: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  var p = {};
  dtf.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
  var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return asUTC - ts;
}

function parseRRule(s) {
  var rule = {};
  s.split(';').forEach(function (kv) {
    var eq = kv.indexOf('=');
    if (eq > -1) rule[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
  });
  return rule;
}

// Expand an RRULE into instance start timestamps intersecting [winStart, winEnd].
// Supports FREQ=DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL,
// BYDAY (weekly lists + monthly ordinals like 2TU/-1SU), BYMONTHDAY.
function expandRRule(ev, winStart, winEnd) {
  var rule = ev.rrule, freq = (rule.FREQ || '').toUpperCase();
  var interval = Math.max(1, parseInt(rule.INTERVAL || '1', 10));
  var count = rule.COUNT ? parseInt(rule.COUNT, 10) : null;
  var until = null;
  if (rule.UNTIL) {
    var u = parseDT(rule.UNTIL, /T/.test(rule.UNTIL) ? {} : { VALUE: 'DATE' });
    if (u) until = u.allDay ? u.ts + DAY - 1 : u.ts;
  }
  var tz = ev.utc ? 'UTC' : (ev.tzid || CAL_TZ);
  var base = ev.comps;
  var results = [], emitted = 0, iter = 0;

  function pushIf(ts) {
    if (until != null && ts > until) return false;
    if (count != null && emitted >= count) return false;
    emitted++;
    if (ts >= winStart && ts < winEnd) results.push(ts);
    return true;
  }
  function mkTs(y, mo, d) {
    // Normalize date via UTC math, keep the event's wall-clock time, convert in tz
    var nd = new Date(Date.UTC(y, mo - 1, d));
    var c = { y: nd.getUTCFullYear(), mo: nd.getUTCMonth() + 1, d: nd.getUTCDate(), h: base.h, mi: base.mi, s: base.s };
    return ev.utc ? Date.UTC(c.y, c.mo - 1, c.d, c.h, c.mi, c.s) : zonedToUtc(c, tz);
  }
  function done(ts) {
    return ts >= winEnd || (until != null && ts > until) || (count != null && emitted >= count);
  }

  if (freq === 'DAILY') {
    for (var k = 0; iter++ < MAX_ITER; k += interval) {
      var ts = mkTs(base.y, base.mo, base.d + k);
      if (!pushIf(ts) || done(ts)) break;
    }
  } else if (freq === 'WEEKLY') {
    var startDow = new Date(Date.UTC(base.y, base.mo - 1, base.d)).getUTCDay();
    var days = rule.BYDAY
      ? rule.BYDAY.split(',').map(function (x) { return WD[x.trim().slice(-2)]; })
          .filter(function (x) { return x != null; })
      : [startDow];
    var offs = days.map(function (dw) { return (dw - startDow + 7) % 7; }).sort(function (a, b) { return a - b; });
    outerW:
    for (var w = 0; iter++ < MAX_ITER; w += interval) {
      for (var oi = 0; oi < offs.length; oi++) {
        var tsw = mkTs(base.y, base.mo, base.d + w * 7 + offs[oi]);
        if (tsw < ev.start) continue;
        if (!pushIf(tsw) || done(tsw)) break outerW;
      }
    }
  } else if (freq === 'MONTHLY') {
    var byDay = rule.BYDAY ? /^(-?\d+)?([A-Z]{2})$/.exec(rule.BYDAY.split(',')[0].trim()) : null;
    var byMonthDay = rule.BYMONTHDAY ? parseInt(rule.BYMONTHDAY.split(',')[0], 10) : null;
    outerM:
    for (var mk = 0; iter++ < MAX_ITER; mk += interval) {
      var mm = base.mo - 1 + mk;
      var yy = base.y + Math.floor(mm / 12);
      var mon = (mm % 12) + 1;
      var dim = new Date(Date.UTC(yy, mon, 0)).getUTCDate();
      var dd = null;
      if (byDay) {
        var ord = byDay[1] ? parseInt(byDay[1], 10) : null;
        var wd = WD[byDay[2]];
        if (ord != null && ord > 0) {
          var firstDow = new Date(Date.UTC(yy, mon - 1, 1)).getUTCDay();
          dd = 1 + ((wd - firstDow + 7) % 7) + (ord - 1) * 7;
        } else if (ord != null && ord < 0) {
          var lastDow = new Date(Date.UTC(yy, mon - 1, dim)).getUTCDay();
          dd = dim - ((lastDow - wd + 7) % 7) + (ord + 1) * 7;
        } else {
          var fD = new Date(Date.UTC(yy, mon - 1, 1)).getUTCDay();
          dd = 1 + ((wd - fD + 7) % 7); // BYDAY without ordinal → first such weekday
        }
      } else if (byMonthDay != null) {
        dd = byMonthDay > 0 ? byMonthDay : dim + byMonthDay + 1;
      } else {
        dd = base.d;
      }
      if (dd == null || dd < 1 || dd > dim) continue;
      var tsm = mkTs(yy, mon, dd);
      if (tsm < ev.start) continue;
      if (!pushIf(tsm) || done(tsm)) break outerM;
    }
  } else if (freq === 'YEARLY') {
    for (var yk = 0; iter++ < MAX_ITER; yk += interval) {
      var yy2 = base.y + yk;
      var dim2 = new Date(Date.UTC(yy2, base.mo, 0)).getUTCDate();
      if (base.d > dim2) continue; // e.g. Feb 29 on non-leap years
      var tsy = mkTs(yy2, base.mo, base.d);
      if (tsy < ev.start) continue;
      if (!pushIf(tsy) || done(tsy)) break;
    }
  } else {
    results.push(ev.start); // unknown FREQ → at least show the first occurrence
  }
  return results;
}

// exposed for testing
exports._parseICS = parseICS;
