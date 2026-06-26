// ============================================================================
// src/services/xrc/index.js
// Singleton XRC service instance for app-wide integration.
// ============================================================================

import { supabase } from "../config/supabase";
import { createXRCService, XRC_EVENTS } from "./xrcService";

const xrcService = createXRCService(supabase);

export default xrcService;
export { createXRCService, XRC_EVENTS };
