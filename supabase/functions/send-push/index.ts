import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = "mailto:support@grova.app";

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: string
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    // Import web-push-deno
    const webpush = await import("https://deno.land/x/web_push@0.0.2/mod.ts");

    await webpush.sendNotification(
      pushSubscription,
      payload,
      {
        vapidDetails: {
          subject: VAPID_SUBJECT,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
        },
      }
    );

    return true;
  } catch (error) {
    console.error("Push send error:", error);
    return false;
  }
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      recipient_user_id,
      actor_user_id,
      type,
      message,
      entity_id,
      metadata,
    } = body;

    // Get actor profile
    let actorName = "Someone";
    let actorAvatar = null;

    if (actor_user_id) {
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("full_name, avatar_id")
        .eq("id", actor_user_id)
        .single();

      if (actorProfile) {
        actorName = actorProfile.full_name;
        actorAvatar = actorProfile.avatar_id;
      }
    }

    // Get all active push subscriptions for recipient
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", recipient_user_id)
      .eq("is_active", true);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare notification payload
    const notification = {
      title: "Grova",
      body: message,
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: `${type}-${entity_id || Date.now()}`,
      data: {
        type,
        entity_id,
        actor_user_id,
        actor_name: actorName,
        actor_avatar: actorAvatar,
        url: getNotificationUrl(type, entity_id),
        timestamp: Date.now(),
        ...metadata,
      },
      requireInteraction: false,
      vibrate: [200, 100, 200],
    };

    const payload = JSON.stringify(notification);
    const invalidSubscriptions: string[] = [];
    let sentCount = 0;

    // Send to all subscriptions
    await Promise.all(
      subscriptions.map(async (sub) => {
        const success = await sendWebPush(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload
        );

        if (success) {
          sentCount++;
        } else {
          invalidSubscriptions.push(sub.id);
        }
      })
    );

    // Clean up invalid subscriptions
    if (invalidSubscriptions.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .in("id", invalidSubscriptions);
    }

    return new Response(
      JSON.stringify({
        sent: sentCount,
        failed: invalidSubscriptions.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function getNotificationUrl(type: string, entityId: string | null): string {
  switch (type) {
    case "like":
    case "comment":
      return `/post/${entityId}`;
    case "follow":
      return `/profile/${entityId}`;
    case "profile_view":
      return "/account/profile";
    default:
      return "/";
  }
}