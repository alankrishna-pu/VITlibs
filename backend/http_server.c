#include "http_server.h"
#include "seat.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <unistd.h>
#include <errno.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define BUFFER_SIZE 65536
#define MAX_PATH_LEN 512

static volatile sig_atomic_t g_running = 1;

void http_server_stop(void) {
    g_running = 0;
}

static void sigint_handler(int sig) {
    (void)sig;
    g_running = 0;
}

/* Helper to get MIME type based on file extension */
static const char* get_mime_type(const char *path) {
    const char *dot = strrchr(path, '.');
    if (!dot) return "application/octet-stream";
    if (strcasecmp(dot, ".html") == 0 || strcasecmp(dot, ".htm") == 0) return "text/html; charset=utf-8";
    if (strcasecmp(dot, ".css") == 0) return "text/css; charset=utf-8";
    if (strcasecmp(dot, ".js") == 0) return "application/javascript; charset=utf-8";
    if (strcasecmp(dot, ".json") == 0) return "application/json; charset=utf-8";
    if (strcasecmp(dot, ".svg") == 0) return "image/svg+xml";
    if (strcasecmp(dot, ".png") == 0) return "image/png";
    if (strcasecmp(dot, ".jpg") == 0 || strcasecmp(dot, ".jpeg") == 0) return "image/jpeg";
    if (strcasecmp(dot, ".ico") == 0) return "image/x-icon";
    if (strcasecmp(dot, ".txt") == 0) return "text/plain; charset=utf-8";
    return "application/octet-stream";
}

/* URL decoder */
static void url_decode(char *dst, const char *src, size_t max_len) {
    size_t d = 0;
    while (*src && d + 1 < max_len) {
        if (*src == '%' && isxdigit((unsigned char)src[1]) && isxdigit((unsigned char)src[2])) {
            char hex[3] = {src[1], src[2], '\0'};
            dst[d++] = (char)strtol(hex, NULL, 16);
            src += 3;
        } else if (*src == '+') {
            dst[d++] = ' ';
            src++;
        } else {
            dst[d++] = *src++;
        }
    }
    dst[d] = '\0';
}

/* Query parameter extraction: returns true if found */
static bool get_query_param(const char *query, const char *param_name, char *out_val, size_t max_len) {
    if (!query || !param_name || !out_val || max_len == 0) return false;
    out_val[0] = '\0';

    size_t name_len = strlen(param_name);
    const char *p = query;

    while (*p) {
        if ((p == query || *(p - 1) == '&') && strncmp(p, param_name, name_len) == 0 && p[name_len] == '=') {
            const char *val_start = p + name_len + 1;
            const char *val_end = strchr(val_start, '&');
            size_t val_len = val_end ? (size_t)(val_end - val_start) : strlen(val_start);

            char temp[256];
            if (val_len >= sizeof(temp)) val_len = sizeof(temp) - 1;
            strncpy(temp, val_start, val_len);
            temp[val_len] = '\0';

            url_decode(out_val, temp, max_len);
            return true;
        }
        p++;
    }
    return false;
}

/* Simple JSON string field extractor */
static bool extract_json_field(const char *json, const char *field_name, char *out_val, size_t max_len) {
    if (!json || !field_name || !out_val || max_len == 0) return false;
    out_val[0] = '\0';

    char key[64];
    snprintf(key, sizeof(key), "\"%s\"", field_name);

    const char *pos = strstr(json, key);
    if (!pos) return false;

    pos += strlen(key);
    while (*pos && (*pos == ' ' || *pos == ':' || *pos == '\t' || *pos == '\r' || *pos == '\n')) {
        pos++;
    }

    if (*pos != '\"') return false;
    pos++; /* skip open quote */

    size_t i = 0;
    while (*pos && *pos != '\"' && i + 1 < max_len) {
        out_val[i++] = *pos++;
    }
    out_val[i] = '\0';
    return (i > 0);
}

static bool extract_json_status(const char *json, char *out_status, size_t max_len) {
    return extract_json_field(json, "status", out_status, max_len);
}

/* Send HTTP Response */
static void send_response(int client_fd, int status_code, const char *status_text,
                          const char *content_type, const char *body, size_t body_len) {
    char header[1024];
    int header_len = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %zu\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, Accept\r\n"
        "Connection: close\r\n"
        "\r\n",
        status_code, status_text,
        content_type ? content_type : "text/plain",
        body_len);

    send(client_fd, header, header_len, 0);
    if (body && body_len > 0) {
        send(client_fd, body, body_len, 0);
    }
}

