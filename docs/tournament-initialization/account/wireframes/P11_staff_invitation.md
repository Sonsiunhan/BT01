# Wireframe – P11: Staff Invitation & Assignment

```mermaid
flowchart TD
    Start[Start: Admin opens Staff Invitation page] --> FillForm[Enter email, role, expiry]
    FillForm --> SendInvite[Backend creates invitation token & sends email]
    SendInvite --> InviteSent[Show "Invitation sent" UI]
    InviteSent --> AcceptLink[Staff clicks email link]
    AcceptLink --> Validate[Backend validates token, checks expiry]
    Validate --> AcceptForm[Show acceptance form (accept/decline)]
    AcceptForm --> Decision{Accept?}
    Decision -- Yes --> Activate[Mark staff as active, assign role]
    Activate --> Success[Show success page]
    Decision -- No --> Decline[Mark invitation declined]
    Decline --> End[Show decline confirmation]
```

**Description**: Flow for page P11 covering invitation creation, email delivery, token validation, acceptance/decline. Security: invitation token is single-use, time‑bound, server‑validated; only tournament_admin can create invites.
