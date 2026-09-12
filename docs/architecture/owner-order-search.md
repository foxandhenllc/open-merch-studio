# Owner order history

The Orders & review workspace queries the installation's complete order history. Results are
ordered by creation time and ID, with 25 orders per page. Loading older orders preserves the selected
order and earlier rows; a failed page load can be retried without starting over.

Search accepts a full or partial order number. Search inputs and cursors are sent in an authenticated
POST body rather than the URL. Customer email, addresses, payment identifiers, and provider payloads
are neither searched nor returned by this workspace. The database query selects only the summary
fields required by the owner UI.

Needs attention is applied before pagination. Refunded or cancelled orders with unresolved
fulfillment issues remain visible. A resolved review is excluded. The server binds each cursor to
its search/filter and rejects mismatched or malformed cursors. New searches start at the first page;
refresh includes orders created since the previous query.

The original GET list remains for compatibility; the UI uses POST /api/admin/order-operations/search.
No database migration is required. Tests cover more than 100 records, tied creation times, old
exceptions, privacy, cursor scope, page-load failure/retry, and resetting pagination for a search.
