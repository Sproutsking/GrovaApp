import { supabase } from "../config/supabase";

class GraphService {
  async getRelationshipGraph(profileId, category = null, relation = null) {
    const body = { profile_id: profileId };
    if (category) body.category = category;
    if (relation) body.relation = relation;

    const { data, error } = await supabase.functions.invoke("relationship-graph", {
      body,
    });

    if (error) {
      throw new Error(error.message || "Failed to load relationship graph");
    }

    return data || { items: [], edges: [] };
  }
}

export default new GraphService();