/* Send JSON Response */
static void send_json_response(int client_fd, int status_code, const char *status_text, const char *json_body) {
    size_t len = json_body ? strlen(json_body) : 0;
    send_response(client_fd, status_code, status_text, "application/json; charset=utf-8", json_body, len);
}

/* Serve Static File */
static void serve_static_file(int client_fd, const char *web_root, const char *req_path) {
    /* Prevent directory traversal */
    if (strstr(req_path, "..")) {
        const char *err = "{\"error\":\"Forbidden path\"}";
        send_json_response(client_fd, 403, "Forbidden", err);
        return;
    }

    char file_path[MAX_PATH_LEN];
    if (strcmp(req_path, "/") == 0) {
        snprintf(file_path, sizeof(file_path), "%s/index.html", web_root);
    } else {
        snprintf(file_path, sizeof(file_path), "%s%s", web_root, req_path);
    }

    FILE *fp = fopen(file_path, "rb");
    if (!fp) {
        char err_msg[256];
        snprintf(err_msg, sizeof(err_msg), "{\"error\":\"File not found: %s\"}", req_path);
        send_json_response(client_fd, 404, "Not Found", err_msg);
        return;
    }

    fseek(fp, 0, SEEK_END);
    long file_size = ftell(fp);
    fseek(fp, 0, SEEK_SET);

    if (file_size < 0) {
        fclose(fp);
        send_json_response(client_fd, 500, "Internal Server Error", "{\"error\":\"Failed to read file\"}");
        return;
    }

    char *file_buf = (char*)malloc(file_size);
    if (!file_buf && file_size > 0) {
        fclose(fp);
        send_json_response(client_fd, 500, "Internal Server Error", "{\"error\":\"Out of memory\"}");
        return;
    }

    if (file_size > 0) {
        fread(file_buf, 1, file_size, fp);
    }
    fclose(fp);

    const char *mime = get_mime_type(file_path);
    send_response(client_fd, 200, "OK", mime, file_buf, (size_t)file_size);
    free(file_buf);
}

