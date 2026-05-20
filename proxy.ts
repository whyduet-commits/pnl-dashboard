import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();

  const cookies = request.cookies.getAll();
  const hasSession = cookies.some((c) => c.name.startsWith("sb-"));

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|login).*)"],
};