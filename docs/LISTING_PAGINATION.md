# Listing search pagination

The public listing search API supports cursor pagination through the `cursor` query parameter.

- First cursor-mode request: omit both `page` and `cursor`.
- Subsequent requests: send the returned `pagination.next_cursor` as `cursor`.
- Cursor requests fetch only `limit + 1` rows and never use OFFSET.
- The cursor is opaque to clients and is bound to the selected sort order.
- `page` remains temporarily supported for older clients during the rollout.

The next UI migration should replace numbered `page` navigation with cursor-based Next/Previous navigation while preserving filter state. New filter/sort requests must start a fresh cursor chain.
