# Course Service — API Reference

Base URL through Bastion proxy: `http://localhost:8000/api/v1/course`
Direct base URL: `http://localhost:8002`

All endpoints require a logged-in user (cookie or `Authorization: Bearer <jwt>`).
Endpoints that mutate (`POST`, `PUT`, `DELETE`) additionally require the `admin` role.

---

## Course resource

```jsonc
{
  "courseId": "C101",                  // string, primary key
  "title": "Intro to Robotics",        // string, required
  "description": "...",                // string, optional
  "duration": 40,                      // positive integer (hours)
  "isPreAssessmentNeeded": false,      // boolean, default false
  "modules": [                         // array, optional
    { "moduleId": "M1", "title": "Intro", "duration": 30 }
  ],
  "clgIds": ["clg_cnmsph6e7"],         // string[], required, >= 1
  "createdAt": "2026-05-15T10:00:00Z",
  "updatedAt": "2026-05-15T10:00:00Z"
}
```

`clgIds` are application-validated against college-service `GET /college/all`
before INSERT/UPDATE. Unknown IDs → `400`. College-service unreachable → `503`
(fail-closed).

---

## Endpoints

### `POST /course/add` — create

**Auth:** logged-in admin.

**Body:**
```json
{
  "courseId": "C101",
  "title": "Intro to Robotics",
  "duration": 40,
  "isPreAssessmentNeeded": false,
  "clgIds": ["clg_cnmsph6e7", "clg_ab12cd34"]
}
```

**Responses:**
| Status | Body | Reason |
|---|---|---|
| 201 | full Course | created |
| 400 | `{ "error": "Validation failed", "details": { ... } }` | bad payload |
| 400 | `{ "error": "Unknown clgId(s) — not found in college-service", "unknown": [...] }` | unknown college |
| 409 | `{ "error": "Course with this ID already exists" }` | duplicate `courseId` |
| 503 | `{ "error": "College service unreachable; cannot validate clgIds" }` | college-service down |

### `GET /course/all` — list

**Auth:** logged-in.
**Response 200:** `Course[]`.

### `GET /course/:courseId` — fetch one (enriched)

**Auth:** logged-in.
**Response 200:** `Course` plus best-effort enrichment:
```json
{
  "courseId": "C101",
  "...": "...",
  "clgIds": ["clg_cnmsph6e7"],
  "colleges": [{ "clgId": "clg_cnmsph6e7", "clgName": "ABC College" }]
}
```
If college-service is unreachable, `colleges` is `[]` but the request still succeeds (raw `clgIds` is always returned).

**Response 404:** `{ "error": "Course not found" }`.

### `GET /course/by-college/:clgId` — list by college

Uses MySQL `JSON_CONTAINS` so filtering happens in the DB.

**Auth:** logged-in.
**Response 200:** `Course[]` (every course offered at `:clgId`).
**Response 400:** `{ "error": "clgId is required" }`.

### `PUT /course/update/:courseId` — partial update

**Auth:** logged-in admin.
**Body:** any subset of the create body. If `clgIds` is provided it must be non-empty and is re-validated against college-service.

**Responses:** `200` (updated Course), `400` (validation / unknown clgIds), `404` (not found), `503` (college-service down during clgIds validation).

### `DELETE /course/delete/:courseId` — remove

**Auth:** logged-in admin.
**Responses:** `204` on success, `404` if not found.

---

## Validation rules

| Field | Rule |
|---|---|
| `courseId` | non-empty string, unique |
| `title` | non-empty string |
| `duration` | positive integer |
| `description` | string (optional) |
| `isPreAssessmentNeeded` | boolean (optional) |
| `modules` | array (optional) |
| `clgIds` | string[], length ≥ 1, every element must exist in college-service |

Validation lives in [`src/validators/course.validator.js`](src/validators/course.validator.js).

---

## Migration

For an existing `courses` table without `clgIds`, run:

```sql
-- See src/db/migrations/20260515-add-clgIds-to-courses.sql
ALTER TABLE `courses`
  ADD COLUMN `clgIds` JSON NOT NULL DEFAULT (JSON_ARRAY())
  AFTER `modules`;
```

Or with sequelize-cli: `npx sequelize-cli db:migrate`.

On fresh databases, `sequelize.sync()` creates the column automatically — the migration's `up()` is idempotent (skips if the column exists).

---

## Environment

```
PORT=8002
SERVICE_NAME=course-service
DB_HOST=...
DB_PORT=3306
DB_USER=...
DB_PASS=...
DB_NAME=lucy_devdb

# College-service location, used by src/utils/collegeClient.js. Prefer
# BASTION_URL in shared environments so the same health/discovery path is
# used as by the frontend.
BASTION_URL=http://localhost:8000        # optional
COLLEGE_SERVICE_HOST=localhost           # fallback
COLLEGE_SERVICE_PORT=8005                # fallback
```

---

## Testing strategy

Manual smoke (no test framework is wired up in this repo yet):

```bash
# 1. create with an unknown college → expect 400
curl -X POST http://localhost:8000/api/v1/course/add \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"courseId":"C-bad","title":"x","duration":1,"clgIds":["clg_bogus"]}'

# 2. create with a real college → expect 201
curl -X POST http://localhost:8000/api/v1/course/add \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"courseId":"C101","title":"Robotics","duration":40,"clgIds":["<real-clgId>"]}'

# 3. list by college → expect array containing C101
curl http://localhost:8000/api/v1/course/by-college/<real-clgId> -b cookies.txt

# 4. fetch one → expect colleges[] populated
curl http://localhost:8000/api/v1/course/C101 -b cookies.txt
```

When a Jest/Vitest setup is introduced, the natural unit boundaries are:
- `src/validators/course.validator.js` — pure functions, no I/O
- `src/utils/collegeClient.js` — mock `fetch`, assert caching + fail-closed behavior
- `src/controllers/course.controller.js` — mock the model + client, assert response shapes
