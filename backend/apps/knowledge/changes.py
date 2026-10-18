from collections import defaultdict, deque


def policy_changes(previous, current):
    """Return a stable, section-level comparison between two published policies."""
    if previous.title != current.title:
        changes = [
            {
                "heading": "Название регламента",
                "before": previous.title,
                "after": current.title,
            }
        ]
    else:
        changes = []
    if previous.summary != current.summary:
        changes.append(
            {
                "heading": "Краткое описание",
                "before": previous.summary or None,
                "after": current.summary or None,
            }
        )

    old_sections = _sections_by_heading(previous.sections)
    new_sections = _sections_by_heading(current.sections)
    headings = list(old_sections)
    headings.extend(heading for heading in new_sections if heading not in old_sections)

    for key in headings:
        old_values = old_sections.get(key, deque())
        new_values = new_sections.get(key, deque())
        count = max(len(old_values), len(new_values))
        for index in range(count):
            before = old_values[index] if index < len(old_values) else None
            after = new_values[index] if index < len(new_values) else None
            if before == after:
                continue
            heading = (after or before)["heading"]
            changes.append(
                {
                    "heading": heading,
                    "before": before["text"] if before else None,
                    "after": after["text"] if after else None,
                }
            )
    return changes


def policy_text_changed(previous, current):
    return bool(policy_changes(previous, current))


def _sections_by_heading(sections):
    values = defaultdict(deque)
    for section in sections:
        values[section["heading"].strip().casefold()].append(section)
    return values
