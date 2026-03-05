# Translation QA Report (2026-03-05)

## Scope
- Source: Admin Translation -> `/api/localization` -> Frontend render
- Environment: local docker (backend :5005, frontend :3010, admin :3011)
- Languages tested per key: AZ, RU
- Method: For each localization page/key, value replaced with unique token and frontend DOM/HTML searched for that token. Then localization restored.

## Summary
- Tested pages: 20
- Skipped pages: 2 (admin_sidebar, app)
- Total cases: 1316
- Passed: 433
- Failed: 883
- Overall coverage: 32.90%

## Per Page Coverage
| Page | View | Keys | AZ | RU | Avg |
|---|---|---:|---:|---:|---:|
| marquee | home | 2 | 0.00% | 0.00% | 0.00% |
| whatisoffroad | home | 14 | 0.00% | 0.00% | 0.00% |
| eventspage | events | 105 | 6.67% | 6.67% | 6.67% |
| partners | home | 8 | 12.50% | 12.50% | 12.50% |
| rulespage | rules | 114 | 13.16% | 13.16% | 13.16% |
| newspage | news | 20 | 25.00% | 25.00% | 25.00% |
| nextrace | home | 20 | 30.00% | 30.00% | 30.00% |
| contactpage | contact | 97 | 31.96% | 31.96% | 31.96% |
| driverspage | drivers | 24 | 33.33% | 33.33% | 33.33% |
| videoarchive | home | 8 | 37.50% | 37.50% | 37.50% |
| gallerypage | gallery | 21 | 38.10% | 38.10% | 38.10% |
| footer | home | 55 | 38.18% | 38.18% | 38.18% |
| navbar | home | 26 | 38.46% | 38.46% | 38.46% |
| categoryleaders | home | 11 | 45.45% | 45.45% | 45.45% |
| about | about | 52 | 38.46% | 55.77% | 47.12% |
| news | home | 8 | 50.00% | 50.00% | 50.00% |
| general | home | 18 | 72.22% | 72.22% | 72.22% |
| hero | home | 5 | 100.00% | 100.00% | 100.00% |
| privacypolicypage | privacy | 26 | 100.00% | 100.00% | 100.00% |
| termsofservicepage | terms | 24 | 100.00% | 100.00% | 100.00% |

## Failure Key Type Distribution
- Total failed keys: 883
- `lbl-*`: 439
- `txt-*`: 52
- `attr-*`: 10
- Uppercase canonical keys (e.g. `PAGE_TITLE`): 360

## Critical Findings
- marquee (0.00%)
- whatisoffroad (0.00%)
- eventspage (6.67%)
- partners (12.50%)
- rulespage (13.16%)
- newspage (25.00%)
- nextrace (30.00%)
- contactpage (31.96%)
- driverspage (33.33%)
- videoarchive (37.50%)
- gallerypage (38.10%)
- footer (38.18%)
- navbar (38.46%)

## Notes
- This test checks visible/serialized frontend output (body text + HTML).
- Keys used only in hidden states (modal, toast after action, non-active tab content) can appear as fail even if translation storage works.
- Localization payload was restored to original at test end.
