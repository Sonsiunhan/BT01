# Wireframe – P13: Account Activation & Claim

```mermaid
flowchart TD
    Start[Start: User receives activation email] --> ClickLink[User clicks activation link with token]
    ClickLink --> Validate[Backend validates token (expiry, revocation, single‑use)]
    Validate --> Valid{Token valid?}
    Valid -- Yes --> Claim[Show claim form (set password, optional profile)]
    Claim --> Submit[User submits claim]
    Submit --> Process[Backend creates account, marks token as consumed]
    Process --> Success[Show activation success page]
    Valid -- No --> Invalid[Show error (expired / already used / revoked)]
    Invalid --> End
```

**Description**: Flow for page P13 covering activation link handling, token validation, claim form, and final account creation. Security properties (configurable TTL, single‑use, revocation, no secret leakage) are enforced server‑side.
