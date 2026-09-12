export const collectionPurposes = [
  {
    id: "everyday",
    label: "Everyday collection",
    hint: "Start with a few recognizable pieces your customers can return to.",
  },
  {
    id: "event",
    label: "Event or pop-up",
    hint: "Keep original artwork intact. Plan samples or stock ahead; published products still need production and shipping.",
  },
  {
    id: "community",
    label: "Community feature",
    hint: "Select the contribution and confirm permission and credit before preparing the artwork. Submission intake is a separate workflow.",
  },
  {
    id: "drop",
    label: "Creator drop",
    hint: "Keep existing emotes or artwork distinct from newly generated designs. Connect a clip source later if your workflow needs it.",
  },
];
export const artworkModes = [
  {
    id: "fixed",
    label: "Owner artwork only",
    hint: "Use the owner’s approved artwork with no customer changes.",
  },
  {
    id: "upload",
    label: "Customer uploads artwork",
    hint: "Use a customer original without generative changes, fitted inside your approved print area.",
  },
  {
    id: "generate",
    label: "Customer generates a design",
    hint: "Allow a new design from a text prompt inside your approved print area.",
  },
  {
    id: "reference",
    label: "Customer provides a reference",
    hint: "Allow a new design guided by a supplied reference inside your approved print area.",
  },
];
const fail = (message) => {
  throw new Error(message);
};
const object = (value, keys, optional = []) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !keys.includes(key) && !optional.includes(key),
    ) ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail("The collection contains missing or unsupported fields.");
};
const text = (value, label, max, optional = false) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ||
    (!optional && !value.trim())
  )
    fail(`${label} must contain ${optional ? "0" : "1"}–${max} characters.`);
  return value.trim();
};
const id = (value) => {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value,
    )
  )
    fail("A draft identifier is invalid. Reload the collection workspace.");
  return value;
};
const unique = (values) => new Set(values).size === values.length;
export function validateCollections(value) {
  if (!Array.isArray(value) || value.length > 20)
    fail("Keep at most 20 collection drafts.");
  const collections = value.map((collection) => {
    object(collection, ["id", "title", "description", "purpose", "items"]);
    if (!collectionPurposes.some(({ id }) => id === collection.purpose))
      fail("Choose a collection purpose.");
    if (!Array.isArray(collection.items) || collection.items.length > 15)
      fail("Keep at most 15 products in a collection.");
    const items = collection.items.map((item) => {
      object(
        item,
        [
          "id",
          "title",
          "productId",
          "variantId",
          "placementCodes",
          "artworkMode",
          "targetPriceCents",
        ],
        ["artwork"],
      );
      if (!artworkModes.some(({ id }) => id === item.artworkMode))
        fail("Choose a supported artwork plan.");
      if (
        item.targetPriceCents !== null &&
        (!Number.isSafeInteger(item.targetPriceCents) ||
          item.targetPriceCents < 1 ||
          item.targetPriceCents > 1000000)
      )
        fail("Target price must be empty or between $0.01 and $10,000.00.");
      if (
        !Array.isArray(item.placementCodes) ||
        !item.placementCodes.length ||
        item.placementCodes.length > 8
      )
        fail("Choose between 1 and 8 print areas.");
      const placementCodes = item.placementCodes.map((code) =>
        text(code, "Print area", 80),
      );
      if (!unique(placementCodes)) fail("Choose each print area only once.");
      const artwork = item.artwork === undefined ? [] : item.artwork;
      if (!Array.isArray(artwork) || artwork.length > 8)
        fail("Attach at most one artwork file per print area.");
      const bindings = artwork.map((binding) => {
        object(binding, ["placementCode", "assetId"]);
        if (!placementCodes.includes(binding.placementCode))
          fail("Attach artwork only to a selected print area.");
        return {
          placementCode: binding.placementCode,
          assetId: id(binding.assetId),
        };
      });
      if (!unique(bindings.map((binding) => binding.placementCode)))
        fail("Attach at most one artwork file per print area.");
      return {
        id: id(item.id),
        title: text(item.title, "Product name", 80),
        productId: text(item.productId, "Product", 160),
        variantId: text(item.variantId, "Variant", 160),
        placementCodes,
        artworkMode: item.artworkMode,
        targetPriceCents: item.targetPriceCents,
        artwork: bindings,
      };
    });
    if (!unique(items.map(({ id }) => id)))
      fail("Each product row needs a unique identifier.");
    return {
      id: id(collection.id),
      title: text(collection.title, "Collection name", 80),
      description: text(
        collection.description,
        "Collection description",
        600,
        true,
      ),
      purpose: collection.purpose,
      items,
    };
  });
  if (!unique(collections.map(({ id }) => id)))
    fail("Each collection needs a unique identifier.");
  return collections;
}
export function collectionItemIssue(item, catalog) {
  const product = catalog.find(({ id }) => id === item.productId);
  if (!product)
    return "This product is no longer available. Choose another product or remove this row.";
  if (!product.variants.some(({ id }) => id === item.variantId))
    return "Choose an available variant for this product.";
  if (
    !item.placementCodes.length ||
    item.placementCodes.some(
      (code) =>
        !product.placements.some((placement) => placement.code === code),
    )
  )
    return "Choose available print areas for this product.";
  return null;
}
