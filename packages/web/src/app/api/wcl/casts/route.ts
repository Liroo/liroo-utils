import { NextRequest, NextResponse } from "next/server";
import { getWCLClientFromHeaders } from "@/lib/wcl";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const fightID = Number(params.get("fightID"));
  const startTime = Number(params.get("startTime"));
  const endTime = Number(params.get("endTime"));
  const sourceID = Number(params.get("sourceID"));

  if (!code || !fightID || !startTime || !endTime || !sourceID) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const wcl = getWCLClientFromHeaders(request.headers);
    const data = await wcl.getCastTimeline({ code, fightID, startTime, endTime, sourceID });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
