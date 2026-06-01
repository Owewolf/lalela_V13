# Owner Actions via Communication Entry Point

## Objective

The current Communications Modal is functioning correctly for standard users and must remain unchanged.

We need to modify the behavior when the owner of a Listing or Notice clicks the communication/action button.

The existing communication entry point will become an owner-management entry point, providing direct access to:

1. Record a Sale
2. Delete Listing/Notice

No changes are required to the existing database model, sales model, quantity model, or backend business logic.

The objective is simply to expose the existing functionality through the owner-facing UI and ensure all frontend actions are correctly connected to the existing backend endpoints.

---

# User Role Logic

When a user clicks the communication button:

```text
IF (Current User == Post Owner) {
    Show Owner Action Modal
} ELSE {
    Show Existing Communications Modal
}
```

---

# Standard User Behaviour

No changes.

The existing communication workflow remains exactly as it is today.

Users who do not own the Listing or Notice must continue to see:

* Chat
* Contact options
* Existing inquiry functionality

No UI, API, or workflow changes are required.

---

# Owner Behaviour

When the owner clicks the same communication button, do not display:

* Open Chat
* Send Message
* Contact Options
* Inquiry Actions

Instead, display only:

## Option 1: Record a Sale

This action must be fully wired through the frontend and backend using the existing sales-recording functionality.

Requirements:

* Use the existing sale-recording endpoint.
* Use the existing quantity-tracking logic.
* Use the existing inventory/status logic.
* Do not create new tables.
* Do not create new models.
* Do not alter existing backend business rules.

The owner action must correctly:

* Record quantities sold.
* Update quantities remaining.
* Trigger any existing sold-status logic.
* Update all related frontend views immediately after completion.

The objective is to ensure the existing functionality is properly connected and fully operational from the owner-facing interface.

---

| Communication Button | Existing Communication Modal                          |
| -------------------- | ----------------------------------------------------- |
| Listing Owner        | Communication ButtonOption 2: Delete Listing / Notice |

Provide a delete action for the owner.

Requirements:

### Confirmation Dialog

Before deletion:

```text
Are you sure you want to delete this item?
```

Actions:

```text
Cancel
Delete
```

### Delete Behaviour

If confirmed:

* Call the existing delete endpoint.
* Remove the Listing or Notice.
* Refresh all affected views.
* Return the user to the appropriate screen.

---

# Expected UI Flow

| User Type     | Button Pressed       | Result                                        |
| ------------- | -------------------- | --------------------------------------------- |
| Standard User |                      | Record a Sale / Delete Listing                |
| Notice Owner  | Communication Button | Record a Sale (if applicable) / Delete Notice |

---

# Development Notes

## Important

Do not modify:

* Database schema
* Existing models
* Existing sales logic
* Existing quantity logic
* Existing communication workflow for non-owners

## Required
  #### Universal on all pages communication links ######
Replace the owner-facing communication options with:

1. Record a Sale
2. Delete

Ensure the Record a Sale workflow is fully connected between:

* Frontend UI
* API layer
* Existing backend services
* Existing quantity calculations
* Existing sold-status updates

The goal is not to redesign the system, but to expose the already existing functionality through the owner-facing action menu and ensure it operates correctly end-to-end.

