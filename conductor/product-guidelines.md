# Product Guidelines - Git Context

## Tone & Messaging
- **Technical & Precise:** The primary tone is focused on accuracy and the use of standard developer terminology. We prioritize density of information and technical correctness (e.g., AST, Diff, Ref) over simplified language.

## Design & User Experience
- **Interactive Exploration:** The UI/UX should focus on smooth transitions and powerful drill-down capabilities. Users should be able to move intuitively from high-level summaries to deep, structural code diffs.
- **Verification First:** To ensure trust in AI-generated content, the UI must always provide direct links back to the source code or specific diff lines that support the LLM's claims.

## Development Constraints
- **Performance First:** All analysis must be performant and non-blocking. The system must handle large repositories and complex histories without degrading the VS Code experience.
- **Strict Architectural Invariants:** Adherence to the core invariants (Tree View stability, Database access patterns, and Change Semantics) is mandatory for long-term stability.
- **Comprehensive Testing:** Development must include robust unit and integration testing. We value automated verification of the analysis pipeline and high code coverage.
