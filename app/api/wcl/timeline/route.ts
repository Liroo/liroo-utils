import { NextRequest, NextResponse } from "next/server";
import { getWCLClientFromHeaders } from "@/lib/wcl";
import { buildEssenceTimeline } from "@/lib/wlogs/analysis/modules/essence-timeline";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const fightID = Number(params.get("fightID"));
  const startTime = Number(params.get("startTime"));
  const endTime = Number(params.get("endTime"));
  const sourceID = Number(params.get("sourceID"));
  const playerName = params.get("playerName") || "Player";

  if (!code || !fightID || !startTime || !endTime || !sourceID) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const wcl = getWCLClientFromHeaders(request.headers);
    const data = await buildEssenceTimeline(wcl, code, fightID, startTime, endTime, sourceID, playerName);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
