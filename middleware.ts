import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName, verifyAdminSessionValue } from "@/lib/admin-session";

export async function middleware(request: NextRequest) {
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  const isLoginPath = request.nextUrl.pathname === "/admin/login";

  if (!isAdminPath || isLoginPath) {
    return NextResponse.next();
  }

  if (await verifyAdminSessionValue(request.cookies.get(adminCookieName)?.value)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
