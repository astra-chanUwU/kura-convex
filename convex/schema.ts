import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  accountRole,
  changeAction,
  font,
  listVisibility,
  postSnapshot,
  rating,
  savedRating,
  savedSort,
  storedTheme,
  tagCategory,
} from "./validators";

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
    // safebooruId is the original Safebooru import key. Later imports use sourceBoard + sourceId.
    safebooruId: v.optional(v.number()),
    sourceBoard: v.optional(v.string()),
    sourceId: v.optional(v.number()),
    sha256: v.optional(v.string()),
    parentId: v.optional(v.id("posts")),
    favoriteCount: v.optional(v.number()),
    tags: v.array(v.string()),
    removedAt: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_rating_createdAt", ["rating", "createdAt"])
    .index("by_favoriteCount_createdAt", ["favoriteCount", "createdAt"])
    .index("by_storageKey", ["storageKey"])
    .index("by_safebooruId", ["safebooruId"])
    .index("by_source", ["sourceBoard", "sourceId"])
    .index("by_sha256", ["sha256"])
    .index("by_parent", ["parentId"])
    .index("by_author", ["authorId"])
    .index("by_author_createdAt", ["authorId", "createdAt"])
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
    category: v.optional(tagCategory),
  })
    .index("by_tag", ["tag"])
    .index("by_count", ["count"]),

  tagAliases: defineTable({
    alias: v.string(),
    canonical: v.string(),
  }).index("by_alias", ["alias"]),

  savedSearches: defineTable({
    userId: v.string(),
    name: v.string(),
    tags: v.array(v.string()),
    exclude: v.array(v.string()),
    q: v.string(),
    sort: savedSort,
    rating: savedRating,
    createdAt: v.number(),
  }).index("by_user_createdAt", ["userId", "createdAt"]),

  favorites: defineTable({
    userId: v.string(),
    postId: v.id("posts"),
    createdAt: v.optional(v.number()),
  })
    .index("by_user_post", ["userId", "postId"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_post", ["postId"]),

  lists: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    visibility: listVisibility,
    createdAt: v.number(),
    updatedAt: v.number(),
    itemCount: v.number(),
  })
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_visibility_updatedAt", ["userId", "visibility", "updatedAt"]),

  listItems: defineTable({
    listId: v.id("lists"),
    postId: v.id("posts"),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_list_position", ["listId", "position"])
    .index("by_list_post", ["listId", "postId"])
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
