// ============================================================================
// templateService.js - Template Management Service
// ============================================================================

import { supabase } from "../config/supabase";

class TemplateService {
  // ==================== GET TEMPLATES ====================

  async getTemplates(type = "reel", filters = {}) {
    try {
      const { category, trending, featured } = filters;

      let query = supabase
        .from("templates")
        .select(
          `
          id,
          name,
          description,
          type,
          thumbnail_url,
          thumbnail_id,
          preview_video_url,
          category,
          duration,
          uses,
          is_premium,
          is_trending,
          is_featured,
          features,
          config,
          created_at
        `,
        )
        .eq("type", type)
        .eq("status", "approved")
        .order("uses", { ascending: false });

      if (category) query = query.eq("category", category);
      if (trending) query = query.eq("is_trending", true);
      if (featured) query = query.eq("is_featured", true);

      const { data, error } = await query;

      if (error) throw error;

      // Return mock data for now until database is set up
      return this.getMockTemplates(type);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      return this.getMockTemplates(type);
    }
  }

  // ==================== GET SINGLE TEMPLATE ====================

  async getTemplate(templateId) {
    try {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Failed to fetch template:", error);
      throw error;
    }
  }

  // ==================== SAVE USER CREATION AS TEMPLATE DRAFT ====================

  async saveCreationAsDraft(contentData, userId) {
    try {
      const template = {
        user_id: userId,
        type: contentData.type, // 'post', 'reel', 'story'
        name: `Template from ${new Date().toLocaleDateString()}`,
        description: "Auto-generated from user content",
        status: "pending",
        config: this.extractTemplateConfig(contentData),
        thumbnail_id: contentData.thumbnail_id || null,
        category: contentData.category || "General",
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("template_drafts")
        .insert([template])
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Template draft saved:", data.id);
      return data;
    } catch (error) {
      console.error("Failed to save template draft:", error);
      throw error;
    }
  }

  // ==================== EXTRACT TEMPLATE CONFIG FROM CONTENT ====================

  extractTemplateConfig(contentData) {
    const config = {
      type: contentData.type,
      timestamp: Date.now(),
    };

    if (contentData.type === "reel") {
      config.duration = contentData.duration;
      config.transitions = contentData.transitions || [];
      config.filters = contentData.filters || [];
      config.effects = contentData.effects || {};
      config.textOverlays = contentData.textOverlays || [];
      config.music = contentData.music || null;
      config.speed = contentData.speed || 1;
    } else if (contentData.type === "post") {
      config.layout = contentData.layout || "single";
      config.textCard = contentData.isTextCard || false;
      config.textCardConfig = contentData.textCardMetadata || null;
      config.imageCount = contentData.image_ids?.length || 0;
    } else if (contentData.type === "story") {
      config.category = contentData.category;
      config.coverStyle = contentData.coverImageMetadata || null;
    }

    return config;
  }

  // ==================== ANALYZE VIDEO AND CREATE TEMPLATE (AI/ML) ====================

  async analyzeVideoForTemplate(videoFile, userId) {
    try {
      console.log("🤖 Analyzing video for template creation...");

      // This would integrate with an AI/ML service
      // For now, return mock analysis
      const analysis = {
        duration: 15,
        transitions: ["fade", "slide"],
        filters: ["warm", "vivid"],
        effects: {
          brightness: 1.1,
          contrast: 1.05,
          saturation: 1.2,
        },
        textOverlays: [
          {
            text: "Sample Text",
            startTime: 2,
            endTime: 5,
            position: { x: 50, y: 50 },
          },
        ],
        music: null,
        speed: 1,
        hasMotion: true,
        complexity: "medium",
      };

      // Save as draft
      const draftData = {
        type: "reel",
        duration: analysis.duration,
        transitions: analysis.transitions,
        filters: analysis.filters,
        effects: analysis.effects,
        textOverlays: analysis.textOverlays,
        music: analysis.music,
        speed: analysis.speed,
      };

      await this.saveCreationAsDraft(draftData, userId);

      return analysis;
    } catch (error) {
      console.error("Failed to analyze video:", error);
      throw error;
    }
  }

  // ==================== INCREMENT TEMPLATE USES ====================

  async incrementTemplateUses(templateId) {
    try {
      const { error } = await supabase.rpc("increment_template_uses", {
        template_id: templateId,
      });

      if (error) throw error;
    } catch (error) {
      console.error("Failed to increment template uses:", error);
    }
  }

  // ==================== MOCK DATA FOR DEVELOPMENT ====================

  getMockTemplates(type) {
    const mockTemplates = {
      reel: [
        {
          id: 1,
          name: "Dynamic Intro",
          description: "High-energy intro with zoom transitions",
          type: "reel",
          thumbnail_url: null,
          category: "Intro",
          duration: 15,
          uses: 15420,
          is_premium: false,
          is_trending: true,
          features: ["Zoom transitions", "Text animations", "Beat sync"],
          config: { transitions: ["zoom"], filters: ["vivid"] },
        },
        {
          id: 2,
          name: "Smooth Slideshow",
          description: "Elegant slideshow with fade transitions",
          type: "reel",
          thumbnail_url: null,
          category: "Slideshow",
          duration: 20,
          uses: 12350,
          is_premium: false,
          is_trending: true,
          features: ["Fade transitions", "Ken Burns effect", "Music sync"],
          config: { transitions: ["fade"], effects: { brightness: 1.1 } },
        },
        {
          id: 3,
          name: "Cinematic Travel",
          description: "Cinematic travel video template",
          type: "reel",
          thumbnail_url: null,
          category: "Travel",
          duration: 30,
          uses: 9870,
          is_premium: true,
          is_trending: false,
          features: ["Slow motion", "Color grading", "Ambient music"],
          config: { speed: 0.75, filters: ["cinematic"] },
        },
      ],
      post: [
        {
          id: 10,
          name: "Quote Card",
          description: "Stylish quote card template",
          type: "post",
          thumbnail_url: null,
          category: "Quote",
          duration: 0,
          uses: 28900,
          is_premium: false,
          is_trending: true,
          features: ["Custom fonts", "Gradient backgrounds", "Text alignment"],
          config: { textCard: true },
        },
        {
          id: 11,
          name: "Product Showcase",
          description: "3-image product showcase layout",
          type: "post",
          thumbnail_url: null,
          category: "Business",
          duration: 0,
          uses: 14200,
          is_premium: false,
          is_trending: false,
          features: [
            "Multi-image layout",
            "Professional borders",
            "Text overlay",
          ],
          config: { layout: "grid" },
        },
      ],
      story: [
        {
          id: 20,
          name: "Story Arc",
          description: "Engaging story structure template",
          type: "story",
          thumbnail_url: null,
          category: "Narrative",
          duration: 0,
          uses: 7650,
          is_premium: true,
          is_trending: false,
          features: [
            "Structured chapters",
            "Preview optimization",
            "SEO ready",
          ],
          config: { structure: "three-act" },
        },
      ],
    };

    return mockTemplates[type] || [];
  }
}

const templateService = new TemplateService();
export default templateService;
