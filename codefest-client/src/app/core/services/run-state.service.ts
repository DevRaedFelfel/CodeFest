import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { RunState, RunEvent, CompileError } from '../models/run-state.model';

@Injectable({ providedIn: 'root' })
export class RunStateService {
  private stateSubject = new BehaviorSubject<RunState>(RunState.Idle);
  private eventsSubject = new Subject<RunEvent>();
  private runCountSubject = new BehaviorSubject<number>(0);

  state$: Observable<RunState> = this.stateSubject.asObservable();
  events$: Observable<RunEvent> = this.eventsSubject.asObservable();
  runCount$: Observable<number> = this.runCountSubject.asObservable();

  get currentState(): RunState {
    return this.stateSubject.value;
  }

  handleRunCompiling(): void {
    this.stateSubject.next(RunState.Compiling);
    this.eventsSubject.next({ type: 'compiling', timestamp: new Date() });
  }

  handleRunStarted(runId: string): void {
    this.stateSubject.next(RunState.Running);
    this.runCountSubject.next(this.runCountSubject.value + 1);
    this.eventsSubject.next({
      type: 'started',
      data: runId,
      timestamp: new Date(),
    });
  }

  handleRunOutput(text: string): void {
    this.eventsSubject.next({
      type: 'output',
      data: text,
      timestamp: new Date(),
    });
  }

  handleRunWaiting(): void {
    this.stateSubject.next(RunState.WaitingForInput);
    this.eventsSubject.next({ type: 'waiting', timestamp: new Date() });
  }

  handleRunInputEcho(text: string): void {
    this.stateSubject.next(RunState.Running);
    this.eventsSubject.next({
      type: 'inputEcho',
      data: text,
      timestamp: new Date(),
    });
  }

  handleRunCompileError(errors: CompileError[]): void {
    this.stateSubject.next(RunState.Error);
    this.eventsSubject.next({
      type: 'compileError',
      data: errors,
      timestamp: new Date(),
    });
  }

  handleRunError(message: string): void {
    this.stateSubject.next(RunState.Error);
    this.eventsSubject.next({
      type: 'error',
      data: message,
      timestamp: new Date(),
    });
  }

  handleRunFinished(exitCode: number): void {
    this.stateSubject.next(RunState.Finished);
    this.eventsSubject.next({
      type: 'finished',
      data: exitCode,
      timestamp: new Date(),
    });
  }

  reset(): void {
    this.stateSubject.next(RunState.Idle);
  }
}
