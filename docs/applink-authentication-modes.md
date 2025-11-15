# Heroku AppLink Authentication Modes

```mermaid
graph TB
    SF[Salesforce<br/>Lightning UI]
    WEB[Internet Web/<br/>API Service]

    HA1[User Mode<br/>Heroku App]
    HA2[User-Plus Mode<br/>Heroku App]
    HA3[Authorized-User Mode<br/>Heroku App]

    SFDATA[Salesforce Data]

    SF -->|"Salesforce<br/>Logged in User"| HA1
    SF -->|"Salesforce<br/>Logged in User"| HA2
    WEB -->|"Assigned<br/>Salesforce User"| HA3

    HA1 --> SFDATA
    HA2 --> SFDATA
    HA3 --> SFDATA

    style SF fill:#0176D3,stroke:#0176D3,color:#fff
    style WEB fill:#0176D3,stroke:#0176D3,color:#fff
    style SFDATA fill:#0176D3,stroke:#0176D3,color:#fff
    style HA1 fill:#79589F,stroke:#79589F,color:#fff
    style HA2 fill:#79589F,stroke:#79589F,color:#fff
    style HA3 fill:#79589F,stroke:#79589F,color:#fff
```

## Authentication Modes

### User Mode
- **Integration Type**: Salesforce UI with Salesforce User
- **Flow**: Salesforce → Heroku
- **Context**: Logged-in Salesforce user's permissions
- **Setup**: Assign permission set to gate access

### User-Plus Mode
- **Integration Type**: Salesforce UI with Salesforce User
- **Flow**: Salesforce → Heroku
- **Context**: Logged-in Salesforce user + session-based permission elevation
- **Setup**: Assign permission set + activate session-based permission set

### Authorized-User Mode
- **Integration Type**: Non-Salesforce API/Experience
- **Flow**: Heroku → Salesforce
- **Context**: Pre-authenticated user (not the logged-in Salesforce user)
- **Setup**: Configure authorized user(s) with alias(es) beforehand

