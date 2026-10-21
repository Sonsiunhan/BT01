# Wireframe – P09: Account Bootstrap & Authentication

```mermaid
flowchart TD
    Start[Start: User visits login page] --> CheckAuth{Is user authenticated?}
    CheckAuth -- Yes --> Redirect[Redirect to Dashboard]
    CheckAuth -- No --> ShowLogin[Show login form]
    ShowLogin --> SubmitLogin[User submits credentials]
    SubmitLogin --> Verify[Backend verifies credentials]
    Verify --> AuthSuccess{Success?}
    AuthSuccess -- Yes --> SetSession[Set session cookie & tenant context]
    SetSession --> Dashboard[Show user dashboard]
    AuthSuccess -- No --> ShowError[Show error message]
    ShowError --> ShowLogin
```

**Description**: This flow outlines the authentication entry point (page P09). It includes tenant binding after successful login and ensures role-based redirection. Security considerations: passwords never logged, session cookie HttpOnly, server-side role enforcement.
