# Wireframe – P10: Roster Import & Management

```mermaid
flowchart TD
    Start[Start: User navigates to Roster Import page] --> Upload[Upload CSV/XLSX file]
    Upload --> Parse[Backend parses file into rows]
    Parse --> Validate[Validate rows (format, required fields, uniqueness)]
    Validate --> Preview[Show preview table with validation results]
    Preview --> Confirm[User confirms import]
    Confirm --> Staging[Create staging batch (temp IDs, idempotency key)]
    Staging --> Commit[User clicks Commit -> Backend writes rows to permanent roster]
    Commit --> Success[Show success summary]
    Validate -- Errors --> Error[Display error list, allow correction]
    Error --> Upload
```

**Description**: Flow for page P10 covering upload, validation, preview, staging, and final commit. Security: only tournament_admin of the tenant can import; file size limits enforced; validation errors are not persisted.
