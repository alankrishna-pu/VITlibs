#include "seat.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/* Global Authoritative Storage */
Seat g_seats[MAX_SEATS];
int g_seat_count = 0;
HashTable g_seat_ht;
char g_data_filepath[256] = "data/seats.csv";

/* Helper: Status conversion */
const char* seat_status_to_string(SeatStatus status) {
    switch (status) {
        case STATUS_AVAILABLE:   return "AVAILABLE";
        case STATUS_OCCUPIED:    return "OCCUPIED";
        case STATUS_UNAVAILABLE: return "UNAVAILABLE";
        default:                 return "UNKNOWN";
    }
}

SeatStatus seat_status_from_string(const char *str) {
    if (!str) return STATUS_UNAVAILABLE;
    if (strcasecmp(str, "AVAILABLE") == 0) return STATUS_AVAILABLE;
    if (strcasecmp(str, "OCCUPIED") == 0) return STATUS_OCCUPIED;
    return STATUS_UNAVAILABLE;
}

bool seat_status_is_valid(const char *str) {
    if (!str) return false;
    return (strcasecmp(str, "AVAILABLE") == 0 ||
            strcasecmp(str, "OCCUPIED") == 0 ||
            strcasecmp(str, "UNAVAILABLE") == 0);
}

bool seat_category_is_valid(const char *str) {
    if (!str) return false;
    return (strcasecmp(str, "SIDE") == 0 ||
            strcasecmp(str, "CORNER") == 0 ||
            strcasecmp(str, "INDIVIDUAL") == 0 ||
            strcasecmp(str, "MIDDLE") == 0 ||
            strcasecmp(str, "GROUP") == 0);
}

/* =========================================================================
 * B. HASH TABLE IMPLEMENTATION
 * =========================================================================
 * We use DJB2 hash algorithm:
 *   hash = ((hash << 5) + hash) + c  => hash * 33 + c
 * DJB2 provides excellent uniform distribution across strings with low collisions.
 *
 * Collision Resolution: Separate Chaining
 * If two distinct seat IDs produce the same bucket index (hash % HASH_TABLE_SIZE),
 * they are prepended as a linked list in the bucket.
 *
 * Complexity:
 *   - Average Case: O(1) time complexity for lookup, insert, and delete.
 *   - Worst Case: O(n) if all keys hash to the same bucket (degenerative list).
 * ========================================================================= */

void ht_init(HashTable *ht) {
    if (!ht) return;
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        ht->buckets[i] = NULL;
    }
    ht->count = 0;
}

unsigned int ht_hash(const char *key) {
    if (!key) return 0;
    unsigned long hash = 5381;
    int c;
    while ((c = *key++)) {
        /* Case-insensitive hashing for user convenience (e.g. g-s01 == G-S01) */
        hash = ((hash << 5) + hash) + (unsigned char)toupper(c);
    }
    return (unsigned int)(hash % HASH_TABLE_SIZE);
}

bool ht_insert(HashTable *ht, Seat *seat) {
    if (!ht || !seat) return false;

    unsigned int index = ht_hash(seat->id);

    /* Check if already present in chain; if so, update pointer */
    HashNode *curr = ht->buckets[index];
    while (curr) {
        if (strcasecmp(curr->id, seat->id) == 0) {
            curr->seat_ptr = seat;
            return true;
        }
        curr = curr->next;
    }

    /* Allocate new node and prepend to bucket chain (separate chaining) */
    HashNode *new_node = (HashNode*)malloc(sizeof(HashNode));
    if (!new_node) return false;

    strncpy(new_node->id, seat->id, sizeof(new_node->id) - 1);
    new_node->id[sizeof(new_node->id) - 1] = '\0';
    new_node->seat_ptr = seat;
    new_node->next = ht->buckets[index];
    ht->buckets[index] = new_node;
    ht->count++;

    return true;
}

Seat* ht_lookup(HashTable *ht, const char *key) {
    if (!ht || !key) return NULL;

    unsigned int index = ht_hash(key);
    HashNode *curr = ht->buckets[index];

    /* Traverse the collision chain */
    while (curr) {
        if (strcasecmp(curr->id, key) == 0) {
            return curr->seat_ptr;
        }
        curr = curr->next;
    }

    return NULL; /* Not found */
}

void ht_free(HashTable *ht) {
    if (!ht) return;
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        HashNode *curr = ht->buckets[i];
        while (curr) {
            HashNode *temp = curr;
            curr = curr->next;
            free(temp);
        }
        ht->buckets[i] = NULL;
    }
    ht->count = 0;
}

