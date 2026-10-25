#ifndef SEAT_H
#define SEAT_H

#include <stdbool.h>
#include <stddef.h>

#define MAX_SEATS 256
#define HASH_TABLE_SIZE 101

/*
 * SeatStatus: Represents the availability state of a library seat.
 * - STATUS_AVAILABLE: Seat is vacant and ready for student walk-in.
 * - STATUS_OCCUPIED: Seat is currently in use.
 * - STATUS_UNAVAILABLE: Seat is under maintenance or temporarily blocked.
 */
typedef enum {
    STATUS_AVAILABLE = 0,
    STATUS_OCCUPIED = 1,
    STATUS_UNAVAILABLE = 2
} SeatStatus;

/*
 * Seat: Core data structure representing a single seat in the library.
 * Stored in an authoritative array and indexed by a hash table.
 */
typedef struct {
    char id[20];        /* Unique seat identifier, e.g., "G-S01", "F1-C02" */
    char floor_id[16];  /* Floor identifier: "GROUND", "F1", "F2", "F3", "F4" */
    char category[24];  /* Category: "SIDE", "CORNER", "INDIVIDUAL", "MIDDLE", "GROUP" */
    char zone[64];      /* Zone or location description, e.g., "West Wall Window Counters" */
    SeatStatus status;  /* Current status */
    int grid_row;       /* Top-down visual map row position (1-based) */
    int grid_col;       /* Top-down visual map column position (1-based) */
} Seat;

/*
 * HashNode: Linked list node for separate chaining collision resolution.
 */
typedef struct HashNode {
    char id[20];
    Seat *seat_ptr;          /* Pointer to authoritative seat in the main array */
    struct HashNode *next;   /* Next node in chain in case of hash collision */
} HashNode;

/*
 * HashTable: Fixed-size bucket array with separate chaining.
 * Average time complexity for lookup: O(1).
 * Worst-case time complexity: O(n) if all keys hash to the same bucket.
 */
typedef struct {
    HashNode *buckets[HASH_TABLE_SIZE];
    int count;
} HashTable;

/* Authoritative seat array and hash table */
extern Seat g_seats[MAX_SEATS];
extern int g_seat_count;
extern HashTable g_seat_ht;
extern char g_data_filepath[256];

/* Helper functions for status strings */
const char* seat_status_to_string(SeatStatus status);
SeatStatus seat_status_from_string(const char *str);
bool seat_status_is_valid(const char *str);
bool seat_category_is_valid(const char *str);

/* Hash Table Functions */
void ht_init(HashTable *ht);
unsigned int ht_hash(const char *key);
bool ht_insert(HashTable *ht, Seat *seat);
Seat* ht_lookup(HashTable *ht, const char *key);
void ht_free(HashTable *ht);
int ht_get_collision_count(const HashTable *ht);

/* Linear Search Functions:
 * Sequentially scans g_seats to find matching records.
 * Time complexity: O(n) where n is g_seat_count.
 */
int linear_search_seats(Seat *results[], int max_results,
                        const char *floor_filter,
                        const char *category_filter,
                        int available_only);

/* Persistence and Management */
int seats_init(const char *filepath);
int seats_load_from_csv(const char *filepath);
int seats_save_to_csv(const char *filepath);
void seats_init_sample_data(void);
Seat* seat_find_by_id(const char *id);
int seat_update_status(const char *id, SeatStatus new_status);

/* Statistics */
void seats_get_stats(int *total, int *available, int *occupied, int *unavailable);
void seats_get_floor_stats(const char *floor_id, int *total, int *available, int *occupied, int *unavailable);

/* JSON serialization helpers */
int seat_to_json(const Seat *seat, char *buffer, size_t max_len);
int seats_array_to_json(Seat *seats[], int count, char *buffer, size_t max_len);
int floors_to_json(char *buffer, size_t max_len);
int stats_to_json(char *buffer, size_t max_len);

#endif /* SEAT_H */
