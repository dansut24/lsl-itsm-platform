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

- `User.Read.All` — reads Entra user profiles so Hi5Central can sync People and match an Intune device to the correct employee/requester.
- `DeviceManagementManagedDevices.Read.All` — reads Intune managed-device inventory, ownership and compliance so devices can appear in RMM and ITSM Assets & CIs. It is read-only; no device write permission is requested.

No Graph write permission is required for the first release.
## Hi5Central runtime configuration

Set the following API environment variables:

```text
MICROSOFT_CLIENT_ID=<Application (client) ID>
MICROSOFT_CLIENT_SECRET_FILE=/run/secrets/microsoft_client_secret
MICROSOFT_REDIRECT_URI=https://api.hi5central.com/api/v1/auth/microsoft/callback
```

Store the client secret in a root-owned file with mode `0600`, mount it read-only into the API container, and point `MICROSOFT_CLIENT_SECRET_FILE` at that mount. Hi5Central never returns the full secret after startup: authorised integration settings receive only the first four characters plus a fixed mask. The direct `MICROSOFT_CLIENT_SECRET` environment variable remains a compatibility fallback, but the protected file is preferred.

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
