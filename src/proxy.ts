import { NextResponse, type NextRequest } from "next/server";

// Chưa đăng nhập → chuyển về trang /login (kiểm tra kỹ quyền nằm ở từng trang)
export function proxy(req: NextRequest) {
  if (!req.cookies.has("hr_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
