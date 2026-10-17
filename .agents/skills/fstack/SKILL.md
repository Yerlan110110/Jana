---
name: fstack
description: Route JanaMen interface research, specifications, implementation, and review through the original Emil Kowalski and Jakub Krehel skills. Use for fstack, design handoffs, frontend work, and API contracts that affect user states.
---

# JanaMen Fstack

This is a JanaMen routing skill. Emil Kowalski and Jakub Krehel authored the adjacent original skills. They did not author or endorse this wrapper.

## Start from evidence

Read the root `AGENTS.md`, the current design handoff, and the real API contracts. Read [emil-design-eng](../emil-design-eng/SKILL.md) and [better-interface](../better-interface/SKILL.md). Load the owning `better-*` skills as that review requires. Use each source's original rules. Record which files you read and which decisions they changed.

Preserve the project's complete scope. Design lists with roughly 30 courses and varied employees, requests, outcomes, and notifications. Include empty, loading, error, pending, completed, unavailable, and permission-limited states where the contract allows them. Do not invent reachable states that the backend cannot produce.

## Route the task

1. For product or reference research, use [explain-interface](../explain-interface/SKILL.md). Distinguish observed behavior, documented behavior, inference, and proposed JanaMen behavior. For shipped artifacts or runtime questions, read [REA](../reverse-engineer-anything/SKILL.md) and retain actual tool evidence. Read complete source repositories with ordinary repository tools.
2. For specifications, translate observations into requirements with acceptance checks. Read [better-layout](../better-layout/SKILL.md), [better-writing](../better-writing/SKILL.md), and [better-accessibility](../better-accessibility/SKILL.md). Name the relevant contract and state for each proposal.
3. For implementation, read [pick-ui-library](../pick-ui-library/SKILL.md) before choosing components. Prefer installed supported components. Use [state-machine](../state-machine/SKILL.md), [variant](../variant/SKILL.md), or [prototype](../prototype/SKILL.md) when their task fits and the user's scope authorizes a rendered experiment.
4. For motion, use [animate](../animate/SKILL.md), [review-animations](../review-animations/SKILL.md), and [animation-performance](../animation-performance/SKILL.md) as appropriate. Preserve a visible state without motion. Resolve conflicting numeric recipes in one documented project token rather than mixing defaults.
5. For mobile behavior, read [mobile-native](../mobile-native/SKILL.md). Exercise narrow viewports, keyboard access, touch behavior, safe areas, and zoom.
6. Before declaring a UI complete, apply [break-ui](../break-ui/SKILL.md), [break](../break/SKILL.md), and the complete [better-interface](../better-interface/SKILL.md) review. A change review uses [interface-review](../interface-review/SKILL.md). The user's standing instruction authorizes these reviews for JanaMen work.

All original author skills remain installed. Use Swift, Expo, and physical technical drawing skills only for their relevant platform or output. Installing a skill is distinct from executing its workflow.

## Report honestly

Attach file, API, screenshot, or runtime evidence to findings. Mark uninspected domains and unexecuted runtime checks. A specification can be ready for implementation while its future rendered UI remains unverified. Keep the user's frontend ownership boundary explicit. Do not claim a design review of screens that do not yet exist.
