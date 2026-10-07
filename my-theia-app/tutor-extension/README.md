# Tutor extension test-case workflow

Tutor test cases are stored in the workspace file:

- `.theia/tutor-test-cases.json`

Schema:

```json
{
  "schemaVersion": 1,
  "cases": [
    {
      "id": "test-case-1",
      "title": "Echo exact match",
      "input": "hello",
      "expectedOutput": "hello",
      "matchMode": "equals"
    },
    {
      "id": "test-case-2",
      "title": "Contains sample",
      "input": "hello world",
      "expectedOutput": "world",
      "matchMode": "contains"
    }
  ]
}
```

Usage:

1. Open **Tutor Test Cases** view.
2. Add/remove/edit cases, then click **Save**.
3. Run **Tutor: Reload Tutor Test Cases** (or click **Reload**) to sync the Theia test tree.
4. Execute the **Run Tutor Test Cases** test profile from the Theia Testing UI.

If the JSON file is malformed, the widget reports the parse error and refuses to overwrite the file until it is fixed or deleted.
