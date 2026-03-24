export enum RunState {
  Idle = 'idle',
  Compiling = 'compiling',
  Running = 'running',
  WaitingForInput = 'waitingForInput',
  Finished = 'finished',
  Error = 'error',
}

export interface CompileError {
  message: string;
  line: number;
  column: number;
  severity: string;
}

export interface RunEvent {
  type:
    | 'output'
    | 'inputEcho'
    | 'error'
    | 'compileError'
    | 'waiting'
    | 'finished'
    | 'started'
    | 'compiling'
    | 'clear';
  data?: string | CompileError[] | number;
  timestamp: Date;
}
