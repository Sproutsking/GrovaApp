# Observability plan

## Current checks
- Verify each project endpoint responds with HTTP 200 using the matching service-role credentials.
- Track edge-function response status codes and failure rates per boundary by logging function execution results to a small aggregation endpoint.

## Suggested metrics
- `edge_function_success_total{boundary, function}`
- `edge_function_failure_total{boundary, function}`
- `supabase_api_latency_ms{boundary, table}`
- `wallet_transaction_success_total{boundary}`
- `wallet_transaction_failure_total{boundary}`

## Alert thresholds
- Error rate > 5% over 10 minutes for a boundary-specific function.
- P95 latency > 2s for wallet or core read/write operations.
- Any payment-related function returning > 1% 5xx responses.
