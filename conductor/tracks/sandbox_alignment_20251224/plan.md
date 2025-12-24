# Track Plan: Align Sandbox Tests with Pipeline

## Phase 1: Analysis & Data Preparation [checkpoint: 31be21a]
- [x] Task: Audit mock fixtures and manually calculate expected metrics (symbols, hotspots, drift) 6215d33
    - [ ] Analyze mock git history in fixtures
    - [ ] Document expected symbol counts per commit
    - [ ] Document expected hotspot and drift values
- [x] Task: Conductor - User Manual Verification 'Analysis & Data Preparation' (Protocol in workflow.md)

## Phase 2: Update Sandbox Test Assertions [checkpoint: 503e7dd]
- [x] Task: Update symbol extraction assertions in sandbox tests 59b416c
    - [x] Write failing tests (update assertions to new calculated values)
    - [x] Implement fixes (ensure pipeline output matches expectations)
- [x] Task: Update hotspot and drift detection assertions 59b416c
    - [x] Write failing tests (update metrics expectations)
    - [x] Implement fixes (ensure detector logic is correctly exercised)
- [~] Task: Conductor - User Manual Verification 'Update Sandbox Test Assertions' (Protocol in workflow.md)

## Phase 3: Refine Test Execution Logic [checkpoint: a9f8818]
- [x] Task: Align test pipeline invocation with current `AnalysisCoordinator` patterns cd25c75
    - [x] Write Tests (identify mismatches in how tests call the pipeline)
    - [x] Implement Logic Refinement (update test setup/teardown and invocation)
- [x] Task: Conductor - User Manual Verification 'Refine Test Execution Logic' (Protocol in workflow.md) a9f8818

## Phase 4: Final Verification
- [ ] Task: Run full integration suite against mock fixtures
    - [ ] Execute tests and verify all assertions pass
- [ ] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
