# Installation owner order operations

V1-07 local implementation; real sample and provider lifecycle evidence remain open. Visual thesis: use a compact, quiet order list with plain-language status,
then show one order's products, print files, and review actions. Content priority is what needs
attention and what the owner should do next. Interaction thesis: select an order, inspect its saved
artwork, record a review, and explicitly retry a failed draft when eligible. Review notes do not
confirm production or change payment facts. Fixture actions must be labeled as simulated.

The owner workspace uses a narrow projection of order data. It excludes Stripe session bearer IDs,
shipping addresses, private storage paths/URLs, provider payloads, and raw failure messages. Private
print copies are downloaded through an authenticated admin route and verified against their saved
checksums. A later collection edit or withdrawal cannot replace an order's saved print file.


## Behavior and evidence

- **Orders & review** searches the full order history and filters unresolved exceptions before pagination.
  Load older orders without losing selection. Select an order to see its products, payment/fulfillment
  state, print downloads, and review history. See [owner order search](./owner-order-search.md).
- Refunded/cancelled orders with unresolved fulfillment issues remain in **Needs attention**, even
  though their payment state is terminal. Resolved reviews and ordinary deliveries are excluded.
- An acknowledgment or resolution uses the existing durable review transaction. A resolution needs
  an operating note. The transaction records its audit entry without changing order/payment status.
- Retry is offered only with durable storage, enabled draft fulfillment, no attached draft, and
  eligible payment/order state. The existing retry service rechecks payment/refund facts and claims
  the attempt before provider submission. Confirmation remains in Printful.
- Fixture reviews are clearly simulated, remain in server memory, and reset on server restart.
  They cannot invoke a provider retry. No customer contact information is needed to rehearse review.
- Print downloads require installation-admin access. The server verifies the saved quote, asset
  membership, private namespace, and content checksum; unknown or changed files return no bytes.

September 12 checks: API privacy/authentication/validation and unchanged-commerce assertions;
private-file corruption and withdrawal checks; fresh-process PostgreSQL review persistence and
review-audit rollback; desktop/mobile review, download, request payload, and reload coverage. These
prove local contracts, not a live payment, successful physical sample, or operator usability study.
