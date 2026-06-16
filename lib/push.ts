import webPush from "web-push";
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export const SUBSCRIPTION_KEY = "push:subscription";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPush(payload: PushPayload): Promise<void> {
  const sub = await redis.get<webPush.PushSubscription>(SUBSCRIPTION_KEY);
  if (!sub) return;
  await webPush.sendNotification(sub, JSON.stringify(payload));
}
