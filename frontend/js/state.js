/**
 * SideSeat - State Management
 * Authoritative single source of truth for UI state, filters, favorites, and recents.
 */

const State = (() => {
    const STORAGE_KEY_FAVORITES = 'sideseat_favs_v1';
    const STORAGE_KEY_RECENTS = 'sideseat_recents_v1';
    const STORAGE_KEY_USER = 'sideseat_auth_user_v1';

    // Internal state
    const state = {
        currentFloor: 'GROUND',
        selectedSeat: null,
        floors: [],
        currentSeats: [],
        allLoadedSeats: [], // cache for all floors
        filters: {
            category: '',
            availableOnly: false,
            searchQuery: ''
        },
        currentUser: null,
        role: 'GUEST', // 'STUDENT', 'ADMIN', or 'GUEST'
        activeTab: 'map', // 'map', 'floors', 'favorites', 'recent', 'stats'
        favorites: [],
        recents: [],
        backendStatus: {
            online: false,
            demoMode: false
        }
    };

    // Listeners for reactive updates
    const listeners = {};

    function subscribe(event, callback) {
        if (!listeners[event]) {
            listeners[event] = [];
        }
        listeners[event].push(callback);
    }

    function emit(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`Error in state listener for ${event}:`, e);
                }
            });
        }
    }

    // LocalStorage helpers
    function loadStorage() {
        try {
            const favJson = localStorage.getItem(STORAGE_KEY_FAVORITES);
            state.favorites = favJson ? JSON.parse(favJson) : ['G-S01', 'F1-C02'];
        } catch (e) {
            state.favorites = ['G-S01', 'F1-C02'];
        }

        try {
            const recJson = localStorage.getItem(STORAGE_KEY_RECENTS);
            state.recents = recJson ? JSON.parse(recJson) : [];
        } catch (e) {
            state.recents = [];
        }

        try {
            const userJson = localStorage.getItem(STORAGE_KEY_USER);
            if (userJson) {
                state.currentUser = JSON.parse(userJson);
                state.role = state.currentUser.role || 'STUDENT';
            } else {
                // First open or signed out: default to guest
                state.currentUser = null;
                state.role = 'GUEST';
            }
        } catch (e) {
            state.currentUser = null;
            state.role = 'GUEST';
        }
    }

    function saveUser() {
        try {
            if (state.currentUser) {
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(state.currentUser));
            } else {
                localStorage.removeItem(STORAGE_KEY_USER);
            }
        } catch (e) {
            console.warn('Failed to save user in localStorage', e);
        }
    }

    function saveFavorites() {
        try {
            localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(state.favorites));
        } catch (e) {
            console.warn('Failed to save favorites to localStorage', e);
        }
    }

    function saveRecents() {
        try {
            localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(state.recents.slice(0, 10)));
        } catch (e) {
            console.warn('Failed to save recents to localStorage', e);
        }
    }

    // Initialize storage
    loadStorage();

    return {
        get: () => state,

        subscribe,

        setCurrentFloor: (floorId) => {
            if (state.currentFloor !== floorId) {
                state.currentFloor = floorId;
                state.selectedSeat = null; // deselect seat on floor change
                emit('floorChange', floorId);
            }
        },

        setSelectedSeat: (seat) => {
            state.selectedSeat = seat;
            if (seat) {
                // Add to recents
                State.addRecentSeat(seat);
            }
            emit('seatSelect', seat);
        },

        setFloors: (floors) => {
            state.floors = floors;
            emit('floorsUpdate', floors);
        },

        setCurrentSeats: (seats) => {
            state.currentSeats = seats;
            emit('seatsUpdate', seats);
        },

        setFilter: (key, value) => {
            state.filters[key] = value;
            emit('filterChange', state.filters);
        },

        resetFilters: () => {
            state.filters.category = '';
            state.filters.availableOnly = false;
            state.filters.searchQuery = '';
            emit('filterChange', state.filters);
        },

        setRole: (role) => {
            state.role = (role === 'ADMIN') ? 'ADMIN' : (role === 'GUEST' ? 'GUEST' : 'STUDENT');
            emit('roleChange', state.role);
        },

        login: (user) => {
            state.currentUser = user;
            state.role = user.role || 'STUDENT';
            saveUser();
            emit('authStateChange', user);
            emit('roleChange', state.role);
        },

        logout: () => {
            state.currentUser = null;
            state.role = 'GUEST';
            saveUser();
            emit('authStateChange', null);
            emit('roleChange', 'GUEST');
        },

        getUser: () => state.currentUser,
        isAuthenticated: () => !!state.currentUser,

        setActiveTab: (tab) => {
            state.activeTab = tab;
            emit('tabChange', tab);
        },

        setBackendStatus: (status) => {
            state.backendStatus = status;
            emit('backendStatusChange', status);
        },

        toggleFavorite: (seatId) => {
            const index = state.favorites.indexOf(seatId);
            if (index >= 0) {
                state.favorites.splice(index, 1);
            } else {
                state.favorites.push(seatId);
            }
            saveFavorites();
            emit('favoritesUpdate', state.favorites);
            return state.favorites.includes(seatId);
        },

        isFavorite: (seatId) => {
            return state.favorites.includes(seatId);
        },

        addRecentSeat: (seat) => {
            if (!seat || !seat.id) return;
            // Remove existing duplicate
            state.recents = state.recents.filter(s => s.id !== seat.id);
            // Prepend
            state.recents.unshift({
                id: seat.id,
                floor_id: seat.floor_id,
                category: seat.category,
                zone: seat.zone,
                status: seat.status,
                viewedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            saveRecents();
            emit('recentsUpdate', state.recents);
        },

        updateSeatInState: (updatedSeat) => {
            if (!updatedSeat) return;

            // Update in currentSeats array
            const idx = state.currentSeats.findIndex(s => s.id === updatedSeat.id);
            if (idx >= 0) {
                state.currentSeats[idx] = updatedSeat;
            }

            // Update in selectedSeat if it matches
            if (state.selectedSeat && state.selectedSeat.id === updatedSeat.id) {
                state.selectedSeat = updatedSeat;
            }

            // Update in recents if present
            state.recents.forEach(r => {
                if (r.id === updatedSeat.id) {
                    r.status = updatedSeat.status;
                }
            });
            saveRecents();

            emit('seatUpdated', updatedSeat);
        }
    };
})();
