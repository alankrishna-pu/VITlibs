#include "seat.h"
#include "http_server.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    int port = 8080;
    const char *data_file = "data/seats.csv";
    const char *web_root = "frontend";

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-p") == 0 || strcmp(argv[i], "--port") == 0) {
            if (i + 1 < argc) {
                port = atoi(argv[++i]);
            }
        } else if (strcmp(argv[i], "-d") == 0 || strcmp(argv[i], "--data") == 0) {
            if (i + 1 < argc) {
                data_file = argv[++i];
            }
        } else if (strcmp(argv[i], "-w") == 0 || strcmp(argv[i], "--webroot") == 0) {
            if (i + 1 < argc) {
                web_root = argv[++i];
            }
        } else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            printf("SideSeat C Backend Server\n");
            printf("Usage: %s [options]\n", argv[0]);
            printf("Options:\n");
            printf("  -p, --port <port>       Port to listen on (default: 8080)\n");
            printf("  -d, --data <path>       Path to seats CSV file (default: data/seats.csv)\n");
            printf("  -w, --webroot <path>    Frontend directory for static files (default: frontend)\n");
            printf("  -h, --help              Show this help message\n");
            return 0;
        }
    }

    printf("Initializing SideSeat backend data from: %s\n", data_file);
    int count = seats_init(data_file);
    if (count <= 0) {
        fprintf(stderr, "Failed to initialize seat data.\n");
        return 1;
    }

    printf("Successfully initialized %d seats across 5 floors.\n", count);

    int res = http_server_run(port, web_root);
    return res;
}
