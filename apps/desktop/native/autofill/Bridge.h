#include <Security/SecTask.h>

typedef void (*OxVaultReply)(void *context, const char *json);
void oxvault_invoke(const char *operation, const char *input, void *context, OxVaultReply reply);
