# Microsoft Entra SSO + Intune integration

Hi5Central uses one confidential Microsoft Entra web application for tenant admin consent, Microsoft sign-in, Entra people sync, and background Intune device sync.

## App registration

Create an app registration in Microsoft Entra ID with:

- Name: `Hi5Central`
- Supported account types: **Accounts in any organizational directory**
- Platform: **Web**
- Redirect URI: `https://api.hi5central.com/api/v1/auth/microsoft/callback`

Create a client secret under **Certificates & secrets**. Store the secret **Value**, not the secret ID.

## Microsoft Graph application permissions

Add these **Application** permissions and grant admin consent:

- `User.Read.All` — imports Entra users into the Hi5Central People directory.
- `DeviceManagementManagedDevices.Read.All` — imports Microsoft Intune managed devices.

No Graph write permission is required for the first release.
## Hi5Central runtime configuration

Set the following API environment variables:

```text
MICROSOFT_CLIENT_ID=<Application (client) ID>
MICROSOFT_CLIENT_SECRET=<client secret value>
MICROSOFT_REDIRECT_URI=https://api.hi5central.com/api/v1/auth/microsoft/callback
```

Restart only the Hi5Central API after changing these values.

## Tenant connection flow

1. Sign in to the tenant as an administrator.
2. Open **Settings → Integrations**.
3. Select **Connect Microsoft 365**.
4. A Microsoft tenant administrator grants the configured Graph application permissions.
5. Hi5Central stores the Microsoft tenant ID and runs the first directory + Intune sync.
6. **Sign in with Microsoft 365** becomes available on the Hi5Central sign-in screen.
7. Subsequent Intune syncs run automatically and can also be started with **Sync now**.

Microsoft SSO only signs in an existing Hi5Central account/membership. Matching is by linked Entra identity first and email address as the initial safe link.
## User and device linking

During sync, Hi5Central stores the Entra object ID on the managed People source and links each Intune managed device using, in order:

1. Intune `userId` → Entra user object ID.
2. Intune `userPrincipalName` / email → synced Hi5Central person email.

The resolved organisation person is stored directly on the device inventory row. That makes assigned devices available both in RMM and in the ITSM record **Details → Assets & CIs** context for the requester.

The first implementation is read-only. Disconnecting Microsoft 365 disables SSO and scheduled sync but retains already imported inventory for audit/history.