int ht_get_collision_count(const HashTable *ht) {
    if (!ht) return 0;
    int collisions = 0;
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        int chain_len = 0;
        HashNode *curr = ht->buckets[i];
        while (curr) {
            chain_len++;
            curr = curr->next;
        }
        if (chain_len > 1) {
            collisions += (chain_len - 1);
        }
    }
    return collisions;
}

/* =========================================================================
 * C. LINEAR SEARCH IMPLEMENTATION
 * =========================================================================
 * Scans through the authoritative in-memory array `g_seats` sequentially from
 * index 0 to `g_seat_count - 1`.
 *
 * Why O(n)?
 * In the worst and general case, every seat element in the array must be checked
 * against the filter criteria (floor, category, availability) because the array
 * is unsorted across multi-attribute queries. Thus time complexity is O(n),
 * where n is g_seat_count.
 * ========================================================================= */

int linear_search_seats(Seat *results[], int max_results,
                        const char *floor_filter,
                        const char *category_filter,
                        int available_only) {
    int matches = 0;

    for (int i = 0; i < g_seat_count && matches < max_results; i++) {
        Seat *seat = &g_seats[i];

        /* Filter by floor */
        if (floor_filter && strlen(floor_filter) > 0) {
            if (strcasecmp(seat->floor_id, floor_filter) != 0) {
                continue;
            }
        }

        /* Filter by category (e.g. "SIDE", "CORNER", etc.) */
        if (category_filter && strlen(category_filter) > 0) {
            if (strcasecmp(seat->category, category_filter) != 0) {
                continue;
            }
        }

        /* Filter by availability */
        if (available_only) {
            if (seat->status != STATUS_AVAILABLE) {
                continue;
            }
        }

        results[matches++] = seat;
    }

    return matches;
}

/* Find seat by ID using Hash Table for fast O(1) lookup */
Seat* seat_find_by_id(const char *id) {
    return ht_lookup(&g_seat_ht, id);
}

/* Update seat status and persist changes to CSV */
int seat_update_status(const char *id, SeatStatus new_status) {
    Seat *seat = seat_find_by_id(id);
    if (!seat) {
        return -1; /* Seat not found */
    }

    seat->status = new_status;

    /* Persist to disk */
    if (seats_save_to_csv(g_data_filepath) != 0) {
        return -2; /* Persistence error */
    }

    return 0; /* Success */
}

/* =========================================================================
 * PERSISTENCE: CSV READ / WRITE
 * ========================================================================= */

static void trim_whitespace(char *str) {
    if (!str) return;
    char *end;
    while (isspace((unsigned char)*str)) str++;
    if (*str == 0) return;
    end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;
    end[1] = '\0';
}

int seats_load_from_csv(const char *filepath) {
    FILE *fp = fopen(filepath, "r");
    if (!fp) {
        return -1;
    }

    char line[512];
    int loaded = 0;

    /* Clear existing hash table */
    ht_free(&g_seat_ht);
    ht_init(&g_seat_ht);
    g_seat_count = 0;

    /* Read header line */
    if (!fgets(line, sizeof(line), fp)) {
        fclose(fp);
        return -2;
    }

    while (fgets(line, sizeof(line), fp) && g_seat_count < MAX_SEATS) {
        trim_whitespace(line);
        if (strlen(line) == 0) continue;

        char id[20] = {0};
        char floor_id[16] = {0};
        char category[24] = {0};
        char zone[64] = {0};
        char status_str[24] = {0};
        int grid_row = 1;
        int grid_col = 1;

        /* Parse CSV line: id,floor_id,category,zone,status,grid_row,grid_col */
        int parsed = sscanf(line, "%19[^,],%15[^,],%23[^,],%63[^,],%23[^,],%d,%d",
                            id, floor_id, category, zone, status_str, &grid_row, &grid_col);
        if (parsed < 5) {
            continue; /* Skip corrupted line */
        }

        Seat *seat = &g_seats[g_seat_count];
        strncpy(seat->id, id, sizeof(seat->id) - 1);
        strncpy(seat->floor_id, floor_id, sizeof(seat->floor_id) - 1);
        strncpy(seat->category, category, sizeof(seat->category) - 1);
        strncpy(seat->zone, zone, sizeof(seat->zone) - 1);
        seat->status = seat_status_from_string(status_str);
        seat->grid_row = (grid_row > 0) ? grid_row : 1;
        seat->grid_col = (grid_col > 0) ? grid_col : 1;

        /* Insert pointer into hash table */
        ht_insert(&g_seat_ht, seat);

        g_seat_count++;
        loaded++;
    }

    fclose(fp);
    return loaded;
}

