# Wireframe – P17: Staff / Referee Invitation & Access Flow

```mermaid
flowchart TD
    AdminStart[Admin (tournament_admin) opens invitation page] --> FillForm[Enter invitee email, role (STAFF / REFEREE), optional expiry]
    FillForm --> CreateInvite[Backend creates invitation record, generates single‑use token]
    CreateInvite --> SendEmail[Send invitation email with link]
    SendEmail --> InviteSent[UI shows "Invitation sent"
    InviteSent --> InviteLink[Invitee clicks link with token]
    InviteLink --> ValidateToken[Backend validates token (expiry, revocation, single‑use)]
    ValidateToken --> Valid{Token valid?}
    Valid -- Yes --> AcceptForm[Show acceptance form (accept / decline)]
    AcceptForm --> Decision{Accept?}
    Decision -- Yes --> Activate[Mark invitation status = ACCEPTED, create staff/referee account, assign role]
    Activate --> Success[Show success page]
    Decision -- No --> Decline[Mark status = DECLINED]
    Decline --> End[Show decline confirmation]
    Valid -- No --> Invalid[Show error (expired / revoked / already used)]
    Invalid --> End
```

**Description**: Flow for page P17 covering creation of staff/referee invitations, secure token handling, acceptance/decline, and activation of the invited account. Security ensures token is configurable TTL, single‑use, and never exposed.
