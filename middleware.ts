import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  const isLoginPath = request.nextUrl.pathname === "/admin/login";

  if (!isAdminPath || isLoginPath) {
    return NextResponse.next();
  }

  if (request.cookies.get(adminCookieName)?.value === "1") {
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
