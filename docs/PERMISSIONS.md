# Workspace permissions

PlanGlade uses four workspace roles. Access is always limited to the current workspace.

| Action | Viewer | Member | Admin | Owner |
| --- | --- | --- | --- | --- |
| View and search workspace content | Yes | Yes | Yes | Yes |
| Download an accessible attachment | Yes | Yes | Yes | Yes |
| Upload or rename an attachment | No | Yes | Yes | Yes |
| Delete an attachment you uploaded | No | Yes | Yes | Yes |
| Delete an attachment uploaded by someone else | No | No | Yes | Yes |
| Create and edit ordinary content | No | Yes | Yes | Yes |
| Delete content you created | No | Yes | Yes | Yes |
| Delete content created by someone else | No | No | Yes | Yes |
| Manage labels and task relationships | No | Create and edit | Full access | Full access |
| Manage members and invitation policy | No | No | Yes | Yes |
| Export the workspace | No | No | Yes | Yes |
| Preview or append an import | No | No | Yes | Yes |
| Transfer ownership or delete the workspace | No | No | No | Owner only |

## Exports

Workspace exports are recorded in the activity log and are not cached. An export contains the workspace profile, projects, tasks and inbox items, notes the person exporting can access, labels, project documents, and saved views owned by that person.

Exports do not contain memberships, invitations, activity history, notifications, attachment files or storage object keys, authentication material, or user settings.

Store exported JSON files securely. They can contain private workspace content.

## Imports

Imports add supported data without deleting records. PlanGlade previews the data, creates imported projects with unique destination slugs, creates other supported records, and skips possible duplicates by normalized name or title. Every completed source checksum retains its committed result for idempotent retries, and a separate durable workspace lease rejects overlapping imports. An import does not replace the workspace.

Only admins and owners can import data. Each completed import is recorded in the activity log.

## Deletion

Members can delete content they created. Admins and owners can also delete shared content created by other members. Labels do not record a creator, so only admins and owners can delete them. Members may create and remove task relationships because those links are part of the shared task plan; Viewers remain read-only.

Attachments follow the same shared-content boundary for deletion: the uploader, an admin, or the owner may delete a file. Any member may rename an attachment attached to content they can access. Deletion removes the product record immediately and queues durable storage cleanup.

Use archive controls where PlanGlade provides them. Permanent deletion cannot be undone from the app.

## Owner-only operations

Ownership transfer, workspace deletion, and recovery-sensitive operations are reserved for the owner. These operations are not currently exposed in the early-preview interface.