int seats_save_to_csv(const char *filepath) {
    /* Write to a temporary file first for atomic safety */
    char temp_path[300];
    snprintf(temp_path, sizeof(temp_path), "%s.tmp", filepath);

    FILE *fp = fopen(temp_path, "w");
    if (!fp) {
        return -1;
    }

    fprintf(fp, "id,floor_id,category,zone,status,grid_row,grid_col\n");
    for (int i = 0; i < g_seat_count; i++) {
        Seat *s = &g_seats[i];
        fprintf(fp, "%s,%s,%s,%s,%s,%d,%d\n",
                s->id,
                s->floor_id,
                s->category,
                s->zone,
                seat_status_to_string(s->status),
                s->grid_row,
                s->grid_col);
    }

    fflush(fp);
    fclose(fp);

    /* Atomic rename */
    if (rename(temp_path, filepath) != 0) {
        return -2;
    }

    return 0;
}

void seats_init_sample_data(void) {
    /* If data/seats.csv already exists, loading handles it.
     * This fallback provides default in-memory initialization if file is missing. */
    g_seat_count = 0;
    ht_init(&g_seat_ht);

    /* Sample fallback seats for Ground floor */
    const char *floors[] = {"GROUND", "F1", "F2", "F3", "F4"};
    const char *prefixes[] = {"G", "F1", "F2", "F3", "F4"};

    for (int f = 0; f < 5; f++) {
        char buf_id[20];
        // 6 Side seats
        for (int i = 1; i <= 6; i++) {
            snprintf(buf_id, sizeof(buf_id), "%s-S%02d", prefixes[f], i);
            Seat *s = &g_seats[g_seat_count++];
            strncpy(s->id, buf_id, sizeof(s->id) - 1);
            strncpy(s->floor_id, floors[f], sizeof(s->floor_id) - 1);
            strncpy(s->category, "SIDE", sizeof(s->category) - 1);
            strncpy(s->zone, (i <= 3) ? "West Wall Perimeter" : "East Wall Glass Front", sizeof(s->zone) - 1);
            s->status = (i % 2 == 0) ? STATUS_OCCUPIED : STATUS_AVAILABLE;
            s->grid_row = (i <= 3) ? (i + 1) : (i - 2);
            s->grid_col = (i <= 3) ? 1 : 8;
            ht_insert(&g_seat_ht, s);
        }
        // 4 Corner seats
        for (int i = 1; i <= 4; i++) {
            snprintf(buf_id, sizeof(buf_id), "%s-C%02d", prefixes[f], i);
            Seat *s = &g_seats[g_seat_count++];
            strncpy(s->id, buf_id, sizeof(s->id) - 1);
            strncpy(s->floor_id, floors[f], sizeof(s->floor_id) - 1);
            strncpy(s->category, "CORNER", sizeof(s->category) - 1);
            strncpy(s->zone, "Quiet Corner Study Pod", sizeof(s->zone) - 1);
            s->status = (i == 2) ? STATUS_OCCUPIED : STATUS_AVAILABLE;
            s->grid_row = (i <= 2) ? 1 : 6;
            s->grid_col = (i % 2 == 1) ? 1 : 8;
            ht_insert(&g_seat_ht, s);
        }
    }
}

int seats_init(const char *filepath) {
    if (filepath) {
        strncpy(g_data_filepath, filepath, sizeof(g_data_filepath) - 1);
    }
    ht_init(&g_seat_ht);

    int loaded = seats_load_from_csv(g_data_filepath);
    if (loaded <= 0) {
        /* Initialize sample data and save to file */
        seats_init_sample_data();
        seats_save_to_csv(g_data_filepath);
        return g_seat_count;
    }
    return loaded;
}

/* =========================================================================
 * STATISTICS
 * ========================================================================= */

void seats_get_stats(int *total, int *available, int *occupied, int *unavailable) {
    int t = 0, a = 0, o = 0, u = 0;
    for (int i = 0; i < g_seat_count; i++) {
        t++;
        switch (g_seats[i].status) {
            case STATUS_AVAILABLE:   a++; break;
            case STATUS_OCCUPIED:    o++; break;
            case STATUS_UNAVAILABLE: u++; break;
        }
    }
    if (total) *total = t;
    if (available) *available = a;
    if (occupied) *occupied = o;
    if (unavailable) *unavailable = u;
}

void seats_get_floor_stats(const char *floor_id, int *total, int *available, int *occupied, int *unavailable) {
    int t = 0, a = 0, o = 0, u = 0;
    if (!floor_id) return;

    for (int i = 0; i < g_seat_count; i++) {
        if (strcasecmp(g_seats[i].floor_id, floor_id) == 0) {
            t++;
            switch (g_seats[i].status) {
                case STATUS_AVAILABLE:   a++; break;
                case STATUS_OCCUPIED:    o++; break;
                case STATUS_UNAVAILABLE: u++; break;
            }
        }
    }
    if (total) *total = t;
    if (available) *available = a;
    if (occupied) *occupied = o;
    if (unavailable) *unavailable = u;
}

