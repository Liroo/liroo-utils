import { NextRequest, NextResponse } from "next/server";
import { getWCLClientFromHeaders } from "@/lib/wcl";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const fightIDs = params.get("fightIDs");

  if (!code || !fightIDs) {
    return NextResponse.json({ error: "Missing code or fightIDs" }, { status: 400 });
  }

  try {
    const wcl = getWCLClientFromHeaders(request.headers);
    const data = await wcl.getPlayerDetails(code, fightIDs.split(",").map(Number));
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
