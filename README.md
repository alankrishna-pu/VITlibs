# SideSeat – VIT Library Individual Seat Finder

> A lightweight, modern web prototype and C backend designed to help VIT students locate available individual library seats, especially **side seats** along walls/windows and quiet **corner study pods**.

---

## 📌 Table of Contents
1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [System Architecture](#system-architecture)
4. [DSA Concepts & Viva Explanation](#dsa-concepts--viva-explanation)
5. [REST API Contract](#rest-api-contract)
6. [Directory Structure](#directory-structure)
7. [Build & Run Instructions](#build--run-instructions)
8. [Automated Testing](#automated-testing)
9. [Demo Mode vs Live Backend](#demo-mode-vs-live-backend)
10. [Sample Floor Plans Disclaimer](#sample-floor-plans-disclaimer)

---

## 1. Project Overview

Finding an individual study desk or side window seat in large university libraries (like the Central Library at VIT) often involves wandering between floors. **SideSeat** solves this with a top-down visual floor map and an intelligent seat-finding engine:
- Visualizes 5 distinct floors: **Ground Floor, 1st Floor, 2nd Floor, 3rd Floor, and 4th Floor**.
- Filters specifically for **Side Seats (wall/window)** and **Corner Study Pods**.
- Implemented with a pure **Vanilla HTML5/CSS3/JavaScript frontend** (no heavy frameworks).
- Powered by a custom **C HTTP socket backend** utilizing core Data Structures & Algorithms (Hash Tables, Separate Chaining, Linear Search).
- Persists seat state persistently in `data/seats.csv`.

---

## 2. Key Features

- **Dark Navy Sidebar & Campus Dashboard**: Inspired by modern campus management apps with clear visual hierarchy, accessible keyboard navigation, and subtle micro-animations.
- **Top-Down Architectural Floor Map**: Visual top-down blueprint layout featuring landmarks (circulation desk, entrances, IT printing stations, book stacks, elevators, restrooms) and interactive clickable seat nodes.
- **Consistent Seat Color Statuses**:
  - 🟢 **Green (`AVAILABLE`)**: Vacant and ready for student walk-in.
  - 🔴 **Red (`OCCUPIED`)**: Currently in use.
  - ⚪ **Grey (`UNAVAILABLE`)**: Blocked for maintenance or offline power outlet.
  - 🔵 **Blue (`SELECTED`)**: Currently active seat with details and alternatives displayed.
- **Seat Details Panel**:
  - Seat ID, floor location, zone description, power socket availability, and noise zone.
  - One-click copy and browser **Favorites** bookmarking (stored in `localStorage`).
- **3-Rule Smart Alternative Recommendation**:
  When a selected seat is occupied or unavailable, the system ranks and recommends available substitutes:
  1. *Rule 1*: Available seats matching the preferred category on the **same floor**.
  2. *Rule 2*: Available individual seats in other categories on the **same floor**.
  3. *Rule 3*: Available seats on **other floors**.
- **Authentication & Role Login (Student vs Librarian)**:
  - Supports Student logins (Reg No e.g. `21BCE1024`) and Librarian / Staff logins (`LIB-8842` / `admin`).
  - Modal login dialog with 1-click test credentials, error reporting, and active session display in the header and sidebar.
  - Students have read-only explore access; Librarians can update seat availability (`AVAILABLE`, `OCCUPIED`, `UNAVAILABLE`) with live updates to the map, counters, and persistent CSV storage.
- **Statistics & DSA Analytics Dashboard**:
  - Live occupancy percentages, category breakdowns, and C backend hash table collision diagnostics.

---

## 3. System Architecture

```
+-------------------------------------------------------+
|                    Browser Frontend                   |
|  - HTML5 / CSS3 / Vanilla JavaScript                  |
|  - State Management: state.js                         |
|  - Interactive 2D Floor Map: floor-map.js             |
|  - Details & Recommendation Engine: seat-details.js  |
|  - API Client Layer: api.js (Auto Demo Fallback)      |
+---------------------------+---------------------------+
                            | HTTP / JSON (REST API)
                            v
+-------------------------------------------------------+
|                   C Backend Server                    |
|  - Pure C Socket HTTP/1.1 Server (http_server.c)      |
|  - Serves static frontend files and /api/* endpoints  |
|  - Cross-Origin Resource Sharing (CORS) enabled       |
+---------------------------+---------------------------+
                            |
           +----------------+----------------+
           |                                 |
           v                                 v
+--------------------+             +--------------------+
|     Hash Table     |             | Authoritative Array|
| (Separate Chaining)|             |  (Linear Search)   |
|   - DJB2 Hash      |             |  - Multi-attribute |
|   - O(1) avg lookup|             |    filtering O(n)  |
|   - seat.c         |             |  - 112 Seat records|
+--------------------+             +--------------------+
                                             |
                                             v
                                   +--------------------+
                                   | CSV Persistence    |
                                   | - data/seats.csv   |
                                   +--------------------+
```

---

## 4. DSA Concepts & Viva Explanation

### A. Authoritative Array (`Seat g_seats[MAX_SEATS]`)
- **Structure**: Fixed-size array holding all seat records (`id`, `floor_id`, `category`, `zone`, `status`, `grid_row`, `grid_col`).
- **Capacity**: `MAX_SEATS = 256`, containing ~112 initialized seats across 5 floors.
- **Why one authoritative array?**: Guarantees a single source of truth in memory. Pointers in the hash table and search results point directly back to elements in this array.

### B. Hash Table with Separate Chaining (`HashTable g_seat_ht`)
- **Purpose**: Fast $O(1)$ seat lookup by exact ID (e.g. `G-S01`, `F1-C02`).
- **Hash Function**: DJB2 string hashing algorithm:
  $$\text{hash}_{i} = ((\text{hash}_{i-1} \ll 5) + \text{hash}_{i-1}) + c = \text{hash}_{i-1} \times 33 + c$$
  Case-insensitive conversion ensures `g-s01` matches `G-S01`.
- **Bucket Size**: 101 buckets (a prime number chosen to distribute modulo residues uniformly and minimize clustering).
- **Collision Resolution**: **Separate Chaining** via singly-linked lists (`HashNode`). When two keys hash to the same bucket index, the new record is prepended to the bucket's chain.
- **Time Complexity**:
  - **Average Case**: $O(1)$ time complexity for lookup and insertion.
  - **Worst Case**: $O(n)$ if all keys collide into a single bucket.
- **Space Complexity**: $O(N + M)$ where $N$ is the number of seats and $M$ is the bucket count.

### C. Linear Search (`linear_search_seats`)
- **Purpose**: Multi-attribute filtering across floor (`GROUND`, `F1`...), category (`SIDE`, `CORNER`...), and availability status.
- **Why $O(n)$?**: The seat array is unsorted across arbitrary multi-criteria query parameters. To find all matching elements without maintaining expensive multi-dimensional indices, the algorithm sequentially inspects every element from index $0$ to $n-1$.
- **Time Complexity**: $O(n)$ where $n$ is `g_seat_count`.

---

## 5. REST API Contract

All endpoints exchange standard JSON and support Cross-Origin Resource Sharing (CORS):

| Method | Endpoint | DSA Concept | Description |
|---|---|---|---|
| `GET` | `/api/floors` | Array Aggregation | Returns all 5 floors with total, available, occupied, and unavailable counts. |
| `GET` | `/api/seats?floor=GROUND` | Linear Search $O(n)$ | Returns seats filtered by floor. |
| `GET` | `/api/seats?type=SIDE&available=true` | Linear Search $O(n)$ | Returns available side seats across floors. |
| `GET` | `/api/seats/:id` | Hash Table $O(1)$ | Direct lookup of a seat by ID via DJB2 hash table. |
| `PATCH` | `/api/seats/:id/status` | Hash Table + File I/O | Updates seat availability (`AVAILABLE`, `OCCUPIED`, `UNAVAILABLE`) and persists to `data/seats.csv`. Body: `{"status":"OCCUPIED"}` |
| `POST` | `/api/login` | Authentication Handler | Validates credentials and returns user identity + role (`STUDENT` or `ADMIN`). |
| `GET` | `/api/stats` | Array Aggregation | Returns global counts, side/corner breakdowns, and hash table diagnostics. |
| `GET` | `/` or `/*` | Static File Handler | Serves frontend assets (`index.html`, `css/style.css`, `js/*.js`). |

---

## 6. Directory Structure

```
SideSeat/
├── Makefile                 # Build automation for server and test suite
├── README.md                # Project documentation and viva guide
├── backend/
│   ├── seat.h               # Seat structs, Hash Table, Linear Search declarations
│   ├── seat.c               # Hash Table (DJB2 + chaining), Linear Search, CSV I/O
│   ├── http_server.h        # Socket HTTP server interface
│   ├── http_server.c        # HTTP socket server, router, static file server, CORS
│   └── main.c               # Server entry point and CLI argument parser
├── data/
│   └── seats.csv            # Persistent seat records (112 seats across 5 floors)
├── frontend/
│   ├── index.html           # Semantic HTML5 dashboard layout
│   ├── css/
│   │   └── style.css        # Responsive CSS3 styling (dark navy sidebar, light cards)
│   └── js/
│       ├── api.js           # API client layer with automatic demo data fallback
│       ├── state.js         # Reactive state store, favorites, and recents
│       ├── floor-map.js     # Top-down architectural 2D floor map renderer
│       ├── seat-details.js  # Details card, 3-rule recommendation engine, admin controls
│       └── app.js           # Main controller, filters, and tab navigation
└── tests/
    └── test_backend.c       # Automated C tests for DSA operations & persistence
```

---

## 7. Build & Run Instructions

### Prerequisites
- macOS or Linux
- C Compiler: `clang` or `gcc` (C11 standard)
- `make` utility

### 1. Compile the C Backend
```bash
make all
```
*Binary generated at `bin/sideseat_server`.*

### 2. Run the C Backend Server
```bash
make run
```
*Alternatively:*
```bash
./bin/sideseat_server -p 8080 -d data/seats.csv -w frontend
```

### 3. Open SideSeat in Your Web Browser
Open your browser and navigate to:
```
http://localhost:8080/
```

*(You can also open `frontend/index.html` directly in any web browser; the frontend will automatically detect if the C backend is running and connect, or run in Demo Mode if offline).*

---

## 8. Automated Testing

To run the automated C test suite verifying Hash Table operations, collision resolution, Linear Search, status updates, persistence, and statistics consistency:

```bash
make test
```

### Test Suite Output:
```
===================================================
      SideSeat C Backend & DSA Automated Tests     
===================================================

--- Test Suite 1: Hash Table Basic Operations ---
  [PASS] Hash table insertion succeeds for new seats
  [PASS] Lookup finds existing seat TEST-S01
  [PASS] Lookup is case-insensitive (test-s01 == TEST-S01)
  [PASS] Lookup returns NULL for nonexistent seat ID
  [PASS] Hash table free resets count to 0

--- Test Suite 2: Hash Collision Handling (Separate Chaining) ---
  [PASS] Lookup succeeds for first chained item
  [PASS] Lookup succeeds for second chained item

--- Test Suite 3: Linear Search Filters (O(n)) ---
  [PASS] Sample seats loaded for linear search test
  [PASS] Linear search finds SIDE seats
  [PASS] All results from category filter match 'SIDE'
  [PASS] Linear search finds available seats on GROUND floor
  [PASS] All results match both GROUND floor and AVAILABLE status
  [PASS] Linear search handles combined floor and category filters

--- Test Suite 4: Status Update & Persistence ---
  [PASS] Test CSV initialized with sample seats
  [PASS] Status update returns success code 0
  [PASS] In-memory status matches updated status
  [PASS] Seats successfully reloaded from persistent CSV
  [PASS] Updated seat found after simulated restart
  [PASS] Persistent status matches new status across restart
  [PASS] Updating status of nonexistent seat returns -1 error

--- Test Suite 5: Statistics Consistency ---
  [PASS] Total seats in stats matches g_seat_count
  [PASS] Sum of available, occupied, and unavailable equals total seats
  [PASS] Ground floor has non-zero total seats
  [PASS] Ground floor status sum matches ground floor total

===================================================
Test Summary: 24 / 24 assertions passed
===================================================
```

---

## 9. Demo Mode vs Live Backend

- **Live Backend Mode**: When `bin/sideseat_server` is running, the top header displays `C Backend: Online (Port 8080)`. Seat queries and status updates are executed live over HTTP and persisted to `data/seats.csv`.
- **Demo Mode**: If the C backend server is stopped or unreachable, the frontend displays `Demo Data Mode (C Server Offline)`. The application remains fully functional in-memory with sample data so students can demonstrate all UI capabilities, alternative recommendations, and role switching without requiring a running server.
- **Switching**: Clicking the retry icon (🔄) in the header re-pings the backend and smoothly transitions between Demo Mode and Live Backend Mode without refreshing the page.

---

## 10. Sample Floor Plans Disclaimer

> **IMPORTANT DISCLAIMER**: The floor layouts, seat coordinates, and zone descriptions displayed in SideSeat are **simulated illustrative prototypes** designed for academic demonstration and DSA coursework. They do not claim to represent official architectural blueprints or real-time occupancy sensors of the Vellore Institute of Technology (VIT) Central Library.
