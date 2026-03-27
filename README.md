

# IT-Dienstplaner

Ein Tool zur Planung und Verwaltung von Dienstplänen für die IT-Abteilung.

## Projektstruktur

Das Projekt besteht aus zwei Hauptteilen:
- **Frontend**: Ein React-basiertes Frontend (mit Vite und TypeScript) im Hauptverzeichnis.
- **Backend**: Ein Node.js Express-Server im Verzeichnis `/server`.

## Voraussetzungen

- **Node.js**: Aktuelle LTS-Version empfohlen.
- **MySQL**: Eine laufende MySQL-Datenbankinstanz.
- **npm**: Standardmäßig bei Node.js enthalten.

## Installation & Setup

### 1. Repository klonen

```bash
git clone <repository-url>
cd Dienstplaner
```

### 2. Backend einrichten

Gehe in das Backend-Verzeichnis und installiere die Abhängigkeiten:

```bash
cd server
npm install
```

#### Umgebungsvariablen konfigurieren

Erstelle eine `.env`-Datei basierend auf der `.env.example`:

```bash
cp .env.example .env
```

Passe die Werte in der `.env`-Datei an deine lokale MySQL-Instanz an (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).

#### Datenbank initialisieren

Führe die Skripte aus, um die Datenbankstruktur zu erstellen und initiale Daten zu laden:

```bash
# Erstellt die Tabellen
npm run db:init

# (Optional) Fügt Testdaten hinzu
npm run db:seed
```

#### Backend starten

Starte den Server im Entwicklungsmodus:

```bash
npm run dev
```

Der Server läuft standardmäßig auf Port 4000 (siehe `.env`).

### 3. Frontend einrichten

Gehe zurück in das Hauptverzeichnis und installiere die Abhängigkeiten:

```bash
cd ..
npm install
```

#### Frontend starten

Starte den Vite-Entwicklungsserver:

```bash
npm run dev
```

Das Frontend ist nun unter `http://localhost:5173` (oder dem in der Konsole angezeigten Port) erreichbar.

## Verfügbare Skripte

### Hauptverzeichnis (Frontend)

- `npm run dev`: Startet den Vite-Entwicklungsserver.
- `npm run build`: Erstellt den Production-Build.
- `npm run preview`: Startet eine Vorschau des Builds.

### Verzeichnis `/server` (Backend)

- `npm run dev`: Startet den Server mit `ts-node-dev` (automatischer Neustart bei Änderungen).
- `npm run build`: Kompiliert den TypeScript-Code nach JavaScript (`/dist`).
- `npm run start`: Startet den kompilierten Server.
- `npm run db:init`: Initialisiert die Datenbanktabellen.
- `npm run db:seed`: Befüllt die Datenbank mit Testdaten.
