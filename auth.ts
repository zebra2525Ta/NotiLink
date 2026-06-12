import NextAuth from "next-auth";
import Notion from "next-auth/providers/notion";

declare module "next-auth" {
  interface Session {
    accessToken: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Notion({
      clientId: process.env.NOTION_CLIENT_ID!,
      clientSecret: process.env.NOTION_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/callback/notion`,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.sub = token.sub ?? account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.id = token.sub ?? "";
      return session;
    },
  },
});
