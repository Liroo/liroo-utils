import { NextRequest, NextResponse } from "next/server";
import { getWCLClientFromHeaders } from "@/lib/wcl";

const GET_REPORT = `
  query GetReport($code: String!) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        endTime
        fights(killType: Encounters) {
          id
          encounterID
          name
          kill
          startTime
          endTime
          difficulty
          size
        }
        masterData(translate: true) {
          actors(type: "Player") {
            id
            gameID
            name
            server
            subType
          }
        }
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  try {
    const wcl = getWCLClientFromHeaders(request.headers);
    const data = await wcl.query(GET_REPORT, { code });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