/* Route Dispatcher */
static void handle_request(int client_fd, const char *web_root,
                           const char *method, const char *path,
                           const char *query, const char *body) {
    /* Handle CORS preflight */
    if (strcmp(method, "OPTIONS") == 0) {
        send_response(client_fd, 204, "No Content", "text/plain", "", 0);
        return;
    }

    /* 1. GET /api/floors */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/api/floors") == 0) {
        char json[2048];
        floors_to_json(json, sizeof(json));
        send_json_response(client_fd, 200, "OK", json);
        return;
    }

    /* 2. GET /api/stats */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/api/stats") == 0) {
        char json[1024];
        stats_to_json(json, sizeof(json));
        send_json_response(client_fd, 200, "OK", json);
        return;
    }

    /* 2b. POST /api/login */
    if (strcmp(method, "POST") == 0 && strcmp(path, "/api/login") == 0) {
        char username[64] = {0};
        char password[64] = {0};
        char role[32] = {0};
        extract_json_field(body, "username", username, sizeof(username));
        extract_json_field(body, "password", password, sizeof(password));
        extract_json_field(body, "role", role, sizeof(role));

        if (strlen(username) == 0 || strlen(password) == 0) {
            send_json_response(client_fd, 400, "Bad Request", "{\"error\":\"Username and password are required\"}");
            return;
        }

        char resp[512];
        if (strcasecmp(role, "ADMIN") == 0 || strcasecmp(role, "LIBRARIAN") == 0 ||
            strcasecmp(username, "admin") == 0 || strcasecmp(username, "lib_admin") == 0 ||
            strcasecmp(username, "LIB-8842") == 0) {
            snprintf(resp, sizeof(resp),
                "{\"success\":true,\"user\":{\"id\":\"%s\",\"username\":\"%s\",\"name\":\"Dr. K. Ramanathan (Librarian)\",\"email\":\"librarian@vit.ac.in\",\"role\":\"ADMIN\"}}",
                username[0] ? username : "LIB-8842", username);
        } else {
            snprintf(resp, sizeof(resp),
                "{\"success\":true,\"user\":{\"id\":\"%s\",\"username\":\"%s\",\"name\":\"%s\",\"email\":\"%s@vitstudent.ac.in\",\"role\":\"STUDENT\"}}",
                username, username,
                (strcasecmp(username, "21BCE1024") == 0) ? "Arjun Sharma" : username,
                username);
        }
        send_json_response(client_fd, 200, "OK", resp);
        return;
    }

    /* 3. PATCH or POST /api/seats/:id/status */
    if ((strcmp(method, "PATCH") == 0 || strcmp(method, "POST") == 0) &&
        strncmp(path, "/api/seats/", 11) == 0 &&
        strstr(path, "/status") != NULL) {

        /* Extract seat ID between /api/seats/ and /status */
        const char *id_start = path + 11;
        const char *id_end = strstr(path, "/status");
        size_t id_len = id_end - id_start;
        char seat_id[32] = {0};

        if (id_len >= sizeof(seat_id)) id_len = sizeof(seat_id) - 1;
        strncpy(seat_id, id_start, id_len);
        seat_id[id_len] = '\0';

        char new_status_str[32] = {0};
        if (!extract_json_status(body, new_status_str, sizeof(new_status_str))) {
            send_json_response(client_fd, 400, "Bad Request", "{\"error\":\"Missing or invalid 'status' field in JSON body\"}");
            return;
        }

        if (!seat_status_is_valid(new_status_str)) {
            send_json_response(client_fd, 400, "Bad Request", "{\"error\":\"Invalid status. Must be AVAILABLE, OCCUPIED, or UNAVAILABLE\"}");
            return;
        }

        SeatStatus new_status = seat_status_from_string(new_status_str);
        int res = seat_update_status(seat_id, new_status);
        if (res == -1) {
            char err[128];
            snprintf(err, sizeof(err), "{\"error\":\"Seat '%s' not found\"}", seat_id);
            send_json_response(client_fd, 404, "Not Found", err);
            return;
        } else if (res == -2) {
            send_json_response(client_fd, 500, "Internal Server Error", "{\"error\":\"Failed to persist update to disk\"}");
            return;
        }

        /* Success: Return updated seat */
        Seat *updated_seat = seat_find_by_id(seat_id);
        char json[512];
        seat_to_json(updated_seat, json, sizeof(json));
        send_json_response(client_fd, 200, "OK", json);
        return;
    }

    /* 4. GET /api/seats/:id (Direct Hash Table lookup) */
    if (strcmp(method, "GET") == 0 && strncmp(path, "/api/seats/", 11) == 0) {
        const char *seat_id = path + 11;
        if (strlen(seat_id) > 0 && strchr(seat_id, '/') == NULL) {
            /* Uses Hash Table for O(1) lookup */
            Seat *seat = seat_find_by_id(seat_id);
            if (!seat) {
                char err[128];
                snprintf(err, sizeof(err), "{\"error\":\"Seat '%s' not found\"}", seat_id);
                send_json_response(client_fd, 404, "Not Found", err);
                return;
            }

            char json[512];
            seat_to_json(seat, json, sizeof(json));
            send_json_response(client_fd, 200, "OK", json);
            return;
        }
    }

    /* 5. GET /api/seats (Linear search with filters) */
    if (strcmp(method, "GET") == 0 && strcmp(path, "/api/seats") == 0) {
        char floor_param[32] = {0};
        char type_param[32] = {0};
        char avail_param[32] = {0};

        get_query_param(query, "floor", floor_param, sizeof(floor_param));
        if (!get_query_param(query, "type", type_param, sizeof(type_param))) {
            get_query_param(query, "category", type_param, sizeof(type_param));
        }
        get_query_param(query, "available", avail_param, sizeof(avail_param));

        int available_only = 0;
        if (strcasecmp(avail_param, "true") == 0 || strcmp(avail_param, "1") == 0) {
            available_only = 1;
        }

        Seat *matches[MAX_SEATS];
        int count = linear_search_seats(matches, MAX_SEATS,
                                        floor_param[0] ? floor_param : NULL,
                                        type_param[0] ? type_param : NULL,
                                        available_only);

        char *json = (char*)malloc(BUFFER_SIZE);
        if (!json) {
            send_json_response(client_fd, 500, "Internal Server Error", "{\"error\":\"Out of memory\"}");
            return;
        }

        seats_array_to_json(matches, count, json, BUFFER_SIZE);
        send_json_response(client_fd, 200, "OK", json);
        free(json);
        return;
    }

    /* 6. Static frontend files or unknown API */
    if (strncmp(path, "/api/", 5) == 0) {
        send_json_response(client_fd, 404, "Not Found", "{\"error\":\"Unknown API endpoint\"}");
        return;
    }

    /* Serve static file */
    serve_static_file(client_fd, web_root, path);
}

