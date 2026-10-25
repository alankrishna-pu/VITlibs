/**
 * SideSeat - Main Application Controller
 * Coordinates navigation, search, filters, views, authentication, and data loading.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Element References
    const elements = {
        navItems: document.querySelectorAll('.nav-item[data-tab]'),
        viewContainers: document.querySelectorAll('.view-panel'),
        floorTabsContainer: document.getElementById('floor-selector-tabs'),
        searchInput: document.getElementById('seat-search-input'),
        searchClearBtn: document.getElementById('btn-clear-search'),
        categoryFilter: document.getElementById('filter-category'),
        availableToggle: document.getElementById('filter-available-only'),
        btnQuickSide: document.getElementById('btn-quick-side'),
        btnQuickCorner: document.getElementById('btn-quick-corner'),
        btnResetFilters: document.getElementById('btn-reset-filters'),
        seatsCountBadge: document.getElementById('seats-count-badge'),
        connectionStatusPill: document.getElementById('backend-status-pill'),
        btnRetryConnection: document.getElementById('btn-retry-connection'),
        headerAuthContainer: document.getElementById('header-auth-container'),
        sidebarUserAvatar: document.getElementById('sidebar-user-avatar'),
        sidebarUserName: document.getElementById('sidebar-user-name'),
        sidebarUserId: document.getElementById('sidebar-user-id'),
        btnSidebarLogin: document.getElementById('btn-sidebar-login'),
        btnSidebarLogout: document.getElementById('btn-sidebar-logout'),
        loginModalBackdrop: document.getElementById('login-modal-backdrop'),
        btnCloseLoginModal: document.getElementById('btn-close-login-modal'),
        btnCancelLogin: document.getElementById('btn-cancel-login'),
        loginForm: document.getElementById('login-form'),
        tabLoginStudent: document.getElementById('tab-login-student'),
        tabLoginLibrarian: document.getElementById('tab-login-librarian'),
        btnQuickFillStudent: document.getElementById('btn-quick-fill-student'),
        btnQuickFillAdmin: document.getElementById('btn-quick-fill-admin'),
        loginUsernameInput: document.getElementById('login-username'),
        loginPasswordInput: document.getElementById('login-password'),
        labelLoginUsername: document.getElementById('label-login-username'),
        loginRoleNote: document.getElementById('login-role-note'),
        loginErrorAlert: document.getElementById('login-error-alert')
    };

    let activeModalRole = 'STUDENT';

    /**
     * Update Connection Status Badge in Header
     */
    function updateConnectionUI(health) {
        if (!elements.connectionStatusPill) return;

        if (health.online) {
            elements.connectionStatusPill.className = 'status-pill pill-online';
            elements.connectionStatusPill.innerHTML = `
                <span class="status-dot"></span>
                <span>C Backend: Online (Port 8080)</span>
            `;
            elements.connectionStatusPill.title = "Connected to live C socket backend server";
        } else {
            elements.connectionStatusPill.className = 'status-pill pill-demo';
            elements.connectionStatusPill.innerHTML = `
                <span class="status-dot"></span>
                <span>Demo Data Mode (C Server Offline)</span>
            `;
            elements.connectionStatusPill.title = "Backend unreachable. Running interactive demo mode with sample data.";
        }
    }

    /**
     * Update Authentication UI across Header & Sidebar
     */
    function updateAuthUI(user) {
        // 1. Header Auth Area
        if (elements.headerAuthContainer) {
            if (user) {
                const initials = user.name
                    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'U';
                const isLibrarian = (user.role === 'ADMIN');

                elements.headerAuthContainer.innerHTML = `
                    <div class="user-profile-card" id="user-profile-menu">
                        <div class="avatar-circle ${isLibrarian ? 'avatar-admin' : ''}">${initials}</div>
                        <div class="user-meta">
                            <span class="user-name">${user.name}</span>
                            <span class="user-reg">${user.id || user.username}</span>
                        </div>
                        <span class="role-badge ${isLibrarian ? 'role-admin' : 'role-student'}">
                            ${isLibrarian ? 'Librarian (Admin)' : 'Student'}
                        </span>
                        <button class="btn-icon-logout" id="btn-header-logout" title="Sign Out">
                            🚪
                        </button>
                    </div>
                `;

                const btnHeaderLogout = elements.headerAuthContainer.querySelector('#btn-header-logout');
                if (btnHeaderLogout) {
                    btnHeaderLogout.addEventListener('click', () => {
                        State.logout();
                        SeatDetails.showToast("Signed out successfully");
                    });
                }
            } else {
                elements.headerAuthContainer.innerHTML = `
                    <button class="btn btn-primary-sm btn-header-login" id="btn-header-signin">
                        🔑 Sign In
                    </button>
                `;

                const btnHeaderSignin = elements.headerAuthContainer.querySelector('#btn-header-signin');
                if (btnHeaderSignin) {
                    btnHeaderSignin.addEventListener('click', () => openLoginModal('STUDENT'));
                }
            }
        }

        // 2. Sidebar User Panel
        if (elements.sidebarUserAvatar && elements.sidebarUserName && elements.sidebarUserId) {
            if (user) {
                const initials = user.name
                    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'U';
                const isLibrarian = (user.role === 'ADMIN');

                elements.sidebarUserAvatar.textContent = initials;
                elements.sidebarUserAvatar.className = `avatar-circle ${isLibrarian ? 'avatar-admin' : ''}`;
                elements.sidebarUserName.textContent = user.name;
                elements.sidebarUserId.textContent = isLibrarian ? `Staff: ${user.id || user.username}` : user.id;

                if (elements.btnSidebarLogin) elements.btnSidebarLogin.textContent = "Switch Account";
                if (elements.btnSidebarLogout) elements.btnSidebarLogout.style.display = "inline-block";
            } else {
                elements.sidebarUserAvatar.textContent = "GS";
                elements.sidebarUserAvatar.className = "avatar-circle";
                elements.sidebarUserName.textContent = "Guest Student";
                elements.sidebarUserId.textContent = "Not signed in";

                if (elements.btnSidebarLogin) elements.btnSidebarLogin.textContent = "Sign In";
                if (elements.btnSidebarLogout) elements.btnSidebarLogout.style.display = "none";
            }
        }
    }

    /**
     * Open Login Modal with specific role active
     */
    function openLoginModal(role = 'STUDENT') {
        activeModalRole = role;
        if (!elements.loginModalBackdrop) return;

        setModalRole(role);
        if (elements.loginErrorAlert) {
            elements.loginErrorAlert.style.display = 'none';
            elements.loginErrorAlert.textContent = '';
        }

        elements.loginModalBackdrop.style.display = 'flex';
        elements.loginModalBackdrop.classList.add('animate-fade-in');

        if (elements.loginUsernameInput) {
            elements.loginUsernameInput.focus();
        }
    }

    function closeLoginModal() {
        if (!elements.loginModalBackdrop) return;
        elements.loginModalBackdrop.style.display = 'none';
    }

    // Expose openLoginModal globally for seat-details.js to call
    window.openLoginModal = openLoginModal;

    /**
     * Configure modal tabs and text for Student vs Librarian
     */
    function setModalRole(role) {
        activeModalRole = role;

        if (elements.tabLoginStudent && elements.tabLoginLibrarian) {
            elements.tabLoginStudent.classList.toggle('active', role === 'STUDENT');
            elements.tabLoginLibrarian.classList.toggle('active', role === 'ADMIN');
        }

        if (role === 'ADMIN') {
            if (elements.labelLoginUsername) elements.labelLoginUsername.textContent = "Staff ID / Username:";
            if (elements.loginUsernameInput) {
                elements.loginUsernameInput.placeholder = "e.g. LIB-8842 or lib_admin";
                elements.loginUsernameInput.value = "LIB-8842";
            }
            if (elements.loginPasswordInput) {
                elements.loginPasswordInput.value = "admin123";
            }
            if (elements.loginRoleNote) {
                elements.loginRoleNote.innerHTML = `
                    ℹ️ <strong>Librarian Account:</strong> Manage seat availability, mark occupied or unavailable, and sync updates directly to backend.
                `;
            }
        } else {
            if (elements.labelLoginUsername) elements.labelLoginUsername.textContent = "Registration Number:";
            if (elements.loginUsernameInput) {
                elements.loginUsernameInput.placeholder = "e.g. 21BCE1024";
                elements.loginUsernameInput.value = "21BCE1024";
            }
            if (elements.loginPasswordInput) {
                elements.loginPasswordInput.value = "student123";
            }
            if (elements.loginRoleNote) {
                elements.loginRoleNote.innerHTML = `
                    ℹ️ <strong>Student Account:</strong> Locate walk-in seats, check real-time availability, and bookmark favorites.
                `;
            }
        }
    }

    /**
     * Bind Login and Auth Events
     */
    function bindAuthEvents() {
        // Sidebar buttons
        if (elements.btnSidebarLogin) {
            elements.btnSidebarLogin.addEventListener('click', () => {
                const current = State.getUser();
                openLoginModal(current && current.role === 'ADMIN' ? 'STUDENT' : 'STUDENT');
            });
        }

        if (elements.btnSidebarLogout) {
            elements.btnSidebarLogout.addEventListener('click', () => {
                State.logout();
                SeatDetails.showToast("Signed out successfully");
            });
        }

        // Close modal buttons
        if (elements.btnCloseLoginModal) {
            elements.btnCloseLoginModal.addEventListener('click', closeLoginModal);
        }
        if (elements.btnCancelLogin) {
            elements.btnCancelLogin.addEventListener('click', closeLoginModal);
        }

        // Backdrop click to close
        if (elements.loginModalBackdrop) {
            elements.loginModalBackdrop.addEventListener('click', (e) => {
                if (e.target === elements.loginModalBackdrop) {
                    closeLoginModal();
                }
            });
        }

        // Role tab clicks
        if (elements.tabLoginStudent) {
            elements.tabLoginStudent.addEventListener('click', () => setModalRole('STUDENT'));
        }
        if (elements.tabLoginLibrarian) {
            elements.tabLoginLibrarian.addEventListener('click', () => setModalRole('ADMIN'));
        }

        // 1-Click quick fill buttons
        if (elements.btnQuickFillStudent) {
            elements.btnQuickFillStudent.addEventListener('click', () => {
                setModalRole('STUDENT');
                if (elements.loginUsernameInput) elements.loginUsernameInput.value = "21BCE1024";
                if (elements.loginPasswordInput) elements.loginPasswordInput.value = "student123";
            });
        }

        if (elements.btnQuickFillAdmin) {
            elements.btnQuickFillAdmin.addEventListener('click', () => {
                setModalRole('ADMIN');
                if (elements.loginUsernameInput) elements.loginUsernameInput.value = "LIB-8842";
                if (elements.loginPasswordInput) elements.loginPasswordInput.value = "admin123";
            });
        }

        // Form Submission
        if (elements.loginForm) {
            elements.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = elements.loginUsernameInput ? elements.loginUsernameInput.value.trim() : '';
                const password = elements.loginPasswordInput ? elements.loginPasswordInput.value : '';

                if (!username || !password) {
                    if (elements.loginErrorAlert) {
                        elements.loginErrorAlert.textContent = "Please fill in all credentials.";
                        elements.loginErrorAlert.style.display = 'block';
                    }
                    return;
                }

                const submitBtn = elements.loginForm.querySelector('button[type="submit"]');
                try {
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = "Signing In...";
                    }

                    const user = await API.login({
                        username,
                        password,
                        role: activeModalRole
                    });

                    State.login(user);
                    closeLoginModal();
                    SeatDetails.showToast(`Welcome back, ${user.name}!`);

                    // Re-render seat details panel if a seat is currently inspected
                    if (State.get().selectedSeat) {
                        SeatDetails.render();
                    }
                } catch (err) {
                    console.error('Login error:', err);
                    if (elements.loginErrorAlert) {
                        elements.loginErrorAlert.textContent = err.message || "Invalid credentials. Please try again.";
                        elements.loginErrorAlert.style.display = 'block';
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Sign In";
                    }
                }
            });
        }

        // Subscribe to authStateChange
        State.subscribe('authStateChange', (user) => {
            updateAuthUI(user);
        });
    }

    /**
     * Load Floor Data and Initialize Floor Tabs
     */
    async function loadFloors() {
        try {
            const floors = await API.getFloors();
            State.setFloors(floors);
            renderFloorTabs(floors);
        } catch (err) {
            console.error('Failed to load floors:', err);
        }
    }

    /**
     * Render Floor Selector Tabs with Live Seat Availability Counts
     */
    function renderFloorTabs(floors) {
        if (!elements.floorTabsContainer) return;

        const currentFloor = State.get().currentFloor;

        const tabLabels = {
            "GROUND": { name: "Ground Floor", tag: "Main Hall" },
            "F1": { name: "1st Floor", tag: "Digital Library" },
            "F2": { name: "2nd Floor", tag: "Periodicals" },
            "F3": { name: "3rd Floor", tag: "Silent Hall" },
            "F4": { name: "4th Floor", tag: "Research Wing" }
        };

        let html = '';
        floors.forEach(f => {
            const isActive = f.floor_id === currentFloor;
            const meta = tabLabels[f.floor_id] || { name: f.floor_id, tag: '' };

            html += `
                <button class="floor-tab ${isActive ? 'active' : ''}"
                        data-floor-id="${f.floor_id}"
                        role="tab"
                        aria-selected="${isActive}">
                    <div class="floor-tab-main">
                        <span class="floor-tab-name">${meta.name}</span>
                        <span class="floor-tab-sub">${meta.tag}</span>
                    </div>
                    <span class="floor-avail-badge" title="${f.available} seats currently available">
                        ${f.available} open
                    </span>
                </button>
            `;
        });

        elements.floorTabsContainer.innerHTML = html;

        // Bind tab clicks
        const tabBtns = elements.floorTabsContainer.querySelectorAll('.floor-tab');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const floorId = btn.getAttribute('data-floor-id');
                if (floorId !== State.get().currentFloor) {
                    await switchFloor(floorId);
                }
            });
        });
    }

    /**
     * Switch Active Floor
     */
    async function switchFloor(floorId) {
        State.setCurrentFloor(floorId);

        // Fetch seats for this floor
        const seats = await API.getSeats({ floor: floorId });
        State.setCurrentSeats(seats);

        // Update active tab styles
        const tabBtns = elements.floorTabsContainer.querySelectorAll('.floor-tab');
        tabBtns.forEach(btn => {
            const active = btn.getAttribute('data-floor-id') === floorId;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active);
        });

        updateFilterCounter();
    }

    /**
     * Update Seats Count Label
     */
    function updateFilterCounter() {
        if (!elements.seatsCountBadge) return;
        const state = State.get();
        const total = state.currentSeats.length;
        const filters = state.filters;

        const matching = state.currentSeats.filter(s => {
            if (filters.searchQuery) {
                const q = filters.searchQuery.toUpperCase();
                if (!s.id.toUpperCase().includes(q) &&
                    !s.zone.toUpperCase().includes(q) &&
                    !s.category.toUpperCase().includes(q)) return false;
            }
            if (filters.category && s.category.toUpperCase() !== filters.category.toUpperCase()) return false;
            if (filters.availableOnly && s.status !== 'AVAILABLE') return false;
            return true;
        });

        elements.seatsCountBadge.textContent = `${matching.length} of ${total} seats shown`;
    }

    /**
     * Switch View Tabs (Library Map, All Floors, Favorites, Recents, Stats)
     */
    function switchView(tabKey) {
        State.setActiveTab(tabKey);

        elements.navItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-tab') === tabKey);
        });

        elements.viewContainers.forEach(container => {
            const target = container.getAttribute('data-view');
            container.classList.toggle('active-view', target === tabKey);
        });

        // Special render hooks
        if (tabKey === 'floors') renderAllFloorsView();
        if (tabKey === 'favorites') renderFavoritesView();
        if (tabKey === 'recent') renderRecentSeatsView();
        if (tabKey === 'stats') renderStatisticsView();
    }

    /**
     * Render "All Floors" View
     */
    async function renderAllFloorsView() {
        const container = document.getElementById('view-all-floors');
        if (!container) return;

        const floors = await API.getFloors();

        const floorDescriptions = {
            "GROUND": "Main circulation counter, reception, turnstiles, and open study area with large north-facing garden windows.",
            "F1": "Digital media wing featuring high-speed PC workstations, multimedia pods, audio-visual carrels, and dev tables.",
            "F2": "Quiet periodical section with current journals, magazines, bound reference volumes, and quiet perimeter reading counters.",
            "F3": "Silent deep focus hall with acoustic high-divider carrels, private window desks, and absolute silence policy.",
            "F4": "Dedicated research scholar wing, doctoral thesis repository, patent archives, and collaborative faculty tables."
        };

        let html = `
            <div class="view-header">
                <h2>All Library Floors Overview</h2>
                <p>Compare real-time individual and side seat occupancy across all 5 library levels.</p>
            </div>
            <div class="floors-overview-grid">
        `;

        floors.forEach(f => {
            const pct = f.total > 0 ? Math.round((f.available / f.total) * 100) : 0;
            const desc = floorDescriptions[f.floor_id] || "Library study zone";

            html += `
                <div class="floor-overview-card">
                    <div class="floor-card-top">
                        <div class="floor-info">
                            <span class="floor-tag">${f.floor_id}</span>
                            <h3>${f.name}</h3>
                        </div>
                        <div class="floor-pct-ring">
                            <span class="pct-num">${pct}%</span>
                            <span class="pct-label">Available</span>
                        </div>
                    </div>

                    <p class="floor-desc">${desc}</p>

                    <!-- Availability Bar -->
                    <div class="avail-bar-wrap">
                        <div class="avail-bar" style="width: ${pct}%"></div>
                    </div>

                    <div class="floor-stats-row">
                        <span class="stat-pill avail">🟢 ${f.available} Vacant</span>
                        <span class="stat-pill occ">🔴 ${f.occupied} Occupied</span>
                        <span class="stat-pill unavail">⚪ ${f.unavailable} Inactive</span>
                        <span class="stat-pill total">Total: ${f.total}</span>
                    </div>

                    <div class="floor-card-footer">
                        <button class="btn btn-primary btn-block btn-open-floor" data-target-floor="${f.floor_id}">
                            Open ${f.floor_id} Map →
                        </button>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

        // Bind "Open Floor" buttons
        container.querySelectorAll('.btn-open-floor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fId = btn.getAttribute('data-target-floor');
                switchView('map');
                await switchFloor(fId);
            });
        });
    }

    /**
     * Render "Favorites" View
     */
    async function renderFavoritesView() {
        const container = document.getElementById('view-favorites');
        if (!container) return;

        const state = State.get();
        const favIds = state.favorites;

        if (favIds.length === 0) {
            container.innerHTML = `
                <div class="view-header">
                    <h2>My Favorite Seats</h2>
                    <p>Quick access to your preferred library spots.</p>
                </div>
                <div class="empty-list-panel">
                    <span class="empty-emoji">⭐</span>
                    <h3>No Favorite Seats Saved Yet</h3>
                    <p>Click the <strong>☆ Add to Favorites</strong> button on any seat's details panel to bookmark it here.</p>
                    <button class="btn btn-outline" id="btn-fav-goto-map">Browse Library Map</button>
                </div>
            `;
            container.querySelector('#btn-fav-goto-map')?.addEventListener('click', () => switchView('map'));
            return;
        }

        // Fetch details for all favorited seats
        const favSeats = [];
        for (const id of favIds) {
            const s = await API.getSeatById(id);
            if (s) favSeats.push(s);
        }

        let html = `
            <div class="view-header">
                <h2>My Favorite Seats (${favSeats.length})</h2>
                <p>Saved spots stored in your browser's local storage for one-click access.</p>
            </div>
            <div class="seats-cards-grid">
        `;

        favSeats.forEach(s => {
            html += `
                <div class="seat-card-item status-${s.status.toLowerCase()}">
                    <div class="card-item-header">
                        <span class="cat-pill">${s.category} SEAT</span>
                        <span class="status-pill status-${s.status.toLowerCase()}">${s.status}</span>
                    </div>
                    <h3 class="seat-id-big">${s.id}</h3>
                    <p class="seat-loc">Floor: <strong>${s.floor_id}</strong> &nbsp;•&nbsp; ${s.zone}</p>
                    <div class="card-item-actions">
                        <button class="btn btn-primary-sm btn-view-fav" data-seat-id="${s.id}" data-floor-id="${s.floor_id}">
                            View on Map
                        </button>
                        <button class="btn btn-outline-sm btn-remove-fav" data-seat-id="${s.id}">
                            Remove
                        </button>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

        // Bind events
        container.querySelectorAll('.btn-view-fav').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sId = btn.getAttribute('data-seat-id');
                const fId = btn.getAttribute('data-floor-id');
                switchView('map');
                if (State.get().currentFloor !== fId) {
                    await switchFloor(fId);
                }
                const seat = await API.getSeatById(sId);
                State.setSelectedSeat(seat);
            });
        });

        container.querySelectorAll('.btn-remove-fav').forEach(btn => {
            btn.addEventListener('click', () => {
                const sId = btn.getAttribute('data-seat-id');
                State.toggleFavorite(sId);
                renderFavoritesView();
            });
        });
    }

    /**
     * Render "Recent Seats" View
     */
    function renderRecentSeatsView() {
        const container = document.getElementById('view-recent');
        if (!container) return;

        const recents = State.get().recents;

        if (recents.length === 0) {
            container.innerHTML = `
                <div class="view-header">
                    <h2>Recently Viewed Seats</h2>
                    <p>Track seats you have inspected during this session.</p>
                </div>
                <div class="empty-list-panel">
                    <span class="empty-emoji">🕒</span>
                    <h3>No Recent Seats</h3>
                    <p>Seats you inspect on the map will automatically appear here.</p>
                    <button class="btn btn-outline" id="btn-recent-goto-map">Explore Map</button>
                </div>
            `;
            container.querySelector('#btn-recent-goto-map')?.addEventListener('click', () => switchView('map'));
            return;
        }

        let html = `
            <div class="view-header">
                <h2>Recently Viewed Seats (${recents.length})</h2>
                <p>History of seats you recently inspected on the floor maps.</p>
            </div>
            <div class="seats-cards-grid">
        `;

        recents.forEach(s => {
            html += `
                <div class="seat-card-item status-${s.status.toLowerCase()}">
                    <div class="card-item-header">
                        <span class="cat-pill">${s.category} SEAT</span>
                        <span class="time-tag">Viewed at ${s.viewedAt}</span>
                    </div>
                    <h3 class="seat-id-big">${s.id}</h3>
                    <p class="seat-loc">Floor: <strong>${s.floor_id}</strong> &nbsp;•&nbsp; ${s.zone}</p>
                    <div class="card-item-actions">
                        <button class="btn btn-primary-sm btn-view-recent" data-seat-id="${s.id}" data-floor-id="${s.floor_id}">
                            Inspect Seat →
                        </button>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

        container.querySelectorAll('.btn-view-recent').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sId = btn.getAttribute('data-seat-id');
                const fId = btn.getAttribute('data-floor-id');
                switchView('map');
                if (State.get().currentFloor !== fId) {
                    await switchFloor(fId);
                }
                const seat = await API.getSeatById(sId);
                State.setSelectedSeat(seat);
            });
        });
    }

    /**
     * Render "Statistics" View
     */
    async function renderStatisticsView() {
        const container = document.getElementById('view-stats');
        if (!container) return;

        const stats = await API.getStats();
        const floors = await API.getFloors();

        const occPct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
        const availPct = stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0;

        container.innerHTML = `
            <div class="view-header">
                <h2>Library Occupancy & DSA Analytics</h2>
                <p>Real-time statistics fetched from the C backend and hash-table data structures.</p>
            </div>

            <!-- Top Level Metrics -->
            <div class="stats-top-grid">
                <div class="metric-card">
                    <span class="metric-label">Total Seats</span>
                    <strong class="metric-num">${stats.total}</strong>
                    <span class="metric-sub">Across 5 Illustrative Floors</span>
                </div>
                <div class="metric-card metric-avail">
                    <span class="metric-label">Available (Vacant)</span>
                    <strong class="metric-num">${stats.available}</strong>
                    <span class="metric-sub">${availPct}% of total capacity</span>
                </div>
                <div class="metric-card metric-occ">
                    <span class="metric-label">Occupied (In Use)</span>
                    <strong class="metric-num">${stats.occupied}</strong>
                    <span class="metric-sub">${occPct}% current occupancy</span>
                </div>
                <div class="metric-card metric-unavail">
                    <span class="metric-label">Unavailable (Maintenance)</span>
                    <strong class="metric-num">${stats.unavailable}</strong>
                    <span class="metric-sub">Blocked / Reserved</span>
                </div>
            </div>

            <!-- Focus Categories: Side vs Corner vs Individual -->
            <div class="analytics-row">
                <div class="card-analytics">
                    <h3>🎯 Key Seat Category Breakdown</h3>
                    <div class="category-breakdown-list">
                        <div class="cat-stat-row">
                            <div class="cat-stat-name">
                                <span>🪟 Side Seats (Wall & Windows)</span>
                                <strong>${stats.side_seats.available} / ${stats.side_seats.total} open</strong>
                            </div>
                            <div class="avail-bar-wrap">
                                <div class="avail-bar" style="width: ${Math.round((stats.side_seats.available / stats.side_seats.total) * 100)}%"></div>
                            </div>
                        </div>

                        <div class="cat-stat-row">
                            <div class="cat-stat-name">
                                <span>📐 Corner Seats (Quiet Pods)</span>
                                <strong>${stats.corner_seats.available} / ${stats.corner_seats.total} open</strong>
                            </div>
                            <div class="avail-bar-wrap">
                                <div class="avail-bar" style="width: ${Math.round((stats.corner_seats.available / stats.corner_seats.total) * 100)}%"></div>
                            </div>
                        </div>

                        <div class="cat-stat-row">
                            <div class="cat-stat-name">
                                <span>💻 Individual Study Carrels</span>
                                <strong>${stats.individual_seats.available} / ${stats.individual_seats.total} open</strong>
                            </div>
                            <div class="avail-bar-wrap">
                                <div class="avail-bar" style="width: ${Math.round((stats.individual_seats.available / stats.individual_seats.total) * 100)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- C Backend DSA Diagnostics -->
                <div class="card-analytics">
                    <h3>⚡ C Backend DSA Implementation Diagnostics</h3>
                    <div class="dsa-diagnostics-box">
                        <div class="dsa-diag-row">
                            <span>Hash Table Algorithm:</span>
                            <code>DJB2 (hash * 33 + c)</code>
                        </div>
                        <div class="dsa-diag-row">
                            <span>Collision Handling:</span>
                            <code>Separate Chaining (Linked List)</code>
                        </div>
                        <div class="dsa-diag-row">
                            <span>Bucket Capacity:</span>
                            <code>${stats.hash_table_size} Buckets (Prime Size)</code>
                        </div>
                        <div class="dsa-diag-row">
                            <span>Hash Collisions Count:</span>
                            <code>${stats.collision_count} collisions across ${stats.total} keys</code>
                        </div>
                        <div class="dsa-diag-row">
                            <span>Exact ID Lookup Complexity:</span>
                            <span class="badge-complexity">Average O(1)</span>
                        </div>
                        <div class="dsa-diag-row">
                            <span>Multi-Filter Search Complexity:</span>
                            <span class="badge-complexity">Linear O(n)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Floor by floor table -->
            <div class="card-analytics mt-4">
                <h3>🏢 Floor-by-Floor Occupancy Distribution</h3>
                <div class="table-responsive">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Floor ID</th>
                                <th>Floor Description</th>
                                <th>Total</th>
                                <th>Available</th>
                                <th>Occupied</th>
                                <th>Occupancy Rate</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${floors.map(f => {
                                const rate = f.total > 0 ? Math.round((f.occupied / f.total) * 100) : 0;
                                return `
                                    <tr>
                                        <td><strong>${f.floor_id}</strong></td>
                                        <td>${f.name}</td>
                                        <td>${f.total}</td>
                                        <td><span class="stat-pill avail">${f.available} open</span></td>
                                        <td><span class="stat-pill occ">${f.occupied} busy</span></td>
                                        <td>
                                            <div class="table-rate-wrap">
                                                <span>${rate}%</span>
                                                <div class="mini-bar-wrap"><div class="mini-bar" style="width: ${rate}%"></div></div>
                                            </div>
                                        </td>
                                        <td>
                                            <button class="btn btn-outline-xs btn-table-floor" data-floor="${f.floor_id}">
                                                View Map
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.querySelectorAll('.btn-table-floor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fId = btn.getAttribute('data-floor');
                switchView('map');
                await switchFloor(fId);
            });
        });
    }

    /**
     * Bind Search Bar & Instant ID lookup
     */
    function bindSearchEvents() {
        if (!elements.searchInput) return;

        const handleSearchInput = async () => {
            const query = elements.searchInput.value.trim();
            State.setFilter('searchQuery', query);

            if (elements.searchClearBtn) {
                elements.searchClearBtn.style.display = query ? 'block' : 'none';
            }

            // If user enters an exact seat ID (e.g., G-S01, F1-C02)
            if (/^(G|F[1-4])-[SCIMGT][0-9]{2}$/i.test(query)) {
                const target = await API.getSeatById(query);
                if (target) {
                    if (State.get().currentFloor !== target.floor_id) {
                        await switchFloor(target.floor_id);
                    }
                    State.setSelectedSeat(target);
                }
            }

            updateFilterCounter();
        };

        elements.searchInput.addEventListener('input', handleSearchInput);

        elements.searchInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = elements.searchInput.value.trim();
                if (query) {
                    const target = await API.getSeatById(query);
                    if (target) {
                        if (State.get().currentFloor !== target.floor_id) {
                            await switchFloor(target.floor_id);
                        }
                        State.setSelectedSeat(target);
                        SeatDetails.showToast(`Found seat ${target.id} on ${target.floor_id}`);
                    } else {
                        SeatDetails.showToast(`Seat ${query} not found`, true);
                    }
                }
            }
        });

        if (elements.searchClearBtn) {
            elements.searchClearBtn.addEventListener('click', () => {
                elements.searchInput.value = '';
                elements.searchClearBtn.style.display = 'none';
                State.setFilter('searchQuery', '');
                updateFilterCounter();
                elements.searchInput.focus();
            });
        }
    }

    /**
     * Bind Filter Bar Controls
     */
    function bindFilterEvents() {
        // Category dropdown
        if (elements.categoryFilter) {
            elements.categoryFilter.addEventListener('change', (e) => {
                State.setFilter('category', e.target.value);
                updateFilterCounter();
            });
        }

        // Available Only checkbox
        if (elements.availableToggle) {
            elements.availableToggle.addEventListener('change', (e) => {
                State.setFilter('availableOnly', e.target.checked);
                updateFilterCounter();
            });
        }

        // Quick action: Side seats
        if (elements.btnQuickSide) {
            elements.btnQuickSide.addEventListener('click', () => {
                if (elements.categoryFilter) elements.categoryFilter.value = 'SIDE';
                if (elements.availableToggle) elements.availableToggle.checked = true;
                State.setFilter('category', 'SIDE');
                State.setFilter('availableOnly', true);
                updateFilterCounter();
                SeatDetails.showToast("Filtered: Available Side Seats");
            });
        }

        // Quick action: Corner seats
        if (elements.btnQuickCorner) {
            elements.btnQuickCorner.addEventListener('click', () => {
                if (elements.categoryFilter) elements.categoryFilter.value = 'CORNER';
                if (elements.availableToggle) elements.availableToggle.checked = true;
                State.setFilter('category', 'CORNER');
                State.setFilter('availableOnly', true);
                updateFilterCounter();
                SeatDetails.showToast("Filtered: Available Corner Pods");
            });
        }

        // Reset filters button
        if (elements.btnResetFilters) {
            elements.btnResetFilters.addEventListener('click', () => {
                if (elements.categoryFilter) elements.categoryFilter.value = '';
                if (elements.availableToggle) elements.availableToggle.checked = false;
                if (elements.searchInput) {
                    elements.searchInput.value = '';
                    if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'none';
                }
                State.resetFilters();
                updateFilterCounter();
                SeatDetails.showToast("Filters reset to default");
            });
        }
    }

    /**
     * Bind Sidebar Navigation Tabs
     */
    function bindNavEvents() {
        elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                switchView(tab);
            });
        });
    }

    /**
     * Retry Backend Connection
     */
    if (elements.btnRetryConnection) {
        elements.btnRetryConnection.addEventListener('click', async () => {
            SeatDetails.showToast("Checking C Backend Connection...");
            const health = await API.checkBackendHealth();
            updateConnectionUI(health);
            await loadFloors();
            await switchFloor(State.get().currentFloor);
            if (health.online) {
                SeatDetails.showToast("Connected to C Backend Server!");
            } else {
                SeatDetails.showToast("Backend offline. Continuing in Demo Mode.", true);
            }
        });
    }

    // ==========================================
    // INITIALIZATION SEQUENCE
    // ==========================================
    async function init() {
        console.log("Initializing SideSeat VIT Library Seat Finder...");

        // 1. Check backend health
        const health = await API.checkBackendHealth();
        updateConnectionUI(health);

        // 2. Setup Authentication UI and events
        updateAuthUI(State.getUser());
        bindAuthEvents();

        // 3. First opening check: If user is not yet logged in, immediately present Login screen
        if (!State.isAuthenticated()) {
            openLoginModal('STUDENT');
        }

        // 4. Bind UI event listeners
        bindNavEvents();
        bindSearchEvents();
        bindFilterEvents();

        // 5. Load floors and initial floor seats
        await loadFloors();
        await switchFloor('GROUND');

        // 6. Render initial map and empty details panel
        FloorMap.render();
        SeatDetails.render();
    }

    init();
});
