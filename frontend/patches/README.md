# EdgeStore mount-error patch

`@edgestore/react` 0.7.0 invokes `void init()` from an effect. The initializer
correctly sets `state.error` on network/API failure, then rethrows; no caller
handles that mount-time rejection. This produced browser errors even on pages
that do not upload anything. A controlled 503 browser regression reproduces it.

The patch handles **only the effect's promise**, after the SDK has recorded its
failure state. It does not catch explicit `reset()` calls, change uploads,
authentication, storage rate limits, or global browser error reporting.
Both published module formats are patched. Postinstall fails if the patch can
no longer apply; review/remove it when the SDK ships the equivalent correction.

Run the opt-in `S8 unavailable storage initialization` browser regression plus
the existing profile-upload/retry tests when changing this patch. A readable
catalog alone is not proof that uploads recover correctly.
