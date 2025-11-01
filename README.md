<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MM9oVxWfXjn7ksodrZONy-REdNRxi_gZ

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


---

## Backend (MySQL) — Dienstplaner API

A simple Express + TypeScript backend with MySQL has been added under `server/`.

### Voraussetzungen
- Node.js 18+
- MySQL 8+ (lokal oder in Docker)

### Setup
1. In das Server-Verzeichnis wechseln:
   ```bash
   cd server
   ```
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. `.env` anlegen (auf Basis von `.env.example`) und DB-Zugangsdaten eintragen:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=dienstplaner
   PORT=4000
   ```
4. Datenbank initialisieren (Schema anlegen):
   ```bash
   npm run db:init
   ```
5. Beispieldaten einspielen (entsprechen den bisherigen Frontend-Demos):
   ```bash
   npm run db:seed
   ```
6. Entwicklungserver starten:
   ```bash
   npm run dev
   ```
   Die API läuft dann standardmäßig unter `http://localhost:4000`.

### Wichtige Endpunkte
- `GET /api/health` — Healthcheck
- `POST /api/auth/login` — Username-only Login (legt Nutzer an, wenn nicht vorhanden)
  - Body: `{ "username": "Alice Admin" }`
- `GET /api/users` — Nutzerliste
- `POST /api/users` — Nutzer anlegen `{ name, role }`
- `PUT /api/users/:id` — Nutzer ändern
- `DELETE /api/users/:id` — Nutzer löschen
- `GET /api/shift-types` — Schichttypen
- `POST /api/shift-types` — Schichttyp anlegen `{ name, startTime, endTime, color, minUsers, maxUsers }`
- `PUT /api/shift-types/:id` — Schichttyp ändern (partial)
- `DELETE /api/shift-types/:id` — Schichttyp löschen
- `GET /api/assignments?start=YYYY-MM-DD&end=YYYY-MM-DD` — Zuweisungen im Zeitraum
- `POST /api/assignments/assign` — Nutzer zuweisen `{ date, shiftTypeId, userId }`
- `POST /api/assignments/unassign` — Nutzer entfernen `{ date, shiftTypeId, userId }`
- `GET /api/week-configs?year=2024` — Wochenstatus
- `PUT /api/week-configs` — Wochenstatus setzen `{ year, weekNumber, status }` (Status: `Offen`|`Gesperrt`)

### Hinweise zur Frontend-Integration
Aktuell nutzt das Frontend lokale In-Memory-Daten (`constants.ts`) und Context-State. Für eine Backend-Integration können die Hooks `useAuth` und `useSchedule` so angepasst werden, dass sie die obigen Endpunkte aufrufen. Auf Wunsch kann ich diese Umstellung vornehmen und die notwendigen Services hinzufügen.
