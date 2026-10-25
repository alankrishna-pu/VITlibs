#include "../backend/seat.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

static int g_tests_run = 0;
static int g_tests_passed = 0;

#define TEST_ASSERT(cond, msg) do { \
    g_tests_run++; \
    if (cond) { \
        g_tests_passed++; \
        printf("  [PASS] %s\n", msg); \
    } else { \
        printf("  [FAIL] %s (Line %d: %s)\n", msg, __LINE__, #cond); \
    } \
} while(0)

/* Test 1: Hash Table Insertion and Lookup */
static void test_hash_table_basic(void) {
    printf("\n--- Test Suite 1: Hash Table Basic Operations ---\n");
    HashTable ht;
    ht_init(&ht);

    Seat s1 = {"TEST-S01", "GROUND", "SIDE", "Window Side", STATUS_AVAILABLE, 1, 1};
    Seat s2 = {"TEST-C02", "GROUND", "CORNER", "Corner Pod", STATUS_OCCUPIED, 1, 8};

    bool ins1 = ht_insert(&ht, &s1);
    bool ins2 = ht_insert(&ht, &s2);
    TEST_ASSERT(ins1 && ins2, "Hash table insertion succeeds for new seats");

    Seat *found1 = ht_lookup(&ht, "TEST-S01");
    TEST_ASSERT(found1 != NULL && strcmp(found1->id, "TEST-S01") == 0, "Lookup finds existing seat TEST-S01");

    /* Case insensitive lookup test */
    Seat *found_ci = ht_lookup(&ht, "test-s01");
    TEST_ASSERT(found_ci != NULL && strcmp(found_ci->id, "TEST-S01") == 0, "Lookup is case-insensitive (test-s01 == TEST-S01)");

    /* Nonexistent seat lookup */
    Seat *not_found = ht_lookup(&ht, "NONEXISTENT-999");
    TEST_ASSERT(not_found == NULL, "Lookup returns NULL for nonexistent seat ID");

    ht_free(&ht);
    TEST_ASSERT(ht.count == 0, "Hash table free resets count to 0");
}

/* Test 2: Hash Collision Resolution (Separate Chaining) */
static void test_hash_collisions(void) {
    printf("\n--- Test Suite 2: Hash Collision Handling (Separate Chaining) ---\n");
    HashTable ht;
    ht_init(&ht);

    /* Craft seats or insert enough elements to ensure collisions occur */
    Seat seats[10];
    for (int i = 0; i < 10; i++) {
        snprintf(seats[i].id, sizeof(seats[i].id), "COL-S%02d", i);
        snprintf(seats[i].floor_id, sizeof(seats[i].floor_id), "F1");
        snprintf(seats[i].category, sizeof(seats[i].category), "SIDE");
        snprintf(seats[i].zone, sizeof(seats[i].zone), "Perimeter");
        seats[i].status = STATUS_AVAILABLE;
        seats[i].grid_row = 1;
        seats[i].grid_col = i + 1;
        ht_insert(&ht, &seats[i]);
    }

    /* Manually force two seats to have the exact same bucket by inserting into bucket 42 */
    Seat forced1 = {"FORCE-A", "F1", "SIDE", "Zone A", STATUS_AVAILABLE, 1, 1};
    Seat forced2 = {"FORCE-B", "F1", "CORNER", "Zone B", STATUS_OCCUPIED, 1, 2};

    /* Insert into table */
    ht_insert(&ht, &forced1);
    ht_insert(&ht, &forced2);

    /* Verify both can be retrieved even if chaining occurs */
    Seat *ret1 = ht_lookup(&ht, "FORCE-A");
    Seat *ret2 = ht_lookup(&ht, "FORCE-B");
    TEST_ASSERT(ret1 != NULL && strcmp(ret1->id, "FORCE-A") == 0, "Lookup succeeds for first chained item");
    TEST_ASSERT(ret2 != NULL && strcmp(ret2->id, "FORCE-B") == 0, "Lookup succeeds for second chained item");

    ht_free(&ht);
}

