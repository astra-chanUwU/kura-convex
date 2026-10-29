import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { rating, theme } from "./validators";

// Image bytes live in MinIO. These tables store keys and metadata only.
export default defineSchema({
  posts: defineTable({
    storageKey: v.string(),
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
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_storageKey", ["storageKey"])
    .index("by_safebooruId", ["safebooruId"])
    .index("by_author", ["authorId"]),

  postTags: defineTable({
    postId: v.id("posts"),
    tag: v.string(),
  })
    .index("by_post", ["postId"])
    .index("by_tag", ["tag"]),

  tagStats: defineTable({
    tag: v.string(),
    count: v.number(),
  })
    .index("by_tag", ["tag"])
    .index("by_count", ["count"]),

  favorites: defineTable({
    userId: v.string(),
    postId: v.id("posts"),
  })
    .index("by_user_post", ["userId", "postId"])
    .index("by_post", ["postId"]),

  preferences: defineTable({
    userId: v.string(),
    displayName: v.string(),
    bio: v.string(),
    location: v.string(),
    website: v.string(),
    theme,
    showSensitive: v.boolean(),
    includeTags: v.array(v.string()),
    excludeTags: v.array(v.string()),
  }).index("by_user", ["userId"]),
});
