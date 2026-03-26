import { GET_REPORT, GET_PLAYER_DETAILS, GET_FIGHT_EVENTS, GET_FIGHT_TABLE, GET_CAST_EVENTS, GET_CASTS_TABLE, GET_ENCOUNTER_RANKINGS, GET_CHARACTER_RANKINGS, GET_RATE_LIMIT, GET_BUFF_EVENTS, GET_RAID_HEALTH_EVENTS, GET_RAID_DAMAGE_EVENTS, } from "./queries.js";
const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const GRAPHQL_URL = "https://www.warcraftlogs.com/api/v2/client";
export class WCLClient {
    clientId;
    clientSecret;
    accessToken = null;
    tokenExpiresAt = 0;
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
    async authenticate() {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
        const response = await fetch(TOKEN_URL, {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });
        if (!response.ok) {
            throw new Error(`OAuth2 token request failed: ${response.status} ${response.statusText}`);
        }
        const data = (await response.json());
        this.accessToken = data.access_token;
        // Refresh 5 minutes before expiry
        this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
        return this.accessToken;
    }
    async query(graphqlQuery, variables) {
        const token = await this.authenticate();
        const response = await fetch(GRAPHQL_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: graphqlQuery, variables }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`WCL API error ${response.status}: ${text}`);
        }
        const json = (await response.json());
        if (json.errors?.length) {
            throw new Error(`WCL GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`);
        }
        return json.data;
    }
    // ── High-level methods ────────────────────────────────────────
    async getReport(code) {
        return this.query(GET_REPORT, { code });
    }
    async getPlayerDetails(code, fightIDs) {
        return this.query(GET_PLAYER_DETAILS, {
            code,
            fightIDs,
        });
    }
    /**
     * Fetch fight events with automatic pagination.
     * Returns the full array of events across all pages.
     */
    async getFightEvents(params) {
        const allEvents = [];
        let currentStart = params.startTime;
        while (true) {
            const data = await this.query(GET_FIGHT_EVENTS, {
                code: params.code,
                fightIDs: [params.fightID],
                startTime: currentStart,
                endTime: params.endTime,
                dataType: params.dataType,
                sourceID: params.sourceID,
                targetID: params.targetID,
                abilityID: params.abilityID,
                filterExpression: params.filterExpression,
                limit: params.limit ?? 10000,
            });
            const events = data.reportData.report.events;
            allEvents.push(...events.data);
            if (!events.nextPageTimestamp)
                break;
            currentStart = events.nextPageTimestamp;
        }
        return { eventCount: allEvents.length, events: allEvents };
    }
    async getFightTable(params) {
        return this.query(GET_FIGHT_TABLE, {
            code: params.code,
            fightIDs: [params.fightID],
            startTime: params.startTime,
            endTime: params.endTime,
            dataType: params.dataType,
            sourceID: params.sourceID,
        });
    }
    async getEncounterRankings(params) {
        return this.query(GET_ENCOUNTER_RANKINGS, params);
    }
    async getCharacterRankings(params) {
        return this.query(GET_CHARACTER_RANKINGS, params);
    }
    /**
     * Fetch cast timeline with ability icons and resource data.
     * Combines Casts events (with includeResources) and Casts table (for icons).
     */
    async getCastTimeline(params) {
        const { code, fightID, startTime, endTime, sourceID } = params;
        // Buffs to track as lanes
        const TRACKED_BUFFS = [
            { id: 369299, name: "Essence Burst", icon: "ability_evoker_essenceburst.jpg", maxStacks: 2 },
            { id: 1242759, name: "Twin Echoes", icon: "ability_evoker_echo.jpg", maxStacks: 2 },
        ];
        // Fetch Casts table for ability name/icon mapping
        const tablePromise = this.query(GET_CASTS_TABLE, {
            code,
            fightIDs: [fightID],
            startTime,
            endTime,
            sourceID,
        });
        // Fetch raid HP events (healing + damage for all players, no sourceID filter)
        // Also collect healing amounts from OUR player for HPS graph
        const raidDataPromise = (async () => {
            const snapshots = [];
            const healAmounts = [];
            const seen = new Map();
            const fetchAll = async (query, collectHealing) => {
                let start = startTime;
                while (true) {
                    const data = await this.query(query, {
                        code,
                        fightIDs: [fightID],
                        startTime: start,
                        endTime,
                        limit: 10000,
                    });
                    const page = data.reportData.report.events;
                    for (const raw of page.data) {
                        const tid = raw.targetID;
                        const hp = raw.hitPoints;
                        const maxHP = raw.maxHitPoints;
                        if (tid > 0 && hp != null && maxHP != null && maxHP > 0) {
                            const ts = raw.timestamp - startTime;
                            const prev = seen.get(tid);
                            if (!prev || prev.hp !== hp || ts - prev.ts > 2000) {
                                snapshots.push({ timestamp: ts, targetID: tid, hitPoints: hp, maxHitPoints: maxHP });
                                seen.set(tid, { hp, max: maxHP, ts });
                            }
                        }
                        // Collect healing amounts from our player
                        if (collectHealing && raw.sourceID === sourceID) {
                            const amount = raw.amount;
                            if (amount && amount > 0) {
                                healAmounts.push({ timestamp: raw.timestamp - startTime, amount });
                            }
                        }
                    }
                    if (!page.nextPageTimestamp)
                        break;
                    start = page.nextPageTimestamp;
                }
            };
            await Promise.all([
                fetchAll(GET_RAID_HEALTH_EVENTS, true),
                fetchAll(GET_RAID_DAMAGE_EVENTS, false),
            ]);
            snapshots.sort((a, b) => a.timestamp - b.timestamp);
            healAmounts.sort((a, b) => a.timestamp - b.timestamp);
            // Build HPS graph: rolling 5s window, sampled every 1s
            const HPS_WINDOW_MS = 5000;
            const fightDur = endTime - startTime;
            const hpsGraph = [];
            for (let t = 0; t <= fightDur; t += 1000) {
                const windowStart = t - HPS_WINDOW_MS;
                let total = 0;
                for (const h of healAmounts) {
                    if (h.timestamp < windowStart)
                        continue;
                    if (h.timestamp > t)
                        break;
                    total += h.amount;
                }
                hpsGraph.push({ timestamp: t, hps: total / (HPS_WINDOW_MS / 1000) });
            }
            return { snapshots, hpsGraph };
        })();
        // Fetch buff events (paginated)
        const buffPromise = (async () => {
            const allBuffs = [];
            let buffStart = startTime;
            while (true) {
                const data = await this.query(GET_BUFF_EVENTS, {
                    code,
                    fightIDs: [fightID],
                    startTime: buffStart,
                    endTime,
                    sourceID,
                    limit: 10000,
                });
                const page = data.reportData.report.events;
                allBuffs.push(...page.data);
                if (!page.nextPageTimestamp)
                    break;
                buffStart = page.nextPageTimestamp;
            }
            return allBuffs;
        })();
        // Fetch all cast events (paginated) with resources
        const allRawEvents = [];
        let currentStart = startTime;
        while (true) {
            const data = await this.query(GET_CAST_EVENTS, {
                code,
                fightIDs: [fightID],
                startTime: currentStart,
                endTime,
                sourceID,
                limit: 10000,
            });
            const page = data.reportData.report.events;
            allRawEvents.push(...page.data);
            if (!page.nextPageTimestamp)
                break;
            currentStart = page.nextPageTimestamp;
        }
        // Build abilities map from table data
        const tableData = await tablePromise;
        const table = tableData.reportData.report.table;
        const abilities = {};
        if (table?.data?.entries) {
            for (const entry of table.data.entries) {
                abilities[entry.guid] = {
                    name: entry.name,
                    icon: entry.abilityIcon,
                };
            }
        }
        // Enrich events
        const events = allRawEvents.map((raw) => {
            const abilityGameID = raw.abilityGameID ?? 0;
            const abilityInfo = abilities[abilityGameID];
            const resources = raw.classResources;
            // WCL resource type IDs: 0 = mana, 19 = essence (Evoker)
            const essenceRes = resources?.find((r) => r.type === 19);
            const manaRes = resources?.find((r) => r.type === 0);
            const event = {
                timestamp: raw.timestamp - startTime,
                type: raw.type,
                abilityGameID,
                abilityName: abilityInfo?.name ?? `Unknown(${abilityGameID})`,
                abilityIcon: abilityInfo?.icon ?? "",
                targetID: raw.targetID ?? 0,
            };
            if (raw.empowermentLevel != null) {
                event.empowermentLevel = raw.empowermentLevel;
            }
            if (essenceRes) {
                event.essence = essenceRes.amount;
                event.essenceMax = essenceRes.max;
                event.essenceCost = essenceRes.cost;
            }
            if (manaRes) {
                event.mana = manaRes.amount;
                event.manaMax = manaRes.max;
                event.manaCost = manaRes.cost;
            }
            if (raw.hitPoints != null) {
                event.hitPoints = raw.hitPoints;
                event.maxHitPoints = raw.maxHitPoints;
            }
            return event;
        });
        // Build buff lanes
        const allBuffEvents = await buffPromise;
        const fightDuration = endTime - startTime;
        const buffLanes = [];
        for (const tracked of TRACKED_BUFFS) {
            const buffEvents = allBuffEvents.filter((e) => e.abilityGameID === tracked.id);
            // Walk through events and build spans
            const spans = [];
            let currentStacks = 0;
            let spanStart = 0;
            for (const raw of buffEvents) {
                const ts = raw.timestamp - startTime;
                const type = raw.type;
                // Close previous span if stacks changed
                if (currentStacks > 0 && ts > spanStart) {
                    spans.push({ startTime: spanStart, endTime: ts, stacks: currentStacks });
                }
                switch (type) {
                    case "applybuff":
                        currentStacks = 1;
                        break;
                    case "applybuffstack":
                        currentStacks = Math.min(currentStacks + 1, tracked.maxStacks);
                        break;
                    case "removebuffstack":
                        currentStacks = Math.max(currentStacks - 1, 0);
                        break;
                    case "removebuff":
                        currentStacks = 0;
                        break;
                    case "refreshbuff":
                        // Wasted proc — stacks unchanged, but close/reopen span to mark it
                        if (currentStacks > 0 && ts > spanStart) {
                            spans.push({ startTime: spanStart, endTime: ts, stacks: currentStacks });
                        }
                        break;
                }
                spanStart = ts;
            }
            // Close final span
            if (currentStacks > 0) {
                spans.push({ startTime: spanStart, endTime: fightDuration, stacks: currentStacks });
            }
            buffLanes.push({
                abilityGameID: tracked.id,
                name: tracked.name,
                icon: tracked.icon,
                maxStacks: tracked.maxStacks,
                spans,
            });
        }
        // Raid target buffs to track on raid frames
        const RAID_BUFF_DEFS = [
            { id: 364343, name: "Echo", icon: "ability_evoker_echo.jpg", color: "#bc8cff", abbrev: "Ec" },
            { id: 355941, name: "Dream Breath", icon: "ability_evoker_dreambreath.jpg", color: "#f0883e", abbrev: "DB" },
            { id: 366155, name: "Reversion", icon: "ability_evoker_reversion.jpg", color: "#7ee787", abbrev: "Rv" },
            { id: 367364, name: "Reversion (Echo)", icon: "ability_evoker_reversion2.jpg", color: "#56d4dd", abbrev: "Rv+" },
        ];
        const raidBuffIds = RAID_BUFF_DEFS.map((b) => b.id);
        const filterExpr = raidBuffIds.map((id) => `ability.id = ${id}`).join(" OR ");
        // Fetch all tracked buff events for raid targets (no sourceID param)
        const raidBuffPromise = (async () => {
            const all = [];
            let s = startTime;
            while (true) {
                const data = await this.query(GET_FIGHT_EVENTS, {
                    code,
                    fightIDs: [fightID],
                    startTime: s,
                    endTime,
                    dataType: "Buffs",
                    filterExpression: filterExpr,
                    limit: 10000,
                });
                const page = data.reportData.report.events;
                all.push(...page.data);
                if (!page.nextPageTimestamp)
                    break;
                s = page.nextPageTimestamp;
            }
            return all;
        })();
        const allRaidBuffs = await raidBuffPromise;
        // Build raid buff events (filter to our sourceID only)
        const raidBuffEvents = allRaidBuffs
            .filter((e) => {
            const type = e.type;
            const src = e.sourceID;
            return (type === "applybuff" || type === "removebuff") && src === sourceID;
        })
            .map((e) => ({
            timestamp: e.timestamp - startTime,
            targetID: e.targetID,
            buffId: e.abilityGameID,
            type: e.type === "applybuff" ? "apply" : "remove",
        }));
        raidBuffEvents.sort((a, b) => a.timestamp - b.timestamp);
        // Legacy echoEvents (for backwards compat)
        const echoEvents = raidBuffEvents
            .filter((e) => e.buffId === 364343)
            .map((e) => ({ timestamp: e.timestamp, targetID: e.targetID, type: e.type }));
        return {
            events,
            fightDuration,
            abilities,
            buffLanes,
            echoEvents,
            raidBuffEvents,
            raidBuffDefs: RAID_BUFF_DEFS,
            ...await (async () => {
                const rd = await raidDataPromise;
                return { raidHP: rd.snapshots, hpsGraph: rd.hpsGraph };
            })(),
        };
    }
    async getRateLimit() {
        return this.query(GET_RATE_LIMIT);
    }
}
//# sourceMappingURL=wcl-client.js.map