/* =========================================================================
 * JSON SERIALIZATION HELPERS
 * ========================================================================= */

int seat_to_json(const Seat *seat, char *buffer, size_t max_len) {
    if (!seat || !buffer || max_len == 0) return -1;

    return snprintf(buffer, max_len,
        "{\"id\":\"%s\",\"floor_id\":\"%s\",\"category\":\"%s\",\"zone\":\"%s\",\"status\":\"%s\",\"grid_row\":%d,\"grid_col\":%d}",
        seat->id,
        seat->floor_id,
        seat->category,
        seat->zone,
        seat_status_to_string(seat->status),
        seat->grid_row,
        seat->grid_col);
}

int seats_array_to_json(Seat *seats[], int count, char *buffer, size_t max_len) {
    if (!buffer || max_len == 0) return -1;

    size_t offset = 0;
    offset += snprintf(buffer + offset, max_len - offset, "[");

    for (int i = 0; i < count; i++) {
        char item_buf[256];
        seat_to_json(seats[i], item_buf, sizeof(item_buf));

        size_t needed = strlen(item_buf) + (i > 0 ? 1 : 0);
        if (offset + needed + 2 >= max_len) {
            break; /* Prevent buffer overflow */
        }

        if (i > 0) {
            offset += snprintf(buffer + offset, max_len - offset, ",");
        }
        offset += snprintf(buffer + offset, max_len - offset, "%s", item_buf);
    }

    offset += snprintf(buffer + offset, max_len - offset, "]");
    return (int)offset;
}

int floors_to_json(char *buffer, size_t max_len) {
    if (!buffer || max_len == 0) return -1;

    const char *floor_ids[] = {"GROUND", "F1", "F2", "F3", "F4"};
    const char *floor_names[] = {
        "Ground Floor (Main Entrance & Reception)",
        "1st Floor (Digital & Media Library)",
        "2nd Floor (Periodicals & General Reference)",
        "3rd Floor (Silent Deep Focus Hall)",
        "4th Floor (Research Scholar & Archives Wing)"
    };

    size_t offset = 0;
    offset += snprintf(buffer + offset, max_len - offset, "[");

    for (int i = 0; i < 5; i++) {
        int total = 0, available = 0, occupied = 0, unavailable = 0;
        seats_get_floor_stats(floor_ids[i], &total, &available, &occupied, &unavailable);

        if (i > 0) {
            offset += snprintf(buffer + offset, max_len - offset, ",");
        }

        offset += snprintf(buffer + offset, max_len - offset,
            "{\"floor_id\":\"%s\",\"name\":\"%s\",\"total\":%d,\"available\":%d,\"occupied\":%d,\"unavailable\":%d}",
            floor_ids[i], floor_names[i], total, available, occupied, unavailable);
    }

    offset += snprintf(buffer + offset, max_len - offset, "]");
    return (int)offset;
}

int stats_to_json(char *buffer, size_t max_len) {
    if (!buffer || max_len == 0) return -1;

    int total = 0, available = 0, occupied = 0, unavailable = 0;
    seats_get_stats(&total, &available, &occupied, &unavailable);

    /* Also count side and corner seat stats */
    int side_total = 0, side_avail = 0;
    int corner_total = 0, corner_avail = 0;
    int indiv_total = 0, indiv_avail = 0;

    for (int i = 0; i < g_seat_count; i++) {
        if (strcasecmp(g_seats[i].category, "SIDE") == 0) {
            side_total++;
            if (g_seats[i].status == STATUS_AVAILABLE) side_avail++;
        } else if (strcasecmp(g_seats[i].category, "CORNER") == 0) {
            corner_total++;
            if (g_seats[i].status == STATUS_AVAILABLE) corner_avail++;
        } else if (strcasecmp(g_seats[i].category, "INDIVIDUAL") == 0) {
            indiv_total++;
            if (g_seats[i].status == STATUS_AVAILABLE) indiv_avail++;
        }
    }

    return snprintf(buffer, max_len,
        "{\"total\":%d,\"available\":%d,\"occupied\":%d,\"unavailable\":%d,"
        "\"side_seats\":{\"total\":%d,\"available\":%d},"
        "\"corner_seats\":{\"total\":%d,\"available\":%d},"
        "\"individual_seats\":{\"total\":%d,\"available\":%d},"
        "\"hash_table_size\":%d,\"collision_count\":%d}",
        total, available, occupied, unavailable,
        side_total, side_avail,
        corner_total, corner_avail,
        indiv_total, indiv_avail,
        HASH_TABLE_SIZE, ht_get_collision_count(&g_seat_ht));
}
