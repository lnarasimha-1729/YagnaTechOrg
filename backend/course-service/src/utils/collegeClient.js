// Thin client for the college-service. Used by course-service to validate
// that clgIds attached to a course actually exist before persisting.
//
// We call GET /college/all (public) and check membership locally so we don't
// have to forward the caller's auth cookie. The list is small (one row per
// college) and cached briefly to avoid hammering college-service when an
// admin saves several courses in a row.

const TTL_MS = 30_000;
let cache = { at: 0, ids: null };

function baseUrl() {
  // Prefer talking through Bastion when available so we share the same
  // resolution / health-check path as the frontend; fall back to direct.
  if (process.env.BASTION_URL) {
    return `${process.env.BASTION_URL.replace(/\/$/, '')}/api/v1/college`;
  }
  const host = process.env.COLLEGE_SERVICE_HOST || 'localhost';
  const port = process.env.COLLEGE_SERVICE_PORT || 8005;
  return `http://${host}:${port}`;
}

async function loadCollegeIds() {
  const now = Date.now();
  if (cache.ids && now - cache.at < TTL_MS) return cache.ids;

  const url = `${baseUrl()}/all`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) {
    throw new Error(`college-service /all returned ${resp.status}`);
  }
  const colleges = await resp.json();
  const ids = new Set(colleges.map((c) => c.clgId));
  cache = { at: now, ids };
  return ids;
}

// Validate an array of clgIds. Returns { ok, unknown } — unknown is the list
// of ids that do not exist in college-service. If college-service itself is
// unreachable we throw so the caller can decide whether to fail-closed.
export async function validateCollegeIds(clgIds) {
  if (!Array.isArray(clgIds) || clgIds.length === 0) {
    return { ok: false, unknown: [], reason: 'empty' };
  }
  const known = await loadCollegeIds();
  const unknown = clgIds.filter((id) => !known.has(id));
  return { ok: unknown.length === 0, unknown };
}

// Best-effort lookup used to enrich GET responses with college names. Never
// throws — if the upstream is down, callers just see the raw ids.
export async function getCollegesByIds(clgIds) {
  if (!Array.isArray(clgIds) || clgIds.length === 0) return [];
  try {
    const resp = await fetch(`${baseUrl()}/all`, { method: 'GET' });
    if (!resp.ok) return [];
    const all = await resp.json();
    const wanted = new Set(clgIds);
    return all
      .filter((c) => wanted.has(c.clgId))
      .map((c) => ({ clgId: c.clgId, clgName: c.clgName }));
  } catch {
    return [];
  }
}
