import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";

class DraftsService {
  async saveDraft(draftData, userId) {
    try {
      console.log("💾 Saving draft...", draftData);

      const { contentType, draftId } = draftData;

      let draftPayload = {
        user_id: userId,
        content_type: contentType,
        title:
          draftData.title || this.generateDraftTitle(contentType, draftData),
        updated_at: new Date().toISOString(),
      };

      if (contentType === "post") {
        draftPayload = {
          ...draftPayload,
          post_content: draftData.content || null,
          post_images_data: draftData.imagesData || [],
          post_category: draftData.category || "General",
        };
      } else if (contentType === "reel") {
        draftPayload = {
          ...draftPayload,
          reel_video_data: draftData.videoData || null,
          reel_thumbnail_data: draftData.thumbnailData || null,
          reel_caption: draftData.caption || null,
          reel_music: draftData.music || null,
          reel_category: draftData.category || "Entertainment",
        };
      } else if (contentType === "story") {
        draftPayload = {
          ...draftPayload,
          story_title: draftData.storyTitle || null,
          story_preview: draftData.preview || null,
          story_content: draftData.content || null,
          story_cover_data: draftData.coverData || null,
          story_category: draftData.category || "Folklore",
          story_unlock_cost: draftData.unlockCost || 0,
          story_max_accesses: draftData.maxAccesses || 1000,
          story_title_color: draftData.titleColor || "#ffffff",
          story_text_color: draftData.textColor || "#d4d4d4",
        };
      }

      let result;

      if (draftId) {
        const { data, error } = await supabase
          .from("drafts")
          .update(draftPayload)
          .eq("id", draftId)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        console.log("✅ Draft updated:", result.id);
      } else {
        const { data, error } = await supabase
          .from("drafts")
          .insert(draftPayload)
          .select()
          .single();

        if (error) throw error;
        result = data;
        console.log("✅ Draft created:", result.id);
      }

      return result;
    } catch (error) {
      console.error("❌ Save draft error:", error);
      throw handleError(error, "Failed to save draft");
    }
  }

  async getDrafts(userId, contentType = null) {
    try {
      console.log("📥 Loading drafts for user:", userId);

      let query = supabase
        .from("drafts")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (contentType) {
        query = query.eq("content_type", contentType);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log(`✅ Loaded ${data.length} drafts`);
      return data;
    } catch (error) {
      console.error("❌ Get drafts error:", error);
      throw handleError(error, "Failed to load drafts");
    }
  }

  async getDraft(draftId, userId) {
    try {
      console.log("📥 Loading draft:", draftId);

      const { data, error } = await supabase
        .from("drafts")
        .select("*")
        .eq("id", draftId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      console.log("✅ Draft loaded:", data.id);
      return data;
    } catch (error) {
      console.error("❌ Get draft error:", error);
      throw handleError(error, "Failed to load draft");
    }
  }

  async deleteDraft(draftId, userId) {
    try {
      console.log("🗑️ Deleting draft:", draftId);

      const { error } = await supabase
        .from("drafts")
        .delete()
        .eq("id", draftId)
        .eq("user_id", userId);

      if (error) throw error;

      console.log("✅ Draft deleted");
      return true;
    } catch (error) {
      console.error("❌ Delete draft error:", error);
      throw handleError(error, "Failed to delete draft");
    }
  }

  generateDraftTitle(contentType, data) {
    const now = new Date();
    const dateStr = now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    if (contentType === "post") {
      const preview = data.content?.substring(0, 30) || "Untitled Post";
      return `${preview}${data.content?.length > 30 ? "..." : ""} - ${dateStr}`;
    } else if (contentType === "reel") {
      const caption = data.caption?.substring(0, 30) || "Untitled Reel";
      return `${caption}${data.caption?.length > 30 ? "..." : ""} - ${dateStr}`;
    } else if (contentType === "story") {
      return data.storyTitle || `Untitled Story - ${dateStr}`;
    }

    return `Draft - ${dateStr}`;
  }
}

const draftsService = new DraftsService();

export default draftsService;
