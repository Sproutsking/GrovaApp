// ============================================================================
// src/services/xrc/index.js
// Singleton XRC service instance for app-wide integration.
// ============================================================================

import { supabase } from "../config/supabase";
import { createXRCService, XRC_EVENTS } from "./xrcService";
import { STREAM_TYPES, STREAM_REGISTRY } from "./streamRegistry";

const xrcService = createXRCService(supabase);

export default xrcService;
export { createXRCService, XRC_EVENTS, STREAM_TYPES, STREAM_REGISTRY };