int http_server_run(int port, const char *web_root) {
    signal(SIGINT, sigint_handler);
    signal(SIGTERM, sigint_handler);
    signal(SIGPIPE, SIG_IGN);

    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("socket failed");
        return -1;
    }

    int opt = 1;
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        perror("setsockopt SO_REUSEADDR failed");
    }

    struct sockaddr_in address;
    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);

    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) < 0) {
        perror("bind failed");
        close(server_fd);
        return -2;
    }

    if (listen(server_fd, 16) < 0) {
        perror("listen failed");
        close(server_fd);
        return -3;
    }

    printf("====================================================\n");
    printf("   SideSeat C HTTP Backend Server Running           \n");
    printf("   Listening on: http://localhost:%d/               \n", port);
    printf("   Static Web Root: %s                              \n", web_root);
    printf("   authoritative seats loaded: %d                   \n", g_seat_count);
    printf("   Hash Table size: %d, Collisions: %d              \n", HASH_TABLE_SIZE, ht_get_collision_count(&g_seat_ht));
    printf("====================================================\n");

    while (g_running) {
        /* Set timeout on accept so server can cleanly terminate on SIGINT */
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(server_fd, &read_fds);

        struct timeval tv;
        tv.tv_sec = 1;
        tv.tv_usec = 0;

        int sel = select(server_fd + 1, &read_fds, NULL, NULL, &tv);
        if (sel < 0) {
            if (errno == EINTR) continue;
            break;
        }
        if (sel == 0) {
            continue; /* Timeout, check g_running */
        }

        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);
        if (client_fd < 0) {
            if (errno == EINTR) continue;
            perror("accept error");
            continue;
        }

        /* Read request */
        char buffer[BUFFER_SIZE];
        ssize_t bytes_read = recv(client_fd, buffer, sizeof(buffer) - 1, 0);
        if (bytes_read > 0) {
            buffer[bytes_read] = '\0';

            char method[16] = {0};
            char full_uri[MAX_PATH_LEN] = {0};
            char version[16] = {0};

            /* Parse first line: METHOD URI VERSION */
            sscanf(buffer, "%15s %511s %15s", method, full_uri, version);

            /* Split URI into path and query */
            char path[MAX_PATH_LEN] = {0};
            char query[MAX_PATH_LEN] = {0};
            char *qmark = strchr(full_uri, '?');
            if (qmark) {
                size_t path_len = qmark - full_uri;
                if (path_len >= sizeof(path)) path_len = sizeof(path) - 1;
                strncpy(path, full_uri, path_len);
                path[path_len] = '\0';
                strncpy(query, qmark + 1, sizeof(query) - 1);
            } else {
                strncpy(path, full_uri, sizeof(path) - 1);
            }

            /* Find header termination */
            char *body_ptr = strstr(buffer, "\r\n\r\n");
            while (!body_ptr && bytes_read < (ssize_t)(sizeof(buffer) - 1)) {
                ssize_t n = recv(client_fd, buffer + bytes_read, sizeof(buffer) - 1 - bytes_read, 0);
                if (n <= 0) break;
                bytes_read += n;
                buffer[bytes_read] = '\0';
                body_ptr = strstr(buffer, "\r\n\r\n");
            }

            /* If Content-Length is present, make sure full body is received */
            if (body_ptr) {
                const char *cl_pos = strstr(buffer, "Content-Length:");
                if (!cl_pos) cl_pos = strstr(buffer, "content-length:");
                if (cl_pos) {
                    int content_len = atoi(cl_pos + 15);
                    size_t body_offset = (body_ptr + 4) - buffer;
                    size_t current_body_len = (size_t)(bytes_read - body_offset);

                    while (current_body_len < (size_t)content_len && bytes_read < (ssize_t)(sizeof(buffer) - 1)) {
                        ssize_t n = recv(client_fd, buffer + bytes_read, sizeof(buffer) - 1 - bytes_read, 0);
                        if (n <= 0) break;
                        bytes_read += n;
                        buffer[bytes_read] = '\0';
                        current_body_len += n;
                    }
                }
            }

            const char *body = body_ptr ? (body_ptr + 4) : "";

            handle_request(client_fd, web_root, method, path, query, body);
        }

        close(client_fd);
    }

    printf("\nShutting down SideSeat C HTTP Server...\n");
    close(server_fd);
    return 0;
}
