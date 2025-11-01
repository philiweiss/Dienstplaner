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


### Kalender-Export (ICS)

Ab sofort kann jeder Nutzer einen geheimen Kalender-Link (ICS) erhalten, den man in Outlook/Apple/Google Kalender abonnieren kann. Neue Schichten werden so automatisch im Kalender geblockt (TRANSP: OPAQUE).

- Endpunkte:
  - `POST /api/calendar/token` — erzeugt (oder liefert) den geheimen Token eines Nutzers und gibt die Abo-URL zurück
    - Body: `{ "userId": "<USER_ID>", "regenerate": false }`
    - Antwort: `{ "token": "...", "url": "https://<HOST>/api/calendar/<token>.ics" }`
    - Hinweis: `regenerate=true` erzeugt einen neuen Token und macht den alten Link ungültig.
  - `GET /api/calendar/:token.ics` — öffentliche ICS-Feed-URL (keine Auth), die von Kalender-Apps regelmäßig aktualisiert wird.

- Datenquelle: Alle Zuweisungen (`assignment_users`) des Nutzers im Bereich: letzte 30 Tage bis +365 Tage.
- Zeiten: Die Schicht-Start-/Endzeiten stammen aus `shift_types`. Übernacht-Schichten (Ende <= Start) werden automatisch auf den Folgetag gelegt.
- Zeitzone: Standard `Europe/Berlin`. Über ENV konfigurierbar (`TIMEZONE`).
- URL-Erzeugung: Falls `BASE_URL` gesetzt ist (z. B. `https://dev.wproducts.de`), wird diese verwendet; sonst wird sie aus der eingehenden Anfrage abgeleitet.

#### Outlook: Kalender abonnieren
1. In Outlook (Desktop): Kalender > Kalender hinzufügen > Aus dem Internet abonnieren.
2. ICS-URL einfügen: `https://<HOST>/api/calendar/<token>.ics`.
3. Benennen und speichern. Outlook synchronisiert in Intervallen automatisch.

#### Apple Kalender (macOS/iOS)
- macOS: Kalender > Ablage > Neues Kalenderabonnement > ICS-URL einfügen.
- iOS: Einstellungen > Kalender > Accounts > Account hinzufügen > Anderer > Kalenderabo hinzufügen > ICS-URL einfügen.

#### Google Kalender
- In Google Kalender: Weitere Kalender > Per URL > ICS-URL einfügen > Kalender hinzufügen.

#### Sicherheit
- Die ICS-URL enthält einen geheimen Token. Wer den Link kennt, sieht die Schichten dieses Nutzers. Bei Verdacht auf Leck: über `POST /api/calendar/token` mit `regenerate: true` einen neuen Token generieren und den Kalender neu abonnieren.

#### Migration (Datenbank)
- Neue Spalte: `users.calendar_token` (unique, optional). Das Init-Skript fügt sie automatisch hinzu (sowohl bei Neuinstallation als auch best-effort per ALTER TABLE).
- Manuell (falls nötig):
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_token VARCHAR(64) NULL;
  ALTER TABLE users ADD UNIQUE KEY uk_calendar_token (calendar_token);
  ```
