# JanaMen web source and notices

The JanaMen web application is provided under AGPL-3.0-only. The license is in `LICENSE`. Its corresponding source is published at [Yerlan110110/Jana](https://github.com/Yerlan110110/Jana), including the generated API client used by this frontend. The application footer offers the source link to network users.

The selected Pace 4.0.3 component files retain their original MIT source notices. Pace shared styles retain AGPL-3.0-only notices. Original notices are in `components/pace/notices/`. Consumer theme source is `jana.json`; generated theme output is in `src/themes/`. Receipt-owned upstream files are unchanged.

Button and Input source is from shadcn/ui under MIT. Its license is in `src/components/upstream/shadcn-LICENSE.md`. JanaMen's action adapters use those variants and preserve native navigation semantics.

Inter Tight Variable and Geist Mono Variable fonts are distributed under OFL-1.1. License texts are served at `/licenses/Inter-Tight-OFL.txt` and `/licenses/Geist-Mono-OFL.txt`.

Vite 8 generates the bundled dependency license texts at `/licenses/dependencies.md`. The build copies the existing local source notices without editing their content. The license index is at `/licenses/`, including the application's AGPL text, Pace notices, shadcn notices and both font licenses.

Excluded Oxygen-dependent components were not shipped. The rolled-back installation receipt remains as provenance, not as evidence that its component set is included. See `docs/research/continuation-reuse.md` at the repository root for the source audit and exact pins.
