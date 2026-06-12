import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface UserDbIds {
  misc: string;
  places: string;
  shopping: string;
  schedule: string;
}

export async function getUserDbIds(userId: string): Promise<UserDbIds | null> {
  return redis.get<UserDbIds>(`user:${userId}:dbs`);
}

export async function setUserDbIds(userId: string, dbIds: UserDbIds): Promise<void> {
  await redis.set(`user:${userId}:dbs`, dbIds);
}
