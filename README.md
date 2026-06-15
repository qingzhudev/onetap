# OneTap

OneTap is a Chromium extension for launching repeatable domain and text-based research workflows from the browser side panel.

The extension reads the current page domain or selected text, injects it into configurable URL templates, and opens individual services, grouped services, or ordered workflows with one action. It is built with Plasmo, React, and TypeScript.

## Use Cases

- Domain research: Whois, DNS, certificates, search indexing, archive checks, and related public intelligence sources.
- Security analysis: threat intelligence lookups, URL scanners, blacklist checks, and reputation services.
- SEO and market research: keyword tools, backlink checks, page snapshots, and competitor research services.
- Text investigation: selected company names, product names, email addresses, IP addresses, identifiers, or error messages.
- Repeated workflows: ordered multi-step research flows for recurring review, audit, or triage tasks.
- Team configuration sharing: exported JSON configurations or config codes for common toolsets.

## Capabilities

- Domain mode and text mode.
- URL templates with `{domain}` and `{text}` variables.
- Service, group, and workflow management.
- Ordered workflow execution with foreground-first or background-only tab strategies.
- Recent operation replay.
- JSON and config-code import/export.
- Local domain history, keyword history, and analytics export.

## Usage

OneTap operates in two input modes:

- Domain mode uses the current tab's domain and runs services whose URL templates contain `{domain}`.
- Text mode uses selected or manually entered text and runs services whose URL templates contain `{text}`.

Click behavior in the side panel:

- Left-click a service to open it in an active tab.
- Right-click a service to open it in a background tab.

## Configuration Samples

Public configuration samples are expected to live in the `samples/` directory. After a sample file is added to the repository, it can be downloaded from [samples/onetap-config.sample.json](samples/onetap-config.sample.json).

## URL Template Variables

Each service URL template must contain at least one supported variable:

- `{domain}`: the current page domain.
- `{text}`: the selected or manually entered text, URL encoded before insertion.

Examples:

```text
https://www.google.com/search?q=site:{domain}
https://www.google.com/search?q={text}
https://whois.domaintools.com/{domain}
```

## Development

Install dependencies:

```bash
pnpm install
```

Start the development build:

```bash
pnpm dev
```

Load the generated extension directory in a Chromium-based browser:

```text
build/chrome-mv3-dev
```

## Build

Create a production build:

```bash
pnpm build
```

Package the extension:

```bash
pnpm package
```

Production artifacts are written to `build/`.

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

OneTap is licensed under the MIT License. You may use, copy, modify, and distribute the project, provided that the copyright notice and license text are retained.
