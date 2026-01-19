// src/services/sounds/soundService.js
const soundService = {
  async trackSoundUsage(soundName, userId, reelId) {
    // Check if sound exists
    const { data: existing } = await supabase
      .from('sounds')
      .select('*')
      .eq('name', soundName)
      .single();

    if (!existing) {
      // Create new sound record
      await supabase.from('sounds').insert({
        name: soundName,
        first_used_by: userId,
        total_uses: 1
      });
    } else {
      // Increment usage count
      await supabase
        .from('sounds')
        .update({ total_uses: existing.total_uses + 1 })
        .eq('id', existing.id);
    }
  },

  async getSoundData(soundName) {
    const { data } = await supabase
      .from('sounds')
      .select('*, profiles:first_used_by(*)')
      .eq('name', soundName)
      .single();
    return data;
  }
};