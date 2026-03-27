import { NextRequest, NextResponse } from "next/server";
import { getWCLClientFromHeaders } from "@/lib/wcl";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  try {
    const wcl = getWCLClientFromHeaders(request.headers);
    const data = await wcl.getReport(code);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