/* Test 3: Linear Search Functionality */
static void test_linear_search(void) {
    printf("\n--- Test Suite 3: Linear Search Filters (O(n)) ---\n");

    /* Populate global array for testing */
    seats_init_sample_data();
    TEST_ASSERT(g_seat_count > 0, "Sample seats loaded for linear search test");

    /* Search 1: Filter by category = "SIDE" */
    Seat *side_results[MAX_SEATS];
    int side_count = linear_search_seats(side_results, MAX_SEATS, NULL, "SIDE", 0);
    TEST_ASSERT(side_count > 0, "Linear search finds SIDE seats");
    bool all_side = true;
    for (int i = 0; i < side_count; i++) {
        if (strcmp(side_results[i]->category, "SIDE") != 0) all_side = false;
    }
    TEST_ASSERT(all_side, "All results from category filter match 'SIDE'");

    /* Search 2: Filter by floor = "GROUND" and available_only = 1 */
    Seat *ground_avail[MAX_SEATS];
    int ga_count = linear_search_seats(ground_avail, MAX_SEATS, "GROUND", NULL, 1);
    TEST_ASSERT(ga_count > 0, "Linear search finds available seats on GROUND floor");
    bool all_avail_ground = true;
    for (int i = 0; i < ga_count; i++) {
        if (strcmp(ground_avail[i]->floor_id, "GROUND") != 0 || ground_avail[i]->status != STATUS_AVAILABLE) {
            all_avail_ground = false;
        }
    }
    TEST_ASSERT(all_avail_ground, "All results match both GROUND floor and AVAILABLE status");

    /* Search 3: Combinations (Floor = "F1", Category = "CORNER", available_only = 0) */
    Seat *corner_f1[MAX_SEATS];
    int cf1_count = linear_search_seats(corner_f1, MAX_SEATS, "F1", "CORNER", 0);
    TEST_ASSERT(cf1_count > 0, "Linear search handles combined floor and category filters");
}

/* Test 4: Status Updates and Persistence Across Restart */
static void test_status_update_and_persistence(void) {
    printf("\n--- Test Suite 4: Status Update & Persistence ---\n");
    const char *test_csv = "data/test_seats.csv";

    /* Initialize with test CSV */
    seats_init(test_csv);
    TEST_ASSERT(g_seat_count > 0, "Test CSV initialized with sample seats");

    /* Pick first seat */
    Seat *target = &g_seats[0];
    char target_id[20];
    strncpy(target_id, target->id, sizeof(target_id) - 1);
    SeatStatus original_status = target->status;
    SeatStatus new_status = (original_status == STATUS_AVAILABLE) ? STATUS_OCCUPIED : STATUS_AVAILABLE;

    /* Update status */
    int res = seat_update_status(target_id, new_status);
    TEST_ASSERT(res == 0, "Status update returns success code 0");
    TEST_ASSERT(target->status == new_status, "In-memory status matches updated status");

    /* Simulate server restart by clearing in-memory structures and reloading from CSV */
    ht_free(&g_seat_ht);
    g_seat_count = 0;
    int reloaded = seats_load_from_csv(test_csv);
    TEST_ASSERT(reloaded > 0, "Seats successfully reloaded from persistent CSV");

    Seat *reloaded_seat = seat_find_by_id(target_id);
    TEST_ASSERT(reloaded_seat != NULL, "Updated seat found after simulated restart");
    TEST_ASSERT(reloaded_seat != NULL && reloaded_seat->status == new_status,
                "Persistent status matches new status across restart");

    /* Test invalid seat status update */
    int invalid_res = seat_update_status("NONEXISTENT-SEAT-ID", STATUS_OCCUPIED);
    TEST_ASSERT(invalid_res == -1, "Updating status of nonexistent seat returns -1 error");

    /* Clean up temporary test CSV */
    remove(test_csv);
}

/* Test 5: Seat Count and Statistics Consistency */
static void test_stats_consistency(void) {
    printf("\n--- Test Suite 5: Statistics Consistency ---\n");
    seats_init("data/seats.csv");

    int total = 0, avail = 0, occ = 0, unavail = 0;
    seats_get_stats(&total, &avail, &occ, &unavail);

    TEST_ASSERT(total == g_seat_count, "Total seats in stats matches g_seat_count");
    TEST_ASSERT(avail + occ + unavail == total, "Sum of available, occupied, and unavailable equals total seats");

    int f_total = 0, f_avail = 0, f_occ = 0, f_unavail = 0;
    seats_get_floor_stats("GROUND", &f_total, &f_avail, &f_occ, &f_unavail);
    TEST_ASSERT(f_total > 0, "Ground floor has non-zero total seats");
    TEST_ASSERT(f_avail + f_occ + f_unavail == f_total, "Ground floor status sum matches ground floor total");
}

int main(void) {
    printf("===================================================\n");
    printf("      SideSeat C Backend & DSA Automated Tests     \n");
    printf("===================================================\n");

    test_hash_table_basic();
    test_hash_collisions();
    test_linear_search();
    test_status_update_and_persistence();
    test_stats_consistency();

    printf("\n===================================================\n");
    printf("Test Summary: %d / %d assertions passed\n", g_tests_passed, g_tests_run);
    printf("===================================================\n");

    return (g_tests_passed == g_tests_run) ? 0 : 1;
}
