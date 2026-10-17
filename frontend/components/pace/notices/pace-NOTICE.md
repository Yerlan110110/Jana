# Third-party source notices

Pace is an adaptation/composition, not the author of its upstream foundations.

Pace-authored files (including the installable kit payload) are licensed AGPL-3.0-only while this repository contains the AGPL-3.0 OpenAnalytics product code (owner decision D5). Root license: LICENSE. Per-item licenses are derived from provenance and recorded as meta.license in kit/registry.json; the installer reports installed-file licenses and ships the notices of the provenance sources a payload derives from.

- Open Analytics / OA Design: OpenLabs-so/oa-design, commit bd200daeac8eca2501139cb0fa29cc12e4709303. MIT, Copyright (c) 2026 Voprex Labs. Original notice: vendor/oa/LICENSE.
- Open Analytics (product): OpenLabs-so/openanalytics, commit 8167c8a850d0cd9a6eb11bf2eef30d08981b6651. AGPL-3.0. The `apps/web` UI layer (components, route pages, globals.css, dither-kit registry lock) is vendored unmodified under vendor/openanalytics/ as a pinned study/reference snapshot; upstream LICENSE applies to those files. Original notice: vendor/openanalytics/LICENSE. Consumer distribution follows the recorded owner decision in vendor/distribution.json; the payload includes the upstream license and Pace project notices.
- Amicro: Subhan-code/Amicro--Micro-transitions-, commit 43c29ce9cdd16459e3eab4992381b8d35b38776a. MIT, Copyright (c) 2026 SYED SUBHAN UDDIN. Original notice: vendor/amicro/LICENSE.
- shadcn/ui: shadcn-ui/ui, commit 98a1fe67b439324ddc857f47fbdce056600a4329. MIT, Copyright (c) 2023 shadcn. Original notice: vendor/shadcn/LICENSE.md.
- OxygenUI: Subhan-code/oxygen-ui-solana, commit e6a7cd9773c6e82a103147323840fc3a12094813. No LICENSE file is present at this commit; the upstream README describes the project as open-source and a license is pending upstream. Redistribution permitted by owner decision on 2026-09-23. Notice: vendor/oxygen/PACE-NOTICE.md (ships in the install payload).
- jakubkrehel/skills: jakubkrehel/skills, commit 267330e1adfc66a718fb65fa6918c1f06d0a689e. MIT, Copyright (c) 2026 Jakub Krehel. Only the `better-ui` skill is vendored under `.agents/skills/` and `skills/`; upstream LICENSE retained inside the vendored skill directory. The `transitions-dev` skill does not exist in this repository at this commit.
- emilkowalski/skills: emilkowalski/skills, commit 85e8e2363b713506e1d5b6e07a0eb2da66be1bc3. MIT, Copyright (c) 2026 Emil Kowalski. Skills vendored under `.agents/skills/` and `skills/`; upstream LICENSE retained inside each vendored skill directory.

Original files remain in vendor/. Source adaptations and generated runtime files retain this provenance. Source exports include the applicable notices. npm dependencies retain their own licenses; install them using the project manifest/lockfile. No font binaries are redistributed in this archive.

The user's design-document authoring materials are retained under references/design-md-creator for the requested implementation workflow. The external UI Tips site is referenced by URL and implementation decisions, not copied in full as a distributable article collection.
