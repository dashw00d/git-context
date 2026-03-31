# Track Spec: Align Sandbox Tests with Pipeline

## Overview
This track focuses on updating the sandbox integration tests to accurately reflect the current behavior and logic of the analysis pipeline. We utilize mock git fixtures to ensure deterministic testing of the parsing, symbol extraction, and drift detection logic.

## Functional Requirements
- **Synchronized Assertions:** Update test expectations (symbol counts, hotspot detection, and architectural drift metrics) to match the latest pipeline logic.
- **Test Logic Refinement:** Adjust the test execution flow to ensure it correctly invokes the pipeline components using the mock fixtures.
- **Deterministic Verification:** Ensure that the manually calculated expectations derived from mock fixtures are correctly enforced in the test suite.

## Technical Details
- **Mock Fixtures:** Continue using and potentially expanding the mock git fixtures to provide a controlled environment for the pipeline.
- **Expectation Calculation:** Values for symbols, hotspots, and drift will be manually derived from the fixture content and hardcoded as assertions within the test files.

## Acceptance Criteria
- Integration tests in `tests/integration/` (specifically those using the sandbox/mock repository) pass reliably.
- Assertions for symbol extraction, hotspot calculation, and drift detection accurately reflect the state of the mock repository.
- No regressions are introduced in the core analysis pipeline during the test alignment process.
