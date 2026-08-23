---
name: OpenAPI and generated Zod compatibility
description: Compatibility constraint for API contract changes in this workspace.
---

Generated validation code currently targets Zod 3 APIs. Avoid OpenAPI constructs that make Orval emit newer helpers such as zod.email() or zod.int(); use compatible primitives plus bounds when authoring contracts.

**Why:** The generated library typecheck runs immediately after codegen, so an otherwise valid OpenAPI schema can break the whole workspace when its emitted helper is unavailable.

**How to apply:** After every OpenAPI change, run codegen and the library typecheck before consuming regenerated hooks or schemas.