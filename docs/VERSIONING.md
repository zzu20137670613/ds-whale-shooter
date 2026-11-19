# Versioning

The owner's rule, 2026-11-16: **逢九进一**.

```
1.6.8  →  1.6.9  →  1.7.0      (not 1.6.10)
1.9.8  →  1.9.9  →  2.0.0      (not 1.9.10)
```

So the patch digit never reaches `10`. When a release would need a patch of `10`, the minor
digit goes up by one and the patch resets to `0`; when the minor digit would exceed `9`, the
major digit goes up and the rest resets.

Reasons it matters in practice:

- `versionName` on Android and `package.json` here must always agree — the build scripts read
  `package.json` for the installer name and the release notes for the digest table.
- `versionCode` is a separate, always-increasing integer (`1.7.0` → code 24). It never resets:
  Android refuses a downgrade.

Where the number is written:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `D:/ds-whale-shooter-mobile/android/app/build.gradle` | `versionCode` + `versionName` |
| `docs/RELEASE-<version>.md` | filename and title |
| `docs/RELEASING.md` | the `gh release create v<version>` examples |

1.6.13 shipped on 2026-11-15 under the old rule (straight increment) and is left as-is; the rule
starts from 1.7.0.
