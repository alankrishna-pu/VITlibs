/**
 * SideSeat - Seat Details Panel Component
 * Displays comprehensive details for the selected seat,
 * generates alternatives when occupied, and handles Admin availability updates.
 */

const SeatDetails = (() => {
    const detailsContainer = () => document.getElementById('seat-details-panel');

    /**
     * Compute alternative seats using the 3 simple rules:
     * 1. Available seats matching preferred category on same floor.
     * 2. Available individual seats in other categories on same floor.
     * 3. Available seats on other floors.
     */
    async function computeAlternatives(targetSeat) {
        if (!targetSeat || targetSeat.status === 'AVAILABLE') {
            return [];
        }

        const state = State.get();
        const currentFloorSeats = state.currentSeats || [];
        const preferredCat = targetSeat.category.toUpperCase();

        const alternatives = [];
        const seenIds = new Set([targetSeat.id]);

        // Rule 1: Available seats matching preferred category on same floor
        const rule1Matches = currentFloorSeats.filter(s =>
            s.id !== targetSeat.id &&
            s.category.toUpperCase() === preferredCat &&
            s.status === 'AVAILABLE'
        );
        rule1Matches.slice(0, 3).forEach(s => {
            if (!seenIds.has(s.id)) {
                seenIds.add(s.id);
                alternatives.push({
                    seat: s,
                    reason: `Same floor (${s.floor_id}) ${s.category} seat`,
                    ruleNumber: 1
                });
            }
        });

        // Rule 2: Available individual seats in other categories on same floor (SIDE, CORNER, INDIVIDUAL)
        const individualCategories = ['SIDE', 'CORNER', 'INDIVIDUAL'];
        const rule2Matches = currentFloorSeats.filter(s =>
            !seenIds.has(s.id) &&
            individualCategories.includes(s.category.toUpperCase()) &&
            s.status === 'AVAILABLE'
        );
        rule2Matches.slice(0, 3).forEach(s => {
            if (!seenIds.has(s.id)) {
                seenIds.add(s.id);
                alternatives.push({
                    seat: s,
                    reason: `Same floor individual seat (${s.category})`,
                    ruleNumber: 2
                });
            }
        });

        // Rule 3: Available seats on other floors matching preferred category or individual
        if (alternatives.length < 4) {
            try {
                // Fetch other floors
                const otherFloorIds = ["GROUND", "F1", "F2", "F3", "F4"].filter(f => f !== targetSeat.floor_id);
                for (const otherFloor of otherFloorIds) {
                    if (alternatives.length >= 5) break;
                    const otherSeats = await API.getSeats({ floor: otherFloor, available: true });
                    const match = otherSeats.find(s => s.category.toUpperCase() === preferredCat) ||
                                  otherSeats.find(s => individualCategories.includes(s.category.toUpperCase()));
                    if (match && !seenIds.has(match.id)) {
                        seenIds.add(match.id);
                        alternatives.push({
                            seat: match,
                            reason: `Available on ${match.floor_id} (${match.category})`,
                            ruleNumber: 3
                        });
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch other floors for alternatives:', e);
            }
        }

        return alternatives;
    }

    /**
     * Render the Seat Details Panel
     */
    async function render() {
        const container = detailsContainer();
        if (!container) return;

        const state = State.get();
        const seat = state.selectedSeat;
        const role = state.role;
        const isFav = seat ? State.isFavorite(seat.id) : false;

        if (!seat) {
            container.innerHTML = `
                <div class="details-empty-state">
                    <div class="empty-icon-wrap">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8">
                            <path d="M19 9l-7 7-7-7"/>
                            <rect x="4" y="4" width="16" height="16" rx="3"/>
                        </svg>
                    </div>
                    <h3>No Seat Selected</h3>
                    <p>Click any seat on the floor map or search a Seat ID to view real-time availability, power outlets, and smart alternatives.</p>
                    <div class="empty-quick-picks">
                        <span class="quick-title">Quick Picks:</span>
                        <button class="badge-chip" data-quick-seat="G-S01">G-S01 (Side)</button>
                        <button class="badge-chip" data-quick-seat="G-C01">G-C01 (Corner)</button>
                        <button class="badge-chip" data-quick-seat="G-I01">G-I01 (Desk)</button>
                    </div>
                </div>
            `;
            bindEmptyStateEvents();
            return;
        }

        const isAvailable = seat.status === 'AVAILABLE';
        const isOccupied = seat.status === 'OCCUPIED';
        const isUnavailable = seat.status === 'UNAVAILABLE';

        // Calculate alternatives if not available
        let alternatives = [];
        if (!isAvailable) {
            alternatives = await computeAlternatives(seat);
        }

        container.innerHTML = `
            <div class="seat-details-card animate-fade-in">
                <!-- Header with Seat ID & Close -->
                <div class="details-header">
                    <div class="details-title-row">
                        <div class="seat-id-highlight">
                            <span class="seat-cat-icon">${seat.category === 'SIDE' ? '🪟' : (seat.category === 'CORNER' ? '📐' : '💻')}</span>
                            <h2>${seat.id}</h2>
                        </div>
                        <span class="status-pill status-${seat.status.toLowerCase()}">
                            <span class="status-dot"></span>
                            ${seat.status}
                        </span>
                    </div>
                    <button class="btn-close-details" id="btn-close-details" title="Close Panel" aria-label="Close details">✕</button>
                </div>

                <!-- Floor and Location Breadcrumb -->
                <div class="details-location-tag">
                    <span class="loc-icon">📍</span>
                    <span>Floor: <strong>${seat.floor_id}</strong> &nbsp;•&nbsp; ${seat.zone}</span>
                </div>

                <!-- Quick Student Actions -->
                <div class="details-action-bar">
                    <button class="btn btn-fav ${isFav ? 'active' : ''}" id="btn-toggle-fav">
                        <span>${isFav ? '★ Favorited' : '☆ Add to Favorites'}</span>
                    </button>
                    <button class="btn btn-outline-sm" id="btn-copy-seat">
                        <span>📋 Copy ID</span>
                    </button>
                </div>

                <!-- Seat Specifications Grid -->
                <div class="seat-specs-grid">
                    <div class="spec-card">
                        <span class="spec-label">Category</span>
                        <strong class="spec-value">${seat.category} SEAT</strong>
                    </div>
                    <div class="spec-card">
                        <span class="spec-label">Map Position</span>
                        <strong class="spec-value">Row ${seat.grid_row}, Col ${seat.grid_col}</strong>
                    </div>
                    <div class="spec-card">
                        <span class="spec-label">Power Sockets</span>
                        <strong class="spec-value">⚡ 2 Plugs + USB-C</strong>
                    </div>
                    <div class="spec-card">
                        <span class="spec-label">Noise Zone</span>
                        <strong class="spec-value">${seat.floor_id === 'F3' ? '🤫 Strict Silence' : '📖 Quiet Study'}</strong>
                    </div>
                </div>

                <!-- Alternatives Section (if seat is Occupied or Unavailable) -->
                ${!isAvailable ? `
                    <div class="alternatives-section">
                        <div class="alt-header">
                            <span class="alt-icon">💡</span>
                            <h4>Recommended Available Alternatives</h4>
                        </div>
                        <p class="alt-description">
                            ${seat.id} is currently <strong>${seat.status.toLowerCase()}</strong>. Here are ranked available options:
                        </p>
                        
                        <div class="alt-cards-list">
                            ${alternatives.length > 0 ? alternatives.map(alt => `
                                <div class="alt-seat-card" data-alt-id="${alt.seat.id}" data-alt-floor="${alt.seat.floor_id}">
                                    <div class="alt-card-top">
                                        <div class="alt-seat-title">
                                            <span class="badge-rule">Rule ${alt.ruleNumber}</span>
                                            <strong>${alt.seat.id}</strong>
                                            <span class="badge-cat">${alt.seat.category}</span>
                                        </div>
                                        <button class="btn btn-primary-xs">View Seat →</button>
                                    </div>
                                    <div class="alt-card-desc">
                                        <span>${alt.reason}</span>
                                    </div>
                                </div>
                            `).join('') : `
                                <div class="alt-none-found">
                                    <p>No immediate alternatives found matching your criteria. Try browsing <strong>All Floors</strong> from the sidebar.</p>
                                </div>
                            `}
                        </div>
                    </div>
                ` : `
                    <div class="seat-vacant-callout">
                        <div class="callout-icon">✨</div>
                        <div class="callout-content">
                            <h4>This seat is vacant and ready for walk-in!</h4>
                            <p>Head to the <strong>${seat.floor_id}</strong> floor, <strong>${seat.zone}</strong> to claim this spot.</p>
                        </div>
                    </div>
                `}

                <!-- Administrator / Librarian Controls Section -->
                <div class="admin-controls-card">
                    <div class="admin-card-header">
                        <div class="admin-header-title">
                            <span class="admin-badge">🛠️ Admin Controls</span>
                            <h5>Seat Availability Management</h5>
                        </div>
                        <span class="admin-role-indicator ${role === 'ADMIN' ? 'role-admin' : 'role-student'}">
                            ${role === 'ADMIN' ? 'Admin Mode (Active)' : 'Student Mode'}
                        </span>
                    </div>

                    ${role === 'ADMIN' ? `
                        <div class="admin-actions-body">
                            <p class="admin-note">
                                Current Status before update: <strong class="status-text-${seat.status.toLowerCase()}">${seat.status}</strong>
                            </p>
                            <div class="admin-buttons-row">
                                <button class="btn btn-status btn-status-avail ${seat.status === 'AVAILABLE' ? 'current' : ''}"
                                        id="btn-set-avail" data-status="AVAILABLE">
                                    ✓ Set AVAILABLE
                                </button>
                                <button class="btn btn-status btn-status-occ ${seat.status === 'OCCUPIED' ? 'current' : ''}"
                                        id="btn-set-occ" data-status="OCCUPIED">
                                    ⏳ Set OCCUPIED
                                </button>
                                <button class="btn btn-status btn-status-unavail ${seat.status === 'UNAVAILABLE' ? 'current' : ''}"
                                        id="btn-set-unavail" data-status="UNAVAILABLE">
                                    🚫 Set UNAVAILABLE
                                </button>
                            </div>
                            <span class="admin-notice-tiny">
                                Updates persist directly to the C backend & <code>data/seats.csv</code>.
                            </span>
                        </div>
                    ` : (role === 'STUDENT' ? `
                        <div class="admin-locked-note">
                            <p>🔒 Student Account (${state.currentUser ? state.currentUser.name : 'Student'}): Availability updates are restricted to library staff.</p>
                            <button class="btn btn-outline-xs mt-2" id="btn-login-librarian-prompt">
                                🔑 Switch / Sign in as Librarian
                            </button>
                        </div>
                    ` : `
                        <div class="admin-locked-note">
                            <p>🔒 Guest View: Sign in as a Librarian to update seat availability.</p>
                            <button class="btn btn-primary-xs mt-2" id="btn-login-librarian-prompt">
                                🔑 Sign In
                            </button>
                        </div>
                    `)}
                </div>
            </div>
        `;

        bindDetailsEvents(seat);
    }

    /**
     * Bind interactive events on details elements
     */
    function bindDetailsEvents(seat) {
        const container = detailsContainer();
        if (!container) return;

        // Close button
        const closeBtn = container.querySelector('#btn-close-details');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                State.setSelectedSeat(null);
            });
        }

        // Favorite button
        const favBtn = container.querySelector('#btn-toggle-fav');
        if (favBtn) {
            favBtn.addEventListener('click', () => {
                const isNowFav = State.toggleFavorite(seat.id);
                favBtn.classList.toggle('active', isNowFav);
                favBtn.innerHTML = `<span>${isNowFav ? '★ Favorited' : '☆ Add to Favorites'}</span>`;
                showToast(isNowFav ? `Added ${seat.id} to Favorites` : `Removed ${seat.id} from Favorites`);
            });
        }

        // Copy button
        const copyBtn = container.querySelector('#btn-copy-seat');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(seat.id).then(() => {
                    showToast(`Copied ${seat.id} to clipboard!`);
                }).catch(() => {
                    showToast(`Seat ID: ${seat.id}`);
                });
            });
        }

        // Alternative cards click -> switch to that seat
        const altCards = container.querySelectorAll('.alt-seat-card');
        altCards.forEach(card => {
            card.addEventListener('click', async () => {
                const altId = card.getAttribute('data-alt-id');
                const altFloor = card.getAttribute('data-alt-floor');

                // Switch floor if needed
                if (State.get().currentFloor !== altFloor) {
                    State.setCurrentFloor(altFloor);
                    const seats = await API.getSeats({ floor: altFloor });
                    State.setCurrentSeats(seats);
                }

                // Locate and select seat
                const target = await API.getSeatById(altId);
                if (target) {
                    State.setSelectedSeat(target);
                }
            });
        });

        // Admin status buttons
        const statusButtons = container.querySelectorAll('.btn-status');
        statusButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const newStatus = btn.getAttribute('data-status');
                if (newStatus === seat.status) return;

                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = `<span>Updating...</span>`;

                try {
                    const updatedSeat = await API.updateSeatStatus(seat.id, newStatus);
                    State.updateSeatInState(updatedSeat);
                    showToast(`Seat ${seat.id} status updated to ${newStatus}`);

                    // Refresh floor list & stats in background
                    const floors = await API.getFloors();
                    State.setFloors(floors);
                } catch (err) {
                    console.error('Update failed:', err);
                    showToast(`Update failed: ${err.message}`, true);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        });

        // Login prompt button
        const loginPromptBtn = container.querySelector('#btn-login-librarian-prompt');
        if (loginPromptBtn) {
            loginPromptBtn.addEventListener('click', () => {
                if (window.openLoginModal) {
                    window.openLoginModal('LIBRARIAN');
                }
            });
        }
    }

    function bindEmptyStateEvents() {
        const container = detailsContainer();
        if (!container) return;

        const quickPicks = container.querySelectorAll('[data-quick-seat]');
        quickPicks.forEach(btn => {
            btn.addEventListener('click', async () => {
                const seatId = btn.getAttribute('data-quick-seat');
                const seat = await API.getSeatById(seatId);
                if (seat) {
                    if (State.get().currentFloor !== seat.floor_id) {
                        State.setCurrentFloor(seat.floor_id);
                        const seats = await API.getSeats({ floor: seat.floor_id });
                        State.setCurrentSeats(seats);
                    }
                    State.setSelectedSeat(seat);
                }
            });
        });
    }

    /**
     * Toast notification utility
     */
    function showToast(msg, isError = false) {
        let toast = document.getElementById('sideseat-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sideseat-toast';
            document.body.appendChild(toast);
        }

        toast.className = `sideseat-toast ${isError ? 'toast-error' : 'toast-success'} show`;
        toast.textContent = msg;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Subscribe to state changes
    State.subscribe('seatSelect', () => render());
    State.subscribe('seatUpdated', () => render());
    State.subscribe('roleChange', () => render());
    State.subscribe('authStateChange', () => render());

    return {
        render,
        showToast
    };
})();
