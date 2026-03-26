export interface ReportFight {
  id: number;
  encounterID: number;
  name: string;
  kill: boolean;
  startTime: number;
  endTime: number;
  difficulty: number;
  size: number;
}

export interface ReportActor {
  id: number;
  gameID: number;
  name: string;
  server: string;
  subType: string;
}
