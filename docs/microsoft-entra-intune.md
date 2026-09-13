# Microsoft Entra SSO + Intune integration

Hi5Central uses one confidential multitenant Microsoft Entra web application for admin consent, Microsoft sign-in, Entra people sync, and background Intune device sync.

A single Hi5Central customer can connect multiple Microsoft Entra / Intune tenants. Each connection keeps its own consent state, friendly name, directory tenant ID, sync schedule, sync history, device count and error state.

## App registration

Create one app registration in Microsoft Entra ID with:

- Name: `Hi5Central`
- Supported account types: **Accounts in any organizational directory**
- Platform: **Web**
- Redirect URI: `https://api.hi5central.com/api/v1/auth/microsoft/callback`

Create a client secret under **Certificates & secrets**. Store the secret **Value**, not the secret ID.

## Microsoft Graph application permissions

Add these **Application** permissions and grant admin consent in every Microsoft tenant that will be connected:

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

## Multiple Microsoft tenant connections

1. Sign in to the Hi5Central tenant as an administrator.
2. Open **Settings → Integrations**.
3. Select **Add Microsoft tenant** and give it a friendly name such as `UK tenant`.
4. An administrator from that Microsoft directory grants consent.
5. Repeat **Add Microsoft tenant** for every additional Entra / Intune directory.
6. Each connection can run **Sync now** independently, while **Sync all** updates every connected directory.
7. Scheduled sync is evaluated per Microsoft connection, so a failure in one directory does not stop another.

Microsoft SSO accepts identities only from Microsoft directories connected to that Hi5Central tenant. An account from an unconnected Entra directory is rejected after token validation.
