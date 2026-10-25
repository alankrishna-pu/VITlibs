#ifndef HTTP_SERVER_H
#define HTTP_SERVER_H

#include <stdbool.h>

/*
 * Start the HTTP server on the specified port.
 * web_root is the relative or absolute path to the frontend directory
 * for serving static files (index.html, css, js, assets).
 */
int http_server_run(int port, const char *web_root);

/* Stop server */
void http_server_stop(void);

#endif /* HTTP_SERVER_H */
