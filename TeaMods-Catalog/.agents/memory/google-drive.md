---
name: TeaMods Drive upload constraints
description: The chosen Drive integration and the service-account storage requirement.
---

TeaMods must use the Google Drive API directly with the service-account JSON secret; do not route app uploads through Replit's Drive connector.

**Why:** The user explicitly chose this architecture. A real resumable-upload request authenticated successfully but Google returned `storageQuotaExceeded`; editor access to a regular My Drive folder does not give a service account storage quota to own uploaded files.

**How to apply:** Keep uploads resumable and support Shared Drives. For this error, ask the user to target a Shared Drive folder or choose an owner-authorized OAuth flow; do not claim upload works until a file reaches Drive.
