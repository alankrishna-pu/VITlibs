CC = clang
CFLAGS = -Wall -Wextra -O2 -std=c11
INCLUDES = -Ibackend

BIN_DIR = bin
SERVER_BIN = $(BIN_DIR)/sideseat_server
TEST_BIN = $(BIN_DIR)/test_backend

BACKEND_SRCS = backend/seat.c backend/http_server.c backend/main.c
TEST_SRCS = backend/seat.c tests/test_backend.c

.PHONY: all clean test run

all: $(SERVER_BIN)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(SERVER_BIN): $(BACKEND_SRCS) | $(BIN_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) $(BACKEND_SRCS) -o $(SERVER_BIN)

test: $(TEST_BIN)
	./$(TEST_BIN)

$(TEST_BIN): $(TEST_SRCS) | $(BIN_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) $(TEST_SRCS) -o $(TEST_BIN)

run: $(SERVER_BIN)
	./$(SERVER_BIN) -p 8080 -d data/seats.csv -w frontend

clean:
	rm -rf $(BIN_DIR)
