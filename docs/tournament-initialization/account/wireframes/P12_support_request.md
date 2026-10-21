# Wireframe – P12: Support Request & Resolution

```mermaid
flowchart TD
    Start[Start: User submits support request] --> Create[Backend creates SupportRequest record]
    Create --> Queue[Add to support queue (tenant scoped)]
    Queue --> Agent[Support agent picks request]
    Agent --> Review[Agent reviews details]
    Review --> Decision{Resolution?}
    Decision -- Resolve --> Update[Update status to RESOLVED, add notes]
    Update --> Notify[Notify user via email]
    Decision -- Escalate --> Escalate[Mark as ESCALATED, assign senior agent]
    Escalate --> NotifyEsc[Notify user of escalation]
    Notify --> End[Close request]
    NotifyEsc --> End
```

**Description**: Flow for page P12 handling creation, queuing, processing, and resolution of support requests. Security: only tenant admins can view all requests; agents can view assigned requests; users can view their own request status. No sensitive data exposed in responses.
