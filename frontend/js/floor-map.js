/**
 * SideSeat - Floor Map Component
 * Renders the interactive top-down 2D architectural map for each floor.
 * Distinct illustrative layouts for Ground, F1, F2, F3, F4.
 */

const FloorMap = (() => {
    const mapContainer = () => document.getElementById('floor-map-container');

    const FLOOR_METADATA = {
        "GROUND": {
            title: "Ground Floor",
            tagline: "Main Entrance, Circulation Desk & General Study Area",
            northLabel: "North Campus Garden View (Glazed Windows)",
            southLabel: "South Main Entrance & Security Turnstiles",
            westLabel: "West Quiet Study Wall",
            eastLabel: "East Garden View Wall",
            landmarks: [
                { row: 6, col: 4, spanCol: 2, name: "🚪 Entrance & Reception", class: "landmark-entrance" },
                { row: 1, col: 4, spanCol: 2, name: "📚 New Arrivals & Catalog", class: "landmark-books" },
                { row: 3, col: 5, spanCol: 1, name: "🛗 Lift / Stairs", class: "landmark-facility" }
            ]
        },
        "F1": {
            title: "1st Floor",
            tagline: "Digital Library, E-Resource Workstations & Media Lab",
            northLabel: "North Server & Network Hub",
            southLabel: "South Media Center Foyer",
            westLabel: "West Digital Media Terminal Perimeter",
            eastLabel: "East E-Resource Workstations",
            landmarks: [
                { row: 6, col: 4, spanCol: 2, name: "🚪 1st Floor Foyer & Help Desk", class: "landmark-entrance" },
                { row: 1, col: 4, spanCol: 2, name: "🖥️ IT Lab & Printing Station", class: "landmark-books" },
                { row: 3, col: 5, spanCol: 1, name: "🛗 Lift / Stairs", class: "landmark-facility" }
            ]
        },
        "F2": {
            title: "2nd Floor",
            tagline: "Periodicals, Bound Journals & General Reference Stacks",
            northLabel: "North Periodical Archives",
            southLabel: "South Newspaper Reading Lounge",
            westLabel: "West Periodical Reading Counters",
            eastLabel: "East Journal Stacks Perimeter",
            landmarks: [
                { row: 6, col: 4, spanCol: 2, name: "🚪 2nd Floor Central Foyer", class: "landmark-entrance" },
                { row: 1, col: 4, spanCol: 2, name: "📖 Reference Stacks A-M", class: "landmark-books" },
                { row: 3, col: 5, spanCol: 1, name: "🛗 Lift / Stairs", class: "landmark-facility" }
            ]
        },
        "F3": {
            title: "3rd Floor",
            tagline: "Silent Deep Focus Hall (Strictly No Phone / Whisper Zone)",
            northLabel: "North Panoramic Mountain View",
            southLabel: "South Soundproof Foyer Lockers",
            westLabel: "West Acoustic Silent Study Perimeter",
            eastLabel: "East Deep Focus Glass Wall",
            landmarks: [
                { row: 6, col: 4, spanCol: 2, name: "🚪 Soundproof Airlock Entry", class: "landmark-entrance" },
                { row: 1, col: 4, spanCol: 2, name: "🤫 Strict Silence Zone Monitor", class: "landmark-books" },
                { row: 3, col: 6, spanCol: 1, name: "🛗 Lift / Stairs", class: "landmark-facility" }
            ]
        },
        "F4": {
            title: "4th Floor",
            tagline: "Research Scholar Wing, Thesis Archives & Faculty Studies",
            northLabel: "North Research Archives & Patent Library",
            southLabel: "South Colloquium Foyer",
            westLabel: "West Scholar Research Desks",
            eastLabel: "East Doctoral Thesis Section",
            landmarks: [
                { row: 6, col: 4, spanCol: 2, name: "🚪 Scholar Lounge & Security", class: "landmark-entrance" },
                { row: 1, col: 4, spanCol: 2, name: "📑 Microfilm & Thesis Repository", class: "landmark-books" },
                { row: 3, col: 5, spanCol: 1, name: "🛗 Lift / Stairs", class: "landmark-facility" }
            ]
        }
    };

    /**
     * Category Icons and Visual Badges
     */
    function getCategoryIcon(cat) {
        switch (cat) {
            case 'SIDE': return '🪟';
            case 'CORNER': return '📐';
            case 'INDIVIDUAL': return '💻';
            case 'MIDDLE': return '🪑';
            case 'GROUP': return '👥';
            default: return '🪑';
        }
    }

    /**
     * Check if a seat satisfies the currently active UI filters
     */
    function seatMatchesFilters(seat, filters) {
        if (!seat) return false;

        // Search Query filter
        if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
            const q = filters.searchQuery.trim().toUpperCase();
            if (!seat.id.toUpperCase().includes(q) &&
                !seat.zone.toUpperCase().includes(q) &&
                !seat.category.toUpperCase().includes(q)) {
                return false;
            }
        }

        // Category filter
        if (filters.category && filters.category.length > 0) {
            if (seat.category.toUpperCase() !== filters.category.toUpperCase()) {
                return false;
            }
        }

        // Available Only filter
        if (filters.availableOnly) {
            if (seat.status !== 'AVAILABLE') {
                return false;
            }
        }

        return true;
    }

    /**
     * Render the floor map grid
     */
    function render() {
        const container = mapContainer();
        if (!container) return;

        const state = State.get();
        const floorId = state.currentFloor;
        const meta = FLOOR_METADATA[floorId] || FLOOR_METADATA["GROUND"];
        const seats = state.currentSeats;
        const filters = state.filters;
        const selectedSeat = state.selectedSeat;

        // Count matching seats
        const matchingSeats = seats.filter(s => seatMatchesFilters(s, filters));

        let html = `
            <div class="map-wrapper">
                <!-- Map Header & Blueprint Banner -->
                <div class="map-blueprint-header">
                    <div class="blueprint-info">
                        <span class="floor-badge">${meta.title}</span>
                        <h2 class="map-heading">${meta.title} – ${meta.tagline}</h2>
                        <p class="map-disclaimer">
                            <span class="pulse-dot"></span>
                            Illustrative sample layout for seat-finding prototype. Not official VIT architectural blueprint.
                        </p>
                    </div>
                    <div class="map-stats-pill">
                        <span class="stat-bubble avail"><strong>${seats.filter(s => s.status === 'AVAILABLE').length}</strong> Available</span>
                        <span class="stat-bubble occ"><strong>${seats.filter(s => s.status === 'OCCUPIED').length}</strong> Occupied</span>
                        <span class="stat-bubble unavail"><strong>${seats.filter(s => s.status === 'UNAVAILABLE').length}</strong> Inactive</span>
                    </div>
                </div>

                <!-- Architectural Walls & Orientation Compass -->
                <div class="architectural-frame">
                    <div class="wall-label wall-north">
                        <span>⬆ NORTH: ${meta.northLabel}</span>
                    </div>
                    <div class="wall-label wall-west">
                        <span>WEST: ${meta.westLabel}</span>
                    </div>
                    <div class="wall-label wall-east">
                        <span>EAST: ${meta.eastLabel}</span>
                    </div>
                    <div class="wall-label wall-south">
                        <span>⬇ SOUTH: ${meta.southLabel}</span>
                    </div>

                    <!-- 6-Row x 8-Column Map Grid -->
                    <div class="floor-grid" role="grid" aria-label="Library Floor Seat Map">
        `;

        // Render Landmarks
        meta.landmarks.forEach(lm => {
            const colEnd = lm.col + (lm.spanCol || 1);
            html += `
                <div class="grid-landmark ${lm.class}"
                     style="grid-row: ${lm.row}; grid-column: ${lm.col} / ${colEnd};">
                    <span class="landmark-text">${lm.name}</span>
                </div>
            `;
        });

        // Render Seats
        seats.forEach(seat => {
            const isSelected = selectedSeat && selectedSeat.id === seat.id;
            const matches = seatMatchesFilters(seat, filters);
            const statusClass = `status-${seat.status.toLowerCase()}`;
            const dimClass = matches ? '' : 'is-dimmed';
            const selectClass = isSelected ? 'is-selected' : '';
            const catIcon = getCategoryIcon(seat.category);

            html += `
                <div class="seat-node ${statusClass} ${dimClass} ${selectClass}"
                     style="grid-row: ${seat.grid_row}; grid-column: ${seat.grid_col};"
                     data-seat-id="${seat.id}"
                     role="button"
                     tabindex="0"
                     aria-label="Seat ${seat.id}, Category: ${seat.category}, Zone: ${seat.zone}, Status: ${seat.status}"
                     aria-pressed="${isSelected}">
                    
                    <div class="seat-badge-id">
                        <span class="cat-mini-icon">${catIcon}</span>
                        <span class="id-text">${seat.id}</span>
                    </div>

                    <div class="seat-chair-visual">
                        <svg class="chair-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="5" y="4" width="14" height="10" rx="3" fill="currentColor" fill-opacity="0.18"/>
                            <path d="M5 14h14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4z"/>
                            <line x1="7" y1="20" x2="7" y2="23"/>
                            <line x1="17" y1="20" x2="17" y2="23"/>
                        </svg>
                    </div>

                    <div class="seat-pill-status">
                        ${seat.status === 'AVAILABLE' ? 'VACANT' : (seat.status === 'OCCUPIED' ? 'IN USE' : 'BLOCKED')}
                    </div>

                    <!-- Custom Rich Hover Tooltip -->
                    <div class="seat-tooltip">
                        <div class="tooltip-header">
                            <strong>${seat.id}</strong>
                            <span class="tooltip-status status-${seat.status.toLowerCase()}">${seat.status}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tt-label">Type:</span> <span>${seat.category} Seat</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tt-label">Zone:</span> <span>${seat.zone}</span>
                        </div>
                        <div class="tooltip-footer">
                            <span>Click to view details & alternatives</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div> <!-- /.floor-grid -->
                </div> <!-- /.architectural-frame -->

                <!-- If filters active and zero matches -->
                ${matchingSeats.length === 0 ? `
                    <div class="no-filter-matches-banner">
                        <div class="banner-icon">🔍</div>
                        <div class="banner-content">
                            <h4>No seats match your active filters on ${meta.title}</h4>
                            <p>Try resetting your filters or check other floors for available individual & side seats.</p>
                            <button class="btn btn-outline btn-sm" id="btn-reset-map-filters">Reset Filters</button>
                        </div>
                    </div>
                ` : ''}

                <!-- Map Legend -->
                <div class="map-legend-bar">
                    <span class="legend-title">SEAT STATUS:</span>
                    <span class="legend-item"><span class="legend-color avail"></span> Available (Vacant)</span>
                    <span class="legend-item"><span class="legend-color occ"></span> Occupied (In Use)</span>
                    <span class="legend-item"><span class="legend-color unavail"></span> Unavailable (Maintenance)</span>
                    <span class="legend-item"><span class="legend-color selected"></span> Selected</span>
                    <span class="legend-divider">|</span>
                    <span class="legend-title">KEY ZONES:</span>
                    <span class="legend-item">🪟 Side (Wall/Window)</span>
                    <span class="legend-item">📐 Corner Pod</span>
                    <span class="legend-item">💻 Individual Desk</span>
                </div>
            </div>
        `;

        container.innerHTML = html;
        bindEvents();
    }

    /**
     * Bind click and keyboard events to seat nodes
     */
    function bindEvents() {
        const container = mapContainer();
        if (!container) return;

        // Seat node click & keyboard enter/space
        const seatNodes = container.querySelectorAll('.seat-node');
        seatNodes.forEach(node => {
            const seatId = node.getAttribute('data-seat-id');

            const handleSelect = () => {
                const state = State.get();
                const seat = state.currentSeats.find(s => s.id === seatId);
                if (seat) {
                    State.setSelectedSeat(seat);
                }
            };

            node.addEventListener('click', handleSelect);
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect();
                }
            });
        });

        // Reset filter button inside banner
        const resetBtn = container.querySelector('#btn-reset-map-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                State.resetFilters();
            });
        }
    }

    // Subscribe to state changes
    State.subscribe('floorChange', () => render());
    State.subscribe('seatsUpdate', () => render());
    State.subscribe('seatSelect', () => render());
    State.subscribe('filterChange', () => render());
    State.subscribe('seatUpdated', () => render());

    return {
        render
    };
})();
