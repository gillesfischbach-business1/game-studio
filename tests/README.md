# Test Infrastructure

**Engine**: Unity 6.3 LTS
**Test Framework**: Unity Test Framework (NUnit)
**CI**: `.github/workflows/tests.yml`
**Setup date**: 2026-11-26

## Directory Layout

```
tests/
  smoke/          # Critical path test list for /smoke-check gate
Assets/Tests/
  EditMode/       # Unit tests (formulas, state machines, logic) -- EditModeTests.asmdef
  PlayMode/       # Integration tests in a running scene        -- PlayModeTests.asmdef
```

Unity compiles only `Assets/` and `Packages/`. A test under `tests/` is never
compiled, and a run then reports **0 tests, `Passed`**: a false pass. So unit and
integration tests live under `Assets/Tests/[System]/`, and `tests/` keeps this
README and `smoke/`. Every `tests/unit/` path in the studio docs means that test root.

```
production/qa/
  evidence/       # Screenshot logs and manual test sign-off records
```

> **Manual evidence lives under `production/qa/evidence/`, not `tests/`** -- that
> is where every consumer reads it.

## Status of this setup (read this first)

| Item | State |
|---|---|
| Test directories and `.asmdef` files | created |
| CI workflow | created. Job `Detect Unity project` reports **NOT ASSESSED** and `Run Unity Tests` is skipped until a Unity project is committed; after that it needs `UNITY_LICENSE` |
| Unity project (`Packages/manifest.json`, `ProjectSettings/`) | **does not exist yet** |
| `com.unity.test-framework` in `Packages/manifest.json` | **NOT ASSESSED**: there is no `Packages/manifest.json` to check |
| Game assembly (`Game.asmdef`) | **not created**: there are no game scripts under `Assets/` yet |
| First example test | **missing** (the Technical Setup gate requires one) |

Until a Unity project exists, no test can run. A run in this state must be
reported as **not assessed**, never as a pass.

## Running Tests

Use the editor executable -- `Unity` on `PATH` may be Unity's separate CLI, not the editor.
The path is `engine.path` in `project.yaml` (Windows: `C:/Program Files/Unity/Hub/Editor/6000.3.26f1/Editor/Unity.exe`).

```
"<Unity editor>" -batchmode -runTests -projectPath . -testPlatform EditMode -testResults test-results/editmode.xml
"<Unity editor>" -batchmode -runTests -projectPath . -testPlatform PlayMode -testResults test-results/playmode.xml
```

- Exit **0** = every test passed. Exit **2** = a test failed. Exit **1** (compile error, no results
  file), **3** (failed run), **4** (unknown `-testPlatform`) and any other non-zero exit are FAILs too.
- Delete `test-results/editmode.xml` (and `playmode.xml`) before each run so an old file is never read as a new result.
- Read the `<test-run>` element of the results file: `testcasecount="0"` means nothing was
  compiled or found. Report it as **not assessed**, never as a pass.
- Do not add `-quit`; `-runTests` exits by itself.
- An Edit Mode run never runs `Assets/Tests/PlayMode/`. `/smoke-check` runs both whenever that folder holds tests.
- `-runTests` **hangs** (it does not fail) when the project lacks `com.unity.test-framework`.

## Before the first test can run

1. Create the Unity project in this repository (Unity Hub, 6.3 LTS, URP), so `Packages/manifest.json` and `ProjectSettings/` exist.
2. Check the Test Framework: `grep -q 'com.unity.test-framework' Packages/manifest.json`. If absent, add it at the
   version your editor bundles (read it, do not copy a number: on Windows it is the `version` in
   `Data/Resources/PackageManager/BuiltInPackages/com.unity.test-framework/package.json` next to `Unity.exe`).
3. Put game scripts in their own assembly, e.g. `Assets/Scripts/Game.asmdef`, and add `"Game"` to the `references`
   of both test assemblies. A test assembly cannot see `Assembly-CSharp`; without this the first test that names a
   game class fails to compile. Before creating it:
   - list the packages the scripts use (`using` lines) and add them to the asmdef's `references`
     (commonly `Unity.InputSystem`, `Unity.TextMeshPro`, `UnityEngine.UI`), naming only installed packages;
   - give each `Editor/` folder under it its own `.asmdef` with `"includePlatforms": ["Editor"]` and `"references": ["Game"]`.
4. Add the `UNITY_LICENSE` secret to the GitHub repository (see CI below).
5. Write one example test (see naming below) and run Edit Mode once.

## Test Naming

Names follow the engine's language (`.claude/rules/test-standards.md`):
- **Unity**: class `[System]Tests` in `[System]Tests.cs`, method `[Scenario]_[Expected]`
  -- `CombatTests.cs` -> `BaseAttack_ReturnsExpectedDamage()`

## Story Type -> Test Evidence

| Story Type | Required Evidence | Location |
|---|---|---|
| Logic | Automated unit test -- must pass | `Assets/Tests/EditMode/[System]/` |
| Integration | Integration test OR playtest doc | `Assets/Tests/PlayMode/[System]/` |
| Visual/Feel | Screenshot + lead sign-off | `production/qa/evidence/` |
| UI | Retained screenshot of each screen touched | `production/qa/evidence/` |
| Config/Data | Smoke check pass | `production/qa/smoke-*.md` |

## CI

Tests run automatically on every push to `main` and on every pull request.
A failed test suite blocks merging.

Unity CI needs a `UNITY_LICENSE` secret (GitHub repository settings -> Secrets). License
management is not automated by this setup. While no Unity project is committed, the job
`Detect Unity project` writes a `NOT ASSESSED` warning and `Run Unity Tests` shows as *skipped*:
no test ran, and that is not a pass. Once a project exists, the test job runs and needs the secret.
