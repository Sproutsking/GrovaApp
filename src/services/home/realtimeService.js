// src/services/home/realtimeService.js
import { supabase } from '../config/supabase';

class RealtimeService {
  constructor() {
    this.subscriptions = new Map();
  }

  // Subscribe to new posts
  subscribeToNewPosts(callback) {
    const channel = supabase
      .channel('public:posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          // Fetch full post data with profile
          const { data } = await supabase
            .from('posts')
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                username,
                avatar_id,
                verified
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) callback(data);
        }
      )
      .subscribe();

    this.subscriptions.set('posts', channel);
    return () => this.unsubscribe('posts');
  }

  // Subscribe to new reels
  subscribeToNewReels(callback) {
    const channel = supabase
      .channel('public:reels')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reels'
        },
        async (payload) => {
          const { data } = await supabase
            .from('reels')
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                username,
                avatar_id,
                verified
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) callback(data);
        }
      )
      .subscribe();

    this.subscriptions.set('reels', channel);
    return () => this.unsubscribe('reels');
  }

  // Subscribe to new stories
  subscribeToNewStories(callback) {
    const channel = supabase
      .channel('public:stories')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stories'
        },
        async (payload) => {
          const { data } = await supabase
            .from('stories')
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                username,
                avatar_id,
                verified
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) callback(data);
        }
      )
      .subscribe();

    this.subscriptions.set('stories', channel);
    return () => this.unsubscribe('stories');
  }

  // Subscribe to comments on specific content
  subscribeToComments(contentType, contentId, callback) {
    const field = `${contentType}_id`;
    const channelName = `comments:${contentType}:${contentId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `${field}=eq.${contentId}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('comments')
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                username,
                avatar_id,
                verified
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) callback(data);
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to likes on specific content
  subscribeToLikes(contentType, contentId, callback) {
    const tableName = `${contentType}_likes`;
    const field = `${contentType}_id`;
    const channelName = `likes:${contentType}:${contentId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
          filter: `${field}=eq.${contentId}`
        },
        (payload) => {
          callback({ event: 'like', data: payload.new });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: tableName,
          filter: `${field}=eq.${contentId}`
        },
        (payload) => {
          callback({ event: 'unlike', data: payload.old });
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to user notifications (likes, comments on your content)
  subscribeToNotifications(userId, callback) {
    const channelName = `notifications:${userId}`;

    // Listen for likes on user's posts
    const postsChannel = supabase
      .channel(`${channelName}:posts`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_likes'
        },
        async (payload) => {
          // Check if this like is on user's post
          const { data: post } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', payload.new.post_id)
            .single();

          if (post && post.user_id === userId) {
            callback({
              type: 'like',
              contentType: 'post',
              contentId: payload.new.post_id,
              userId: payload.new.user_id
            });
          }
        }
      )
      .subscribe();

    // Listen for comments on user's content
    const commentsChannel = supabase
      .channel(`${channelName}:comments`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments'
        },
        async (payload) => {
          // Check if comment is on user's content
          let contentType, contentId, ownerId;

          if (payload.new.post_id) {
            const { data } = await supabase
              .from('posts')
              .select('user_id')
              .eq('id', payload.new.post_id)
              .single();
            contentType = 'post';
            contentId = payload.new.post_id;
            ownerId = data?.user_id;
          } else if (payload.new.reel_id) {
            const { data } = await supabase
              .from('reels')
              .select('user_id')
              .eq('id', payload.new.reel_id)
              .single();
            contentType = 'reel';
            contentId = payload.new.reel_id;
            ownerId = data?.user_id;
          } else if (payload.new.story_id) {
            const { data } = await supabase
              .from('stories')
              .select('user_id')
              .eq('id', payload.new.story_id)
              .single();
            contentType = 'story';
            contentId = payload.new.story_id;
            ownerId = data?.user_id;
          }

          if (ownerId === userId) {
            callback({
              type: 'comment',
              contentType,
              contentId,
              userId: payload.new.user_id,
              text: payload.new.text
            });
          }
        }
      )
      .subscribe();

    this.subscriptions.set(channelName, postsChannel);
    this.subscriptions.set(`${channelName}:comments`, commentsChannel);

    return () => {
      this.unsubscribe(channelName);
      this.unsubscribe(`${channelName}:comments`);
    };
  }

  // Unsubscribe from channel
  unsubscribe(channelName) {
    const channel = this.subscriptions.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.subscriptions.forEach((channel, name) => {
      supabase.removeChannel(channel);
    });
    this.subscriptions.clear();
  }
}

export default new RealtimeService();