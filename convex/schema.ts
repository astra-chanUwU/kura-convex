import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { accountRole, changeAction, font, postSnapshot, rating, storedTheme } from "./validators";

// Image bytes live in object storage. These tables store keys and metadata only.
// thumbKey is a WebP used by the board. storageKey is the original, used on the post page.
export default defineSchema({
  posts: defineTable({
    storageKey: v.string(),
    thumbKey: v.optional(v.string()),
    searchText: v.optional(v.string()),
    contentType: v.string(),
    byteSize: v.number(),
    width: v.number(),
    height: v.number(),
    originalName: v.string(),
    artist: v.string(),
    source: v.string(),
    caption: v.string(),
    rating,
    createdAt: v.number(),
    authorId: v.string(),
    safebooruId: v.optional(v.number()),
    tags: v.array(v.string()),
    removedAt: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_rating_createdAt", ["rating", "createdAt"])
    .index("by_storageKey", ["storageKey"])
    .index("by_safebooruId", ["safebooruId"])
    .index("by_author", ["authorId"])
    .searchIndex("search_posts", {
      searchField: "searchText",
      filterFields: ["rating"],
    }),

  postTags: defineTable({
    postId: v.id("posts"),
    tag: v.string(),
    createdAt: v.optional(v.number()),
  })
    .index("by_post", ["postId"])
    .index("by_tag_createdAt", ["tag", "createdAt"]),

  tagStats: defineTable({
    tag: v.string(),
    count: v.number(),
  })
    .index("by_tag", ["tag"])
    .index("by_count", ["count"]),

  favorites: defineTable({
    userId: v.string(),
    postId: v.id("posts"),
    createdAt: v.optional(v.number()),
  })
    .index("by_user_post", ["userId", "postId"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_post", ["postId"]),

  preferences: defineTable({
    userId: v.string(),
    displayName: v.string(),
    bio: v.string(),
    location: v.string(),
    website: v.string(),
    theme: storedTheme,
    font: v.optional(font),
    showSensitive: v.boolean(),
    includeTags: v.array(v.string()),
    excludeTags: v.array(v.string()),
    role: v.optional(accountRole),
  }).index("by_user", ["userId"]),

  // Append-only. A rollback is a new row that points at the change it undoes.
  changes: defineTable({
    entityType: v.literal("post"),
    entityId: v.string(),
    actorId: v.string(),
    actorName: v.string(),
    action: changeAction,
    before: postSnapshot,
    after: postSnapshot,
    rollbackOf: v.optional(v.id("changes")),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_entity_createdAt", ["entityType", "entityId", "createdAt"])
    .index("by_actor_createdAt", ["actorId", "createdAt"]),
});
