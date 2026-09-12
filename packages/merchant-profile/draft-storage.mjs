import {
  profileFields,
  policyPaths,
  profileDraft,
  validateProfileDraft,
} from "./index.mjs";

/** Blank owner content; colors are usable product defaults, never a sample merchant. */
export function emptyProfileDraft(config, policy) {
  const draft = profileDraft(config, policy);
  for (const field of profileFields)
    if (field.type !== "color") draft.fields[field.path] = "";
  draft.policyVersion = "";
  draft.policyDate = "";
  for (const path of policyPaths)
    draft.pages[path] = {
      eyebrow: "",
      title: "",
      summary: "",
      sections: [{ heading: "", body: "" }],
    };
  return draft;
}

/** Saving work in progress is separate from approving a complete publication. */
export function validateSavedProfileDraft(input, config, policy) {
  const base = profileDraft(config, policy);
  if (
    input &&
    typeof input === "object" &&
    input.fields &&
    typeof input.fields === "object"
  ) {
    input = structuredClone(input);
    for (const path of [
      "brand.logoPath",
      "brand.socialImagePath",
      "web.canonicalUrl",
    ])
      if (!Object.hasOwn(input.fields, path))
        input.fields[path] = base.fields[path];
  }

  const object = (value) =>
    value && typeof value === "object" && !Array.isArray(value);
  const keys = (value, expected) =>
    object(value) &&
    Object.keys(value).sort().join("|") === expected.sort().join("|");
  if (
    !keys(input, Object.keys(base)) ||
    !keys(input.fields, Object.keys(base.fields)) ||
    !keys(input.pages, policyPaths.slice())
  )
    throw new Error(
      "The profile has missing or unsupported fields. Reload the editor.",
    );
  const filled = structuredClone(input);
  for (const field of profileFields) {
    const value = input.fields[field.path];
    if (typeof value !== "string")
      throw new Error(`Check ${field.label.toLowerCase()}.`);
    if (value === "") filled.fields[field.path] = base.fields[field.path];
  }
  for (const key of ["policyVersion", "policyDate"]) {
    if (typeof input[key] !== "string")
      throw new Error("Check the policy version and date.");
    if (input[key] === "") filled[key] = base[key];
  }
  for (const path of policyPaths) {
    const page = input.pages[path];
    if (
      !keys(page, ["eyebrow", "title", "summary", "sections"]) ||
      !Array.isArray(page.sections) ||
      page.sections.length < 1 ||
      page.sections.length > 50
    )
      throw new Error("Check the policy page structure.");
    for (const key of ["eyebrow", "title", "summary"]) {
      if (typeof page[key] !== "string")
        throw new Error("Policy content must be text.");
      if (page[key] === "") filled.pages[path][key] = base.pages[path][key];
    }
    page.sections.forEach((section, i) => {
      if (
        !keys(section, ["heading", "body"]) ||
        typeof section.heading !== "string" ||
        typeof section.body !== "string"
      )
        throw new Error("Policy sections need heading and body fields.");
      // Used only for validation. No fallback content is ever stored or shown to the owner.
      if (section.heading === "")
        filled.pages[path].sections[i].heading = `Unfinished section ${i + 1}`;
      if (section.body === "")
        filled.pages[path].sections[i].body = "Unfinished";
    });
  }
  validateProfileDraft(filled, config);
  return structuredClone(input);
